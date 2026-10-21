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
        self.path.write_text(text)
        return {'path': str(self.path), 'sha256': hashlib.sha256(self.path.read_bytes()).hexdigest(), 'quote': text}

    def page(self, markup):
        return {'type': 'page', 'pageMeta': {'path': '/groups'}, 'baseVariantTplTree': markup}

    def test_native_defaults_and_explicit_equal_values_pass(self):
        for key, values in BASELINES.items():
            spec = {'nodeName': 'Widget', 'component': key}
            self.assertEqual(policy_errors(spec, {}), [])
            # Nested dropdown props use their native nesting.
            actual = {k: v for k, v in values.items() if '.' not in k}
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
        self.assertEqual(policy_errors(spec, {'max': 5}), [])
        self.assertTrue(policy_errors(spec, {'max': 6}))
        self.path.write_text('Requirement changed after planning')
        self.assertTrue(policy_errors(spec, {'max': 5}))

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

    def test_explicit_click_requirement_uses_the_native_action_group_array(self):
        evidence = self.evidence('触屏设备上点击打开更多操作。')
        spec = {'component': 'plasmic-react-ui-action-group', 'props': {'dropdownProps': {'trigger': ['click']}},
                'overrides': {'dropdownProps.trigger': {'reason': 'Explicit touch interaction', 'evidence': evidence}}}
        self.assertEqual(policy_errors(spec, spec['props']), [])
        self.assertTrue(policy_errors(spec, {'dropdownProps': {'trigger': ['contextMenu']}}))

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
            'Results', 'plasmic-antd6-table', {'data': '{{ {data:$state.rows.filter(row => row.app_source === $state.appSource)} }}'})

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
        values = {'pagination': {'pageSizeOptions': [20, 50, 100]}}
        self.assertTrue(check_page({}, self.page(node('Table', 'plasmic-antd6-table', values))))
        values['pagination']['showSizeChanger'] = True
        self.assertEqual(check_page({}, self.page(node('Table', 'plasmic-antd6-table', values))), [])

    def test_fixed_size_pagers_still_require_page_change_cases(self):
        evidence = self.evidence('列表每页20条，必须能够翻页查看不同记录。')
        for component, values in [('plasmic-antd6-table', {'pagination': {'defaultPageSize': 20}}),
                                  ('plasmic-antd6-pagination', {'defaultPageSize': 20}),
                                  ('plasmic-antd6-pagination', {'pageSizeOptions': [20]})]:
            with self.subTest(component=component, values=values):
                plan = {'path': '/groups', 'components': [{'nodeName': 'Results', 'component': component,
                         'role': 'pagination', 'props': values}], 'runtimeCases': []}
                self.assertTrue(plan_errors(plan))
                plan['runtimeCases'] = [{'id': 'second-page', 'kind': 'page-change', 'nodeName': 'Results',
                    'evidence': evidence, 'given': {'current': 2, 'pageSize': 20},
                    'checks': [{'kind': 'text', 'text': 'record-21', 'present': True}]}]
                self.assertEqual(plan_errors(plan), [])
                plan['runtimeCases'][0]['nodeName'] = 'OtherPager'
                self.assertTrue(plan_errors(plan))

    def test_adjustable_pagers_require_page_size_and_page_change_separately(self):
        evidence = self.evidence('列表支持翻页及每页条数切换。')
        for component, values in [('plasmic-antd6-table', {'pagination': {'pageSizeOptions': [20, 50, 100]}}),
                                  ('plasmic-antd6-table', {'pagination': {'showSizeChanger': True}}),
                                  ('plasmic-antd6-table', {'pagination': {'pageSizeOptions': '{{ $state.pageSizes }}'}}),
                                  ('plasmic-antd6-pagination', {'pageSizeOptions': [20, 50, 100]}),
                                  ('plasmic-antd6-pagination', {'showSizeChanger': True}),
                                  ('plasmic-antd6-pagination', {'pageSizeOptions': '{{ $state.pageSizes }}'})]:
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
            'Results', 'plasmic-antd6-table', {'data': '{{ {data:$state.rows.filter(r => r.app_source === $state.shell.appSource)} }}'}))
        page['states'] = [{'name': 'shell.appSource', 'elementUuid': 'Shell', 'variableType': 'text'}]
        self.assertEqual(check_page(plan, page), [])

    def test_native_state_actions_and_query_arguments_keep_their_real_contracts(self):
        plan = self.context_plan(self.evidence('app_source 是当前工作 App。'))
        plan['appContext']['consumers'][0]['queryName'] = 'GroupList'
        page = self.page(node('Shell', 'plasmic-overseas-app-shell', {'appSources': [{'value': 'A'}], 'appSource': '{{ $state.appSource }}'})
                         + node('Results', 'plasmic-antd6-table', {'data': '{{ $q.groupList }}'}))
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
        markup = node('Actions', 'plasmic-react-ui-action-group', {'items': [{'key': 'enable', 'label': '启用'}]})
        self.assertTrue(check_page(plan, self.page(markup)))
        markup = node('Actions', 'plasmic-react-ui-action-group', {'items': [{'key': 'enable', 'label': '启用', 'confirm': {'title': '确认启用？'}}]})
        self.assertEqual(check_page(plan, self.page(markup)), [])


if __name__ == '__main__':
    unittest.main()
