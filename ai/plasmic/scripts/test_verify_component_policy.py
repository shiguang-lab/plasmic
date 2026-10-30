import hashlib
import html
import json
from pathlib import Path
import tempfile
import unittest

from verify_component_policy import APP_SOURCE, BASELINES, check_page, plan_errors, policy_errors, search_form_span


def node(name, component, values=None):
    return '<plasmic-component id="' + name + '" data-plasmic-name="' + name + '" data-plasmic-component="' + component + '" data-props="' + html.escape(json.dumps(values or {}), quote=True) + '"></plasmic-component>'


class PolicyTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.path = Path(temp.name) / 'requirement.md'

    def evidence(self, text):
        self.path.write_text(text, encoding="utf-8")
        return {'path': str(self.path), 'sha256': hashlib.sha256(self.path.read_bytes()).hexdigest(), 'quote': text}

    def page(self, markup):
        return {'type': 'page', 'pageMeta': {'path': '/groups'}, 'baseVariantTplTree': markup}

    def test_crlf_sources_match_text_quotes_without_weakening_byte_hashes(self):
        from verify_component_policy import source_text
        data = '字段\r\n[名称]\r\n'.encode('utf-8')
        self.path.write_bytes(data)
        evidence = {'path': str(self.path), 'sha256': hashlib.sha256(data).hexdigest(), 'quote': '字段\n[名称]\n'}
        self.assertEqual(source_text(evidence), '字段\n[名称]\n')
        with self.assertRaisesRegex(ValueError, 'quote is not present'):
            source_text({**evidence, 'quote': '[不存在的字段]'})
        self.path.write_bytes(data.replace(b'\r\n', b'\n'))
        with self.assertRaisesRegex(ValueError, 'Source changed'):
            source_text(evidence)

    def test_native_defaults_and_explicit_equal_values_pass(self):
        for key, values in BASELINES.items():
            spec = {'nodeName': 'Widget', 'component': key}
            unset = policy_errors(spec, {})
            if key == 'plasmicantd6table':
                # Native density differs from the chosen product convention.
                self.assertEqual([e['property'] for e in unset], ['pagination.defaultPageSize', 'pagination.pageSizeOptions'])
            else:
                self.assertEqual(unset, [])
            # Nested dropdown props use their native nesting.
            actual = {k: v for k, v in values.items() if '.' not in k}
            for path, value in values.items():
                if '.' in path:
                    outer, inner = path.split('.', 1)
                    actual.setdefault(outer, {})[inner] = value
            self.assertEqual(policy_errors(spec, actual), [])

    def test_self_consistent_generated_expectations_do_not_authorize_overrides(self):
        for key, values in [
            ('plasmic-overseas-search-form', {'colSpan': 8, 'minRows': 2, 'collapsed': False}),
            ('plasmic-overseas-search-form-item', {'span': 12}),
            ('plasmic-react-ui-action-group', {'max': 6, 'dropdownProps': {'trigger': ['click']}}),
            ('plasmic-antd6-dropdown', {'trigger': 'click'}),
        ]:
            spec = {'nodeName': 'Widget', 'component': key, 'props': values, 'source': 'REQ: keyword search'}
            self.assertTrue(policy_errors(spec, values), key)

    def test_real_explicit_requirement_allows_only_the_reviewed_value(self):
        evidence = self.evidence('本页行操作明确使用 max=5。')
        spec = {'nodeName': 'Actions', 'component': 'plasmic-react-ui-action-group', 'props': {'max': 5},
                'overrides': {'max': {'reason': 'User specifies the action limit', 'evidence': evidence}}}
        hover = {'dropdownProps': {'trigger': ['hover']}}
        self.assertEqual(policy_errors(spec, {'max': 5, **hover}), [])
        self.assertTrue(policy_errors(spec, {'max': 6, **hover}))
        self.path.write_text('Requirement changed after planning', encoding="utf-8")
        self.assertTrue(policy_errors(spec, {'max': 5, **hover}))

    def test_reviewed_three_column_mode_does_not_need_a_requirement_override(self):
        spec = {'nodeName': 'Filters', 'component': 'plasmic-overseas-search-form',
                'source': 'Original visual frame: multiple rows aligned to three field columns',
                'props': {'colSpan': 8}}
        self.assertEqual(search_form_span(spec), 8)
        self.assertEqual(policy_errors(spec, {'colSpan': 8}), [])
        self.assertTrue(policy_errors(spec, {'colSpan': 6}))

    def test_unsupported_draft_columns_do_not_authorize_matching_output(self):
        for span in (0, 3, 4, 5, 7, 12, 24, True, '{{ $state.span }}'):
            with self.subTest(span=span):
                spec = {'component': 'plasmic-overseas-search-form', 'source': 'Visual draft puts every field on one row',
                        'props': {'colSpan': span}}
                self.assertEqual(search_form_span(spec), 6)
                self.assertTrue(policy_errors(spec, spec['props']))

    def test_other_modes_require_the_exact_requirement_document_constraint(self):
        spec = {'component': 'plasmic-overseas-search-form', 'props': {'colSpan': 12},
                'overrides': {'colSpan': {'reason': 'Requirement mandates two columns',
                                          'evidence': self.evidence('筛选区每行2列。')}}}
        self.assertEqual(search_form_span(spec), 12)
        self.assertEqual(policy_errors(spec, {'colSpan': 12}), [])
        self.assertTrue(policy_errors(spec, {'colSpan': 4}))
        spec['overrides']['colSpan']['evidence'] = self.evidence('筛选区包含两个字段。')
        self.assertEqual(search_form_span(spec), 6)
        self.assertTrue(policy_errors(spec, {'colSpan': 12}))

    def test_three_column_fields_inherit_their_owning_form_mode(self):
        form = {'nodeName': 'Filters', 'component': 'plasmic-overseas-search-form', 'props': {'colSpan': 8}}
        field = {'nodeName': 'Keyword', 'component': 'plasmic-overseas-search-form-item',
                 'owner': {'nodeName': 'Filters', 'slot': 'children'}, 'props': {'span': 8}}
        plan = {'components': [form, field]}
        self.assertEqual(plan_errors(plan), [])
        child = node('Keyword', field['component'], field['props'])
        markup = node('Filters', form['component'], form['props']).replace('</plasmic-component>',
            '<slot name="children">' + child + '</slot></plasmic-component>', 1)
        self.assertEqual(check_page(plan, self.page(markup)), [])
        broken = markup.replace('&quot;span&quot;: 8', '&quot;span&quot;: 6')
        self.assertEqual([e['property'] for e in check_page(plan, self.page(broken))], ['span'])

    def test_requiring_a_keyword_field_is_not_a_wide_field_exception(self):
        evidence = self.evidence('列表支持关键字检索，搜索名称和负责人。')
        spec = {'nodeName': 'Keyword', 'component': 'plasmic-overseas-search-form-item', 'props': {'span': 12},
                'overrides': {'span': {'reason': 'Long placeholder', 'evidence': evidence}}}
        self.assertTrue(policy_errors(spec, {'span': 12}))

    def test_initial_expansion_does_not_authorize_permanent_extra_rows(self):
        evidence = self.evidence('筛选区默认展开。')
        spec = {'component': 'plasmic-overseas-search-form', 'props': {'collapsed': False, 'minRows': 2},
                'overrides': {'collapsed': {'reason': 'Explicit initial state', 'evidence': evidence}}}
        self.assertEqual([e['property'] for e in policy_errors(spec, spec['props'])], ['minRows'])

    def test_search_form_initial_state_uses_exported_uncontrolled_prop(self):
        spec = {'component': 'plasmic-overseas-search-form'}
        self.assertEqual(policy_errors(spec, {'defaultCollapsed': True}), [])
        self.assertEqual([e['property'] for e in policy_errors(spec, {'defaultCollapsed': False})], ['collapsed'])
        evidence = self.evidence('筛选区默认展开。')
        spec.update(props={'collapsed': False}, overrides={
            'collapsed': {'reason': 'Explicit initial state', 'evidence': evidence}})
        self.assertEqual(policy_errors(spec, {'defaultCollapsed': False}), [])

    def test_search_form_bound_collapse_defers_to_runtime_without_hiding_literal_overrides(self):
        spec = {'component': 'plasmic-overseas-search-form'}
        self.assertEqual(policy_errors(spec, {'collapsed': '{{ $state.searchCollapsed }}'}), [])
        self.assertEqual([e['property'] for e in policy_errors(spec, {'collapsed': '{{ false }}'})], ['collapsed'])

    def test_action_group_preserves_native_trigger_choices(self):
        spec = {'component': 'plasmic-react-ui-action-group'}
        for values in ({}, {'dropdownProps': {'trigger': ['click']}}, {'dropdownProps': {'trigger': ['hover']}}):
            self.assertEqual(policy_errors(spec, values), [])

    def test_table_density_uses_effective_native_and_controlled_values(self):
        spec = {'component': 'plasmic-antd6-table'}
        for values in ({}, {'pagination': {}}, {'pagination': True}):
            self.assertEqual(len(policy_errors(spec, values)), 2)
        self.assertEqual(policy_errors(spec, {'pagination': False}), [])
        values = {'pagination': {'pageSize': 10, 'defaultPageSize': 20, 'pageSizeOptions': [20, 50, 100]}}
        self.assertEqual([e['property'] for e in policy_errors(spec, values)], ['pagination.pageSize'])
        values['pagination']['pageSize'] = 20
        values['pagination']['defaultPageSize'] = 10
        self.assertEqual(policy_errors(spec, values), [])
        values['pagination']['pageSize'] = 50
        spec.update(props=values, overrides={'pagination.pageSize': {
            'reason': 'Source requests 50 rows', 'evidence': self.evidence('每页50条。')}})
        self.assertEqual(policy_errors(spec, values), [])

    def test_invalid_plans_report_errors_without_diagnostic_crashes(self):
        evidence = self.evidence('app_source 用于列表上下文；启用需要二次确认。')
        plan = self.context_plan(evidence)
        plan['appContext']['consumers'] = None
        self.assertTrue(plan_errors(plan))
        plan = self.context_plan(evidence)
        plan['actionContracts'] = [{'nodeName': 'Actions', 'key': 'enable', 'evidence': evidence,
                                    'confirm': True, 'transitions': None, 'cases': [{'id': []}]}]
        self.assertTrue(plan_errors(plan))

    def context_plan(self, evidence):
        return {'path': '/groups', 'components': [{'nodeName': 'Shell', 'component': 'plasmic-overseas-app-shell', 'role': 'shell'}],
                'appContext': {'required': True, 'evidence': evidence, 'shell': 'Shell', 'binding': '$state.appSource',
                               'consumers': [{'nodeName': 'Results', 'property': 'data'}],
                               'cases': [self.case('switch-app', 'app-switch', 'Shell'), self.case('app-data', 'context-data', 'Results')]}}

    def case(self, name, kind, owner):
        return {'id': name, 'kind': kind, 'nodeName': owner, 'given': {'appSource': 'A'},
                'checks': [{'kind': 'text', 'text': 'App A', 'present': True}]}

    def context_markup(self):
        return node('Shell', 'plasmic-overseas-app-shell', {'appSources': [{'value': 'A', 'label': 'App A'}, {'value': 'B', 'label': 'App B'}],
            'appSource': '{{ $state.appSource }}', 'onAppSourceChange': '{{ value => $state.appSource = value }}'}) + node(
            'Results', 'plasmic-antd6-table', {'pagination': False, 'data': '{{ {data:$state.rows.filter(row => row.app_source === $state.appSource)} }}'})

    def test_app_source_aliases_require_semantic_context_review(self):
        for name in ['App 来源', 'App Source', 'app_source', 'appSource', 'APP-SOURCE', '应用来源',
                     'appId', 'app_id', 'application_id', 'app_name', '应用标识', '应用名称', '多 App']:
            self.assertTrue(APP_SOURCE.search(name), name)
            plan = self.context_plan(self.evidence('当前上下文按 ' + name + ' 区分 App。'))
            self.assertEqual(plan_errors(plan), [])
            plan['appContext']['required'] = False
            self.assertTrue(plan_errors(plan), name)

    def test_excluding_form_filters_does_not_disable_global_switcher(self):
        plan = self.context_plan(self.evidence('页面无 App 来源筛选项，app_source 由入口带入。'))
        plan['appContext']['required'] = False
        self.assertTrue(plan_errors(plan))
        plan['appContext']['evidence'] = self.evidence('当前用户明确要求顶部隐藏 AppSource 切换。')
        self.assertEqual(plan_errors(plan), [])

    def test_shell_requires_a_decision_even_before_an_empty_array_is_written(self):
        plan = self.context_plan(self.evidence('app_source 是当前工作 App。'))
        del plan['appContext']
        self.assertTrue(plan_errors(plan))

    def test_app_switcher_and_consumers_must_share_the_same_context(self):
        plan = self.context_plan(self.evidence('app_source 是当前工作 App。'))
        markup = self.context_markup()
        self.assertEqual(check_page(plan, self.page(markup)), [])
        for broken in [markup.replace('appSource = value', 'localSource = value'),
                       markup.replace('row.app_source === $state.appSource', "row.app_source === 'A'")]:
            self.assertTrue(check_page(plan, self.page(broken)))
        empty = node('Shell', 'plasmic-overseas-app-shell', {'appSources': []})
        self.assertTrue(check_page(plan, self.page(empty)))

    def test_multiple_page_sizes_require_a_real_visible_size_changer(self):
        values = {'pagination': {'defaultPageSize': 20, 'pageSizeOptions': [20, 50, 100]}}
        self.assertTrue(check_page({}, self.page(node('Table', 'plasmic-antd6-table', values))))
        values['pagination']['showSizeChanger'] = True
        self.assertEqual(check_page({}, self.page(node('Table', 'plasmic-antd6-table', values))), [])

    def test_native_component_owned_paging_needs_no_runtime_case(self):
        for component, values in [('plasmic-antd6-table', {'pagination': {'defaultPageSize': 20, 'pageSizeOptions': [20, 50, 100], 'showSizeChanger': False}}),
                                  ('plasmic-antd6-table', {'pagination': {'defaultPageSize': 20, 'showSizeChanger': True,
                                                                          'pageSizeOptions': [20, 50, 100]}}),
                                  ('plasmic-antd6-pagination', {'defaultPageSize': 20})]:
            with self.subTest(component=component, values=values):
                plan = {'path': '/groups', 'components': [{'nodeName': 'Results', 'component': component,
                         'role': 'pagination', 'props': values}], 'runtimeCases': []}
                self.assertEqual(plan_errors(plan), [])

    def test_prototype_owned_fixed_size_paging_requires_page_change_cases(self):
        evidence = self.evidence('列表每页20条，必须能够翻页查看不同记录。pagination.pageSizeOptions=[20]。')
        for component, values, dynamic in [
                ('plasmic-antd6-table', {'pagination': {'current': '{{ $state.page }}', 'pageSize': 20, 'pageSizeOptions': [20], 'showSizeChanger': False}}, []),
                ('plasmic-antd6-table', {'pagination': {'defaultPageSize': 20, 'pageSizeOptions': [20], 'showSizeChanger': False}}, ['pagination.current']),
                ('plasmic-antd6-pagination', {'current': '{{ $state.page }}'}, []),
                ('plasmic-antd6-pagination', {'pageSizeOptions': [20]}, ['current'])]:
            with self.subTest(component=component, values=values, dynamic=dynamic):
                plan = {'path': '/groups', 'components': [{'nodeName': 'Results', 'component': component,
                         'role': 'pagination', 'props': values, 'dynamicProps': dynamic}], 'runtimeCases': []}
                plan['components'][0]['overrides'] = {'pagination.pageSizeOptions': {
                    'reason': 'Source requires fixed-size paging', 'evidence': evidence}}
                self.assertTrue(plan_errors(plan))
                plan['runtimeCases'] = [{'id': 'second-page', 'kind': 'page-change', 'nodeName': 'Results',
                    'evidence': evidence, 'given': {'current': 2, 'pageSize': 20},
                    'checks': [{'kind': 'text', 'text': 'record-21', 'present': True}]}]
                self.assertEqual(plan_errors(plan), [])
                plan['runtimeCases'][0]['nodeName'] = 'OtherPager'
                self.assertTrue(plan_errors(plan))

    def test_prototype_owned_adjustable_paging_requires_page_size_and_page_change(self):
        evidence = self.evidence('列表支持翻页及每页条数切换。')
        for component, values in [
                ('plasmic-antd6-table', {'pagination': {'current': '{{ $state.page }}', 'defaultPageSize': 20, 'pageSizeOptions': [20, 50, 100]}}),
                ('plasmic-antd6-table', {'pagination': {'pageSize': '{{ $state.size }}', 'pageSizeOptions': [20, 50, 100], 'showSizeChanger': True}}),
                ('plasmic-antd6-table', {'pagination': {'current': '{{ $state.page }}', 'defaultPageSize': 20, 'pageSizeOptions': '{{ $state.pageSizes }}'}}),
                ('plasmic-antd6-pagination', {'current': '{{ $state.page }}', 'defaultPageSize': 20, 'pageSizeOptions': [20, 50, 100]}),
                ('plasmic-antd6-pagination', {'pageSize': '{{ $state.size }}', 'pageSizeOptions': [20, 50, 100], 'showSizeChanger': True})]:
            with self.subTest(component=component, values=values):
                cases = [{'id': kind, 'kind': kind, 'nodeName': 'Results', 'evidence': evidence,
                          'given': {'current': 1, 'pageSize': 20},
                          'checks': [{'kind': 'text', 'text': 'record-1', 'present': True}]}
                         for kind in ('page-change', 'page-size')]
                plan = {'path': '/groups', 'components': [{'nodeName': 'Results', 'component': component,
                         'role': 'pagination', 'props': values}], 'runtimeCases': cases}
                self.assertEqual(plan_errors(plan), [])
                for lone_case in cases:
                    plan['runtimeCases'] = [lone_case]
                    self.assertTrue(plan_errors(plan))

    def test_native_implicit_shell_state_does_not_require_redundant_callbacks(self):
        plan = self.context_plan(self.evidence('app_source 是当前工作 App。'))
        plan['appContext']['binding'] = '$state.shell.appSource'
        page = self.page(node('Shell', 'plasmic-overseas-app-shell', {'appSources': [{'value': 'A'}]}) + node(
            'Results', 'plasmic-antd6-table', {'pagination': False, 'data': '{{ {data:$state.rows.filter(r => r.app_source === $state.shell.appSource)} }}'}))
        page['states'] = [{'name': 'shell.appSource', 'elementUuid': 'Shell', 'variableType': 'text'}]
        self.assertEqual(check_page(plan, page), [])

    def test_native_state_actions_and_query_arguments_keep_their_real_contracts(self):
        plan = self.context_plan(self.evidence('app_source 是当前工作 App。'))
        plan['appContext']['consumers'][0]['queryName'] = 'GroupList'
        page = self.page(node('Shell', 'plasmic-overseas-app-shell', {'appSources': [{'value': 'A'}], 'appSource': '{{ $state.appSource }}'})
                         + node('Results', 'plasmic-antd6-table', {'pagination': False, 'data': '{{ $q.groupList }}'}))
        page['interactions'] = [{'elementUuid': 'Shell', 'eventName': 'onAppSourceChange', 'actionName': 'updateVariable',
                                 'args': {'variable': {'__type': 'ObjectPath', 'path': ['$state', 'appSource']}, 'value': '{{ value }}'}}]
        page['dataQueries'] = [{'name': 'GroupList', 'reference': '$q.groupList', 'code': 'fetchGroups({app_source:$state.appSource})'}]
        self.assertEqual(check_page(plan, page), [])
        page['dataQueries'][0]['code'] = 'fetchGroups({app_source:$state.appSourceFake})'
        self.assertTrue(check_page(plan, page))

    def test_required_confirmation_and_all_declared_transitions_need_cases(self):
        evidence = self.evidence('启用需要二次确认；停用启用后是重新启用圈选中。')
        contract = {'nodeName': 'Actions', 'key': 'enable', 'evidence': evidence, 'confirm': True,
                    'transitions': [{'from': 'INACTIVE', 'to': 'RE_SELECTING', 'text': '重新启用圈选中'}],
                    'cases': [{'kind': 'permission-allowed'}, {'kind': 'permission-denied'}]}
        plan = {'actionContracts': [contract]}
        self.assertTrue(plan_errors(plan))
        contract['cases'] += [{'kind': 'confirm-cancel'}, {'kind': 'confirm-accept'}, {'kind': 'state-transition'}]
        self.assertEqual(plan_errors(plan), [])
        group = node('Actions', 'plasmic-react-ui-action-group', {'items': [{'key': 'enable', 'label': '启用'}], 'dropdownProps': {'trigger': ['hover']}})
        self.assertTrue(check_page(plan, self.page(group)))
        # A retired wrapper-only confirm field is not confirmation.
        legacy = node('Actions', 'plasmic-react-ui-action-group', {'items': [{'key': 'enable', 'label': '启用', 'confirm': {'title': '确认启用？'}}], 'dropdownProps': {'trigger': ['hover']}})
        self.assertTrue(check_page(plan, self.page(legacy)))

        def confirmed(values, inner=group):
            return ('<plasmic-component id="Confirm" data-plasmic-name="Confirm" data-plasmic-component="plasmic-antd6-popconfirm" data-props="'
                    + html.escape(json.dumps(values), quote=True) + '"><slot name="children">' + inner + '</slot></plasmic-component>')
        wired = [{'elementUuid': 'Actions', 'eventName': 'onAction'}, {'elementUuid': 'Confirm', 'eventName': 'onConfirm'}]
        bound = {'title': '确认启用？', 'open': '{{ $state.pending?.rowId === row.id }}'}
        page = self.page(confirmed(bound))
        page['interactions'] = wired
        self.assertEqual(check_page(plan, page), [])
        for values, interactions in [({**bound, 'open': True}, wired), (bound, wired[:1]), (bound, wired[1:])]:
            with self.subTest(values=values, interactions=interactions):
                page = self.page(confirmed(values))
                page['interactions'] = interactions
                self.assertTrue(check_page(plan, page))
        page = self.page(group + confirmed(bound, ''))
        page['interactions'] = wired
        self.assertTrue(check_page(plan, page))


    def test_public_action_can_exclude_only_a_source_unsupported_denial(self):
        evidence = self.evidence('公开资料向所有访客开放查看，无角色、记录、市场或登录访问限制。')
        contract = {'nodeName': 'Actions', 'key': 'view', 'evidence': evidence,
                    'confirm': False, 'transitions': [],
                    'cases': [self.case('view-public', 'permission-allowed', 'Actions')]}
        plan = {'path': '/public', 'components': [], 'actionContracts': [contract]}
        self.assertTrue(any(e.get('requiredKinds') == ['permission-denied'] for e in plan_errors(plan)))
        contract['permissionDeniedNotApplicable'] = 'The cited public-access requirement defines no denied role or data scope.'
        self.assertEqual(plan_errors(plan), [])
        contract['cases'] = [self.case('load-failure', 'failure', 'Actions')]
        self.assertTrue(any('permission-allowed' in e.get('requiredKinds', []) for e in plan_errors(plan)))
        contract['cases'] = [self.case('view-public', 'permission-allowed', 'Actions')]
        contract['confirm'] = True
        contract['transitions'] = [{'from': 'OPEN', 'to': 'CLOSED', 'text': '已关闭'}]
        errors = plan_errors(plan)
        self.assertTrue(any(set(e.get('requiredKinds', [])) == {'confirm-cancel', 'confirm-accept', 'state-transition'} for e in errors))

    def test_action_without_in_scope_permissions_keeps_positive_coverage(self):
        contract = {'nodeName': 'Actions', 'key': 'view',
                    'evidence': self.evidence('本轮原型：订单列表每行点击查看进入订单详情。'),
                    'confirm': False, 'transitions': [],
                    'permissionDeniedNotApplicable': 'Reviewed prototype scope only specifies navigation; no permission distinction is defined. Service authorization remains unverified.',
                    'cases': [self.case('view-order', 'permission-allowed', 'Actions')]}
        plan = {'path': '/orders', 'components': [], 'actionContracts': [contract]}
        self.assertEqual(plan_errors(plan), [])
        contract['cases'] = []
        self.assertTrue(plan_errors(plan))

    def test_public_action_exemption_requires_reason_and_source_without_contradictory_cases(self):
        evidence = self.evidence('公开资料向所有访客开放查看，无访问限制。')
        reason = 'The source explicitly opens these documents to every visitor.'
        contract = {'nodeName': 'Actions', 'key': 'view', 'evidence': evidence, 'confirm': False, 'transitions': [],
                    'permissionDeniedNotApplicable': reason,
                    'cases': [self.case('view-public', 'permission-allowed', 'Actions')]}
        plan = {'path': '/public', 'components': [], 'actionContracts': [contract]}
        for invalid in ('', ' ', None, False, {}, []):
            with self.subTest(reason=invalid):
                contract['permissionDeniedNotApplicable'] = invalid
                self.assertTrue(any(e.get('pointer', '').endswith('/permissionDeniedNotApplicable') for e in plan_errors(plan)))
        contract['permissionDeniedNotApplicable'] = reason
        for invalid in (None, {}, {**evidence, 'quote': 'Invented public-access policy'}, {**evidence, 'sha256': '0' * 64}):
            with self.subTest(evidence=invalid):
                contract['evidence'] = invalid
                self.assertTrue(plan_errors(plan))
        contract['evidence'] = evidence
        contract['cases'].append(self.case('view-denied', 'permission-denied', 'Actions'))
        self.assertTrue(any('contradictory' in e['message'] for e in plan_errors(plan)))


if __name__ == '__main__':
    unittest.main()
