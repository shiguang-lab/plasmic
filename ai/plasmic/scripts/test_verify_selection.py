import copy
import html
import json
from pathlib import Path
import re
import unittest
from verify_selection import check_page, plan_errors


def spec(name, component, role, **extra):
    value = {'nodeName': name, 'component': component, 'role': role, 'purpose': 'Source-reviewed business purpose',
             'source': 'requirement §Fields/Actions', 'rule': 'references/libraries/antd_v6/selection.md', **extra}
    if component == 'plasmic-antd6-table-column':
        # Width is a separate plan decision covered by test_reference_plan; null keeps it unset.
        value['props'] = {'width': None, **value.get('props', {})}
        value.setdefault('presentation', 'text')
    return value


def node(name, component, values=None, body=''):
    return '<plasmic-component id="' + name + '" data-plasmic-name="' + name + '" data-plasmic-component="' + component + '" data-props="' + html.escape(json.dumps(values or {}), quote=True) + '">' + body + '</plasmic-component>'


class SelectionTests(unittest.TestCase):
    def test_controls_without_instance_size_pass_plan_and_saved_model_checks(self):
        for suffix, role in (('button', 'widget'), ('input', 'widget'), ('input-number', 'widget'),
                             ('select', 'field-choice'), ('date-range-picker', 'widget'),
                             ('segmented', 'field-choice'), ('tabs', 'content-scope')):
            with self.subTest(component=suffix):
                key = 'plasmic-antd6-' + suffix
                declaration = spec('Target', key, role)
                self.assertEqual(plan_errors({'components': [declaration], 'feedback': []}), [])
                self.assertTrue(self.result([declaration], node('Target', key))['passed'])

    def test_documented_selection_examples_pass_preflight(self):
        root = Path(__file__).resolve().parent.parent
        checked = 0
        for reference in ('references/design/source-presentation.md',
                          'references/libraries/antd_v6/selection.md'):
            for block in re.findall(r'```json\n(.*?)\n```', (root / reference).read_text(encoding="utf-8"), re.S):
                value = json.loads(block)
                if isinstance(value, list) and value and all('component' in item for item in value):
                    plan = {'components': value, 'feedback': []}
                elif isinstance(value, dict) and 'components' in value:
                    plan = value
                else:
                    continue
                with self.subTest(reference=reference, example=checked):
                    self.assertEqual(plan_errors(plan), [])
                checked += 1
        self.assertEqual(checked, 2)

    def result(self, components, markup, feedback=None, interactions=None):
        plan = {'path': '/records', 'components': components, 'feedback': feedback or [],
                'templates': [], 'templatesNotApplicable': 'Focused component-selection unit fixture, without a template composition'}
        page = {'type': 'page', 'pageMeta': {'path': '/records'}, 'baseVariantTplTree': markup, 'interactions': interactions or []}
        errors = check_page(plan, page)
        return {'passed': not errors, 'errors': errors}

    def test_wrong_self_consistent_selection_cannot_pass(self):
        # Actual model exactly matches the declared identity: the semantic role still fails.
        for role, wrong in [('status', 'tag'), ('submitted-form', 'descriptions'),
                            ('read-only-group', 'form'), ('content-scope', 'radio-group'),
                            ('field-choice', 'tabs'), ('confirmation', 'tooltip'),
                            ('action-menu', 'select'), ('query', 'form'), ('row-actions', 'button'),
                            ('empty-content', 'alert'), ('loading', 'empty')]:
            with self.subTest(role=role):
                key = 'plasmic-antd6-' + wrong
                self.assertFalse(self.result([spec('Target', key, role)], node('Target', key))['passed'])

    def test_status_column_and_badge_use_official_props_only(self):
        column, badge = 'plasmic-antd6-table-column', 'plasmic-antd6-badge'
        mapping = {'ENABLED': {'status': 'success', 'label': '启用'},
                   'DISABLED': {'status': 'default', 'label': '停用'}}
        declarations = [spec('Status', column, 'status', presentation='custom', statusMap=mapping),
                        spec('Indicator', badge, 'status')]
        expression = {'status': "{{ row.status === 'ENABLED' ? 'success' : 'default' }}", 'text': '{{ row.statusLabel }}'}

        def column_with(values, extra=None):
            render = '<slot name="render">' + node('Indicator', badge, values) + '</slot>'
            return node('Status', column, {'dataIndex': 'status', **(extra or {})}, render)

        self.assertTrue(self.result(declarations, column_with(expression))['passed'])
        # Non-official props are rejected outright.
        for wrong in ({**expression, 'value': '{{ row.status }}'},
                      {**expression, 'options': [{'value': 'ENABLED', 'label': '启用', 'status': 'success'}]},
                      {**expression, 'color': '#52c41a'}, {**expression, 'dot': True}, {**expression, 'count': 1}):
            with self.subTest(wrong=wrong):
                result = self.result(declarations, column_with(wrong))
                self.assertFalse(result['passed'])
                self.assertTrue([e for e in result['errors'] if e['check'] == 'statusPresentation'], result)
        # A literal status/text in a per-row column gives every row the same presentation.
        for wrong in ({'status': 'success', 'text': '{{ row.statusLabel }}'},
                      {'status': "{{ row.status === 'ENABLED' ? 'success' : 'default' }}", 'text': '启用'}):
            with self.subTest(wrong=wrong):
                self.assertFalse(self.result(declarations, column_with(wrong))['passed'])
        # The mapping table is part of the declaration and must be complete.
        self.assertFalse(self.result([declarations[0]], column_with(expression))['passed'])
        self.assertFalse(self.result([spec('Status', column, 'status', presentation='custom',
                                           statusMap={'ENABLED': {'status': 'blue', 'label': '启用'}})],
                                     column_with(expression))['passed'])
        # A retired preset prop is not a native Column prop.
        self.assertFalse(self.result(declarations, column_with(expression, {'displayType': 'tag'}))['passed'])
        self.assertFalse(self.result(declarations, node('Status', column, {'dataIndex': 'status'}))['passed'])
        # Detail/Descriptions status can follow the current record, just like a row.
        self.assertTrue(self.result([declarations[1]], node('Indicator', badge, {'status': 'success', 'text': '启用'}))['passed'])
        self.assertTrue(self.result([declarations[1]], node('Indicator', badge, {
            'status': "{{ $state.record.enabled ? 'success' : 'default' }}",
            'text': '{{ $state.record.statusLabel }}'}))['passed'])
        self.assertFalse(self.result([declarations[1]], node('Indicator', badge, {'status': 'success', 'text': ''}))['passed'])
        self.assertFalse(self.result([declarations[1]], node('Indicator', badge, {'text': '{{ $state.record.statusLabel }}'}))['passed'])
        self.assertFalse(self.result([declarations[1]], node('Indicator', badge, {'status': 'blue', 'text': 'x'}))['passed'])
        self.assertTrue(self.result([spec('Count', badge, 'count')], node('Count', badge, {'count': 3}))['passed'])

    def test_planned_status_badge_props_use_the_same_contract(self):
        badge = spec('Indicator', 'plasmic-antd6-badge', 'status')
        expression = {'status': "{{ row.status === 'ENABLED' ? 'success' : 'default' }}", 'text': '{{ row.label }}'}
        self.assertEqual(plan_errors({'components': [{**badge, 'props': expression}], 'feedback': []}), [])
        self.assertEqual(plan_errors({'components': [{**badge, 'props': {'status': 'success', 'text': '启用'}}], 'feedback': []}), [])
        for wrong in ({'value': '{{ row.status }}', 'options': [{'value': 'ENABLED', 'label': '启用', 'status': 'success'}]},
                      {'color': 'green'}, {'dot': True}, {'count': 1}):
            with self.subTest(wrong=wrong):
                self.assertTrue(plan_errors({'components': [{**badge, 'props': wrong}], 'feedback': []}))

    def test_category_preflight_requires_a_native_presentation_decision(self):
        column = spec('Type', 'plasmic-antd6-table-column', 'category')
        for display in ('text', 'custom'):
            with self.subTest(display=display):
                self.assertEqual(plan_errors({'components': [{**column, 'presentation': display}], 'feedback': []}), [])
        for display in (None, 'tag', 'link', '{{ $state.display }}'):
            with self.subTest(display=display):
                self.assertTrue(plan_errors({'components': [{**column, 'presentation': display}], 'feedback': []}))
        missing = {k: v for k, v in column.items() if k != 'presentation'}
        self.assertTrue(plan_errors({'components': [missing], 'feedback': []}))
        status = spec('State', 'plasmic-antd6-table-column', 'status', presentation='text',
                      statusMap={'ON': {'status': 'success', 'label': '启用'}})
        self.assertTrue(any(e['pointer'] == '/components/0/presentation'
                            for e in plan_errors({'components': [status], 'feedback': []})))

    def test_plan_rejects_removed_column_presets_for_any_role(self):
        column = spec('Profile', 'plasmic-antd6-table-column', 'widget', props={'dataIndex': 'url', 'displayType': 'link'})
        errors = plan_errors({'components': [column], 'feedback': []})
        self.assertEqual([e['pointer'] for e in errors], ['/components/0/props/displayType'])

    def test_category_text_and_tag_are_independent_source_choices(self):
        column = 'plasmic-antd6-table-column'
        render = '<slot name="render"><span>{{ cell }}</span></slot>'
        for expected in ('text', 'custom'):
            for actual in ('text', 'custom', 'tag', 'link'):
                with self.subTest(expected=expected, actual=actual):
                    declarations = [spec('Type', column, 'category', presentation=expected)]
                    body = render if actual == 'custom' else ''
                    retired = {'displayType': actual} if actual in ('tag', 'link') else {}
                    result = self.result(declarations, node('Type', column, {'dataIndex': 'type', **retired}, body))
                    self.assertEqual(result['passed'], expected == actual, result)
                    if expected != actual:
                        self.assertTrue(any(e['check'] == 'categoryPresentation' for e in result['errors']), result)

    def test_state_like_columns_require_status_role_or_reason(self):
        column = 'plasmic-antd6-table-column'
        for values in ({'dataIndex': 'status'}, {'dataIndex': 'auditState'}, {'dataIndex': 'order_status'},
                       {'dataIndex': ['user', 'status']}, {'dataIndex': 'name', 'title': '审核状态'}):
            with self.subTest(values=values):
                declaration = spec('Type', column, 'category', props=values)
                errors = plan_errors({'components': [declaration], 'feedback': []})
                self.assertEqual([(e['check'], e['pointer']) for e in errors], [('statusRole', '/components/0/role')])
                declaration['nonStatusReason'] = 'Address type label, not a lifecycle state'
                self.assertEqual(plan_errors({'components': [declaration], 'feedback': []}), [])
        for data_index in ('estate', 'statement'):
            with self.subTest(dataIndex=data_index):
                declaration = spec('Type', column, 'category', props={'dataIndex': data_index})
                self.assertEqual(plan_errors({'components': [declaration], 'feedback': []}), [])
        declarations = [spec('Audit', column, 'widget')]
        markup = node('Audit', column, {'dataIndex': 'result'}, '<slot name="title"><span>状态</span></slot>')
        result = self.result(declarations, markup)
        self.assertFalse(result['passed'])
        self.assertTrue(any(e['check'] == 'statusRole' for e in result['errors']), result)
        declarations[0]['nonStatusReason'] = 'Audit outcome note, not a lifecycle state'
        self.assertTrue(self.result(declarations, markup)['passed'])

    def test_custom_category_text_supports_tooltip_without_requiring_tag(self):
        column, tooltip = 'plasmic-antd6-table-column', 'plasmic-antd6-tooltip'
        declarations = [spec('Type', column, 'category', presentation='custom'),
                        spec('TypeHelp', tooltip, 'help', owner={'nodeName': 'Type', 'slot': 'render'})]
        render = '<slot name="render">' + node('TypeHelp', tooltip, body='<slot name="children"><span>{{ cell }}</span></slot>') + '</slot>'
        self.assertTrue(self.result(declarations, node('Type', column, {}, render))['passed'])

    def test_custom_category_checks_tag_ownership_and_actual_render(self):
        column, tag, tooltip = 'plasmic-antd6-table-column', 'plasmic-antd6-tag', 'plasmic-antd6-tooltip'
        declarations = [spec('Type', column, 'category', presentation='custom'),
                        spec('TypeHelp', tooltip, 'help', owner={'nodeName': 'Type', 'slot': 'render'}),
                        spec('TypeTag', tag, 'category', owner={'nodeName': 'TypeHelp', 'slot': 'children'})]
        label = node('TypeTag', tag, body='<slot name="children"><span>{{ cell }}</span></slot>')
        render = '<slot name="render">' + node('TypeHelp', tooltip, body='<slot name="children">' + label + '</slot>') + '</slot>'
        markup = node('Type', column, {}, render)
        self.assertTrue(self.result(declarations, markup)['passed'])
        # Neither an ordinary text replacement nor a Tag elsewhere is evidence
        # of the reviewed Tag in the Column's actual render Slot.
        for wrong in (markup.replace(label, '<span>{{ cell }}</span>'),
                      markup.replace(label, '') + label,
                      markup.replace('name="render"', 'name="title"')):
            result = self.result(declarations, wrong)
            self.assertFalse(result['passed'])
            self.assertTrue(any(e['check'] == 'categoryPresentation' for e in result['errors']))
        declarations[1]['owner']['slot'] = 'title'
        result = self.result(declarations, markup)
        self.assertFalse(result['passed'])
        self.assertTrue(any(e['check'] == 'categoryPresentation' for e in result['errors']))

    def test_custom_text_category_cannot_be_empty_or_gain_an_unplanned_tag(self):
        column, tag = 'plasmic-antd6-table-column', 'plasmic-antd6-tag'
        declarations = [spec('Type', column, 'category', presentation='custom')]
        for render in ('', '<slot name="render"></slot>', '<slot name="render">   </slot>'):
            self.assertFalse(self.result(declarations, node('Type', column, {}, render))['passed'])
        declarations.append(spec('TitleTag', tag, 'category', owner={'nodeName': 'Type', 'slot': 'title'}))
        render = '<slot name="render">' + node('TitleTag', tag, body='<slot name="children"><span>{{ cell }}</span></slot>') + '</slot>'
        result = self.result(declarations, node('Type', column, {}, render))
        self.assertFalse(result['passed'])
        self.assertTrue(any(e['check'] == 'categoryPresentation' for e in result['errors']))

    def test_undeclared_hidden_widget_and_widget_escape_are_rejected(self):
        markup = '<div hidden>' + node('Notice', 'plasmic-antd6-alert') + '</div>'
        self.assertFalse(self.result([], markup)['passed'])
        self.assertFalse(self.result([spec('Notice', 'plasmic-antd6-alert', 'widget')], markup)['passed'])
        valid = spec('Notice', 'plasmic-antd6-alert', 'persistent-feedback', condition='Data unavailable until a successful retry')
        self.assertTrue(self.result([valid], markup)['passed'])
        del valid['condition']
        self.assertFalse(self.result([valid], markup)['passed'])
        self.assertTrue(self.result([], '<div data-editable="false">' + markup + '</div>')['passed'])

    def test_missing_duplicate_or_extra_inventory_targets_fail(self):
        entry = spec('Save', 'plasmic-antd6-button', 'widget')
        markup = node('Save', 'plasmic-antd6-button')
        self.assertTrue(self.result([entry], markup)['passed'])
        self.assertFalse(self.result([entry], '')['passed'])
        self.assertFalse(self.result([entry], markup + markup)['passed'])
        self.assertFalse(self.result([entry, entry], markup)['passed'])
        self.assertFalse(self.result([], markup)['passed'])

    def test_feedback_is_checked_on_exact_event_owner(self):
        button = spec('Save', 'plasmic-antd6-button', 'widget')
        feedback = [{'nodeName': 'Save', 'event': 'onClick', 'kind': 'transient', 'source': 'requirement §Save',
                     'success': 'Save succeeds and Message disappears', 'failure': 'Error Message; data unchanged'}]
        wrong = node('Save', button['component'], {'onClick': '{{ () => $state.notice = "Saved" }}'})
        self.assertFalse(self.result([button], wrong, feedback)['passed'])
        handler = '{{ () => $globalActions["plasmic-antd6-config-provider.showMessage"]("success", "Saved", 3) }}'
        valid = node('Save', button['component'], {'onClick': handler})
        self.assertTrue(self.result([button], valid, feedback)['passed'])
        self.assertFalse(self.result([button], valid.replace('onClick', 'onFocus'), feedback)['passed'])
        self.assertFalse(self.result([button], valid.replace('showMessage', 'showNotification'), feedback)['passed'])
        interaction = {'__type': 'Interaction', 'uuid': 'save-message', 'name': 'Save result',
                       'elementUuid': 'Save', 'eventName': 'onClick', 'actionName': 'customFunction', 'code': handler}
        self.assertTrue(self.result([button], node('Save', button['component']), feedback, [interaction])['passed'])
        interaction['elementUuid'] = 'Other'
        self.assertFalse(self.result([button], node('Save', button['component']), feedback, [interaction])['passed'])

    def test_feedback_rejects_unqualified_nested_and_noncall_mentions(self):
        button = spec('Save', 'plasmic-antd6-button', 'widget')
        feedback = [{'nodeName': 'Save', 'event': 'onClick', 'kind': 'transient', 'source': 'requirement §Save',
                     'success': 'One success Message', 'failure': 'One error Message'}]
        qualified = '$globalActions["plasmic-antd6-config-provider.showMessage"]'
        for code in (
            'try { $globalActions.showMessage("success", "Saved", 3) } catch(e) {}',
            '$globalActions["showMessage"]("success", "Saved", 3)',
            '$globalActions["plasmic-antd6-config-provider"].showMessage("success", "Saved", 3)',
            '$globalActions["plasmic-antd6-config-provider"]["showMessage"]("success", "Saved", 3)',
            '$globalActions["another-provider.showMessage"]("success", "Saved", 3)',
            qualified,
            '// ' + qualified + '("success", "Saved", 3)',
            '/* ' + qualified + '("success", "Saved", 3) */',
            json.dumps(qualified + '("success", "Saved", 3)'),
        ):
            with self.subTest(code=code):
                self.assertFalse(self.result([button], node('Save', button['component'], {'onClick': code}), feedback)['passed'])
        single_quoted = "{{ () => $globalActions [ 'plasmic-antd6-config-provider.showMessage' ] (\"success\", \"Saved\", 3) }}"
        self.assertTrue(self.result([button], node('Save', button['component'], {'onClick': single_quoted}), feedback)['passed'])

    def test_feedback_accepts_real_native_global_action_steps(self):
        button = spec('Save', 'plasmic-antd6-button', 'widget')
        markup = node('Save', button['component'])
        for kind, action, content_arg in [('transient', 'showMessage', 'content'),
                                          ('asynchronous', 'showNotification', 'message')]:
            feedback = [{'nodeName': 'Save', 'event': 'onClick', 'kind': kind, 'source': 'requirement §Save',
                         'success': 'Visible provider feedback', 'failure': 'Visible error feedback'}]
            interaction = {'__type': 'Interaction', 'uuid': 'save-feedback', 'name': 'Save feedback',
                           'elementUuid': 'Save', 'eventName': 'onClick',
                           'actionName': 'plasmic-antd6-config-provider.' + action,
                           'args': {'type': 'success', content_arg: 'Saved', 'duration': 3}}
            with self.subTest(kind=kind):
                self.assertTrue(self.result([button], markup, feedback, [interaction])['passed'])
                for wrong in ('globalAction', action, 'another-provider.' + action):
                    invalid = {**interaction, 'actionName': wrong, 'globalAction': interaction['actionName']}
                    self.assertFalse(self.result([button], markup, feedback, [invalid])['passed'])
                self.assertFalse(self.result([button], markup, feedback, [{**interaction, 'conditionalMode': 'never'}])['passed'])
                self.assertFalse(self.result([button], markup, feedback, [{**interaction, '__type': 'globalAction'}])['passed'])

    def test_plan_preflight_requires_rules_and_feedback_cases(self):
        plan = {'components': [spec('Save', 'plasmic-antd6-button', 'widget')], 'feedback': []}
        self.assertEqual(plan_errors(plan), [])
        for bad in ['references/missing.md', '../secrets', '/tmp/rules.md']:
            current = copy.deepcopy(plan); current['components'][0]['rule'] = bad
            self.assertTrue(plan_errors(current))
        del plan['feedback']
        self.assertTrue(plan_errors(plan))


class PageTypeTests(unittest.TestCase):
    def owned(self, name, component, role, owner, **extra):
        return spec(name, component, role, owner={'nodeName': owner, 'slot': 'children'}, **extra)

    def list_page(self):
        return {'pageType': 'list', 'components': [
            spec('Shell', 'plasmic-overseas-app-shell', 'shell'),
            self.owned('PageBody', 'plasmic-antd6-flex', 'widget', 'Shell', props={'vertical': True, 'gap': 16}),
            self.owned('Filters', 'plasmic-overseas-search-form', 'query', 'PageBody'),
            self.owned('ListCard', 'plasmic-antd6-card', 'surface', 'PageBody'),
            self.owned('Results', 'plasmic-antd6-table', 'data-table', 'ListCard')]}

    def test_page_type_does_not_invent_filters_or_duplicate_shared_tables(self):
        for kind, components in [
            ('list', [spec('Records', 'plasmic-antd6-table', 'data-table', props={'scroll': {'x': 1000}, 'pagination': False})]),
            ('tabbed-list', [spec('Scopes', 'plasmic-antd6-tabs', 'content-scope'),
                             spec('Records', 'plasmic-antd6-table', 'data-table', props={'scroll': {'x': 1000}, 'pagination': False})]),
            ('result', [spec('Outcome', 'plasmic-antd6-result', 'page-result'),
                        spec('FailedRecords', 'plasmic-antd6-table', 'data-table', props={'scroll': {'x': 1000}, 'pagination': False})])]:
            with self.subTest(pageType=kind):
                page = {'pageType': kind, 'components': components, 'feedback': []}
                self.assertEqual(plan_errors(page), [])
        page['pageType'] = 'unknown-type'
        self.assertIn('pageType', [e['check'] for e in plan_errors(page)])

    def test_page_body_accepts_a_natural_language_source_override(self):
        import hashlib
        import tempfile
        from verify_selection import page_body_errors
        page = self.list_page()
        body = page['components'][1]
        body['props']['gap'] = 24
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'requirement.md'
            quote = '页面区域间距为24像素，纵向排列。'
            source.write_text(quote, encoding='utf-8')
            body['overrides'] = {'gap': {'reason': 'Current source specifies spacing', 'evidence': {
                'path': str(source), 'sha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'quote': quote}}}
            self.assertEqual(page_body_errors(page), [])
            source.write_text('页面包含列表。', encoding='utf-8')
            self.assertTrue(page_body_errors(page))

    def test_page_body_gap_comes_from_the_scale(self):
        from verify_selection import page_body_errors
        page = self.list_page()
        self.assertEqual(page_body_errors(page), [])
        page['components'][1]['props']['gap'] = 24
        errors = page_body_errors(page)
        self.assertEqual([e['check'] for e in errors], ['pageBody'])

if __name__ == "__main__":
    unittest.main()
