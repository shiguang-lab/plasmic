import copy
import html
import json
from pathlib import Path
import re
import unittest
from verify_selection import check_page, plan_errors


def spec(name, component, role, **extra):
    return {'nodeName': name, 'component': component, 'role': role, 'purpose': 'Source-reviewed business purpose',
            'source': 'requirement §Fields/Actions', 'rule': 'references/libraries/antd_v6/selection.md', **extra}


def node(name, component, values=None, body=''):
    return '<plasmic-component id="' + name + '" data-plasmic-name="' + name + '" data-plasmic-component="' + component + '" data-props="' + html.escape(json.dumps(values or {}), quote=True) + '">' + body + '</plasmic-component>'


class SelectionTests(unittest.TestCase):
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

    def test_status_column_and_badge_use_native_render_not_tag_preset(self):
        column, badge = 'plasmic-antd6-table-column', 'plasmic-antd6-badge'
        declarations = [spec('Status', column, 'status'), spec('Indicator', badge, 'status')]
        options = [{'value': 'ENABLED', 'label': '启用', 'status': 'success'},
                   {'value': 'DISABLED', 'label': '停用', 'status': 'default'}]
        mapped = {'value': '{{ cell }}', 'options': options}

        def column_with(values, display='custom'):
            render = '<slot name="render">' + node('Indicator', badge, values) + '</slot>'
            return node('Status', column, {'displayType': display, 'dataIndex': 'status'}, render)

        self.assertTrue(self.result(declarations, column_with(mapped))['passed'])
        self.assertFalse(self.result(declarations, column_with(mapped, 'tag'))['passed'])
        self.assertFalse(self.result(declarations[:1], node('Status', column, {'displayType': 'tag'}))['passed'])
        for wrong in ({'status': '{{ row.status }}', 'text': '{{ row.label }}'},
                      {**mapped, 'options': [{**options[0], 'status': 'blue'}]},
                      {**mapped, 'status': 'success'},
                      {**mapped, 'options': '{{ $state.options }}'},
                      {**mapped, 'color': '#52c41a'}, {**mapped, 'dot': True}, {**mapped, 'count': 1}):
            with self.subTest(wrong=wrong):
                result = self.result(declarations, column_with(wrong))
                self.assertFalse(result['passed'])
                self.assertTrue(any(e['check'] == 'statusPresentation' for e in result['errors']), result)
        self.assertTrue(self.result([declarations[1]], node('Indicator', badge, {'status': 'success', 'text': '启用'}))['passed'])
        self.assertFalse(self.result([declarations[1]], node('Indicator', badge, {'status': 'blue', 'text': 'x'}))['passed'])
        self.assertFalse(self.result([declarations[1]], node('Indicator', badge, {'count': 3}))['passed'])
        self.assertTrue(self.result([spec('Count', badge, 'count')], node('Count', badge, {'count': 3}))['passed'])

    def test_planned_status_badge_props_use_the_same_contract(self):
        badge = spec('Indicator', 'plasmic-antd6-badge', 'status')
        options = [{'value': 'ENABLED', 'label': '启用', 'status': 'success'}]
        self.assertEqual(plan_errors({'components': [{**badge, 'props': {'options': options}}], 'feedback': []}), [])
        for wrong in ({'options': [{**options[0], 'status': 'blue'}]}, {'options': options, 'status': 'success'},
                      {'options': options * 2}, {'color': 'green'}, {'dot': True}, {'count': 1}):
            with self.subTest(wrong=wrong):
                errors = plan_errors({'components': [{**badge, 'props': wrong}], 'feedback': []})
                self.assertTrue(errors)
                self.assertTrue(all(e['pointer'] == '/components/0/props' for e in errors))

    def test_category_preflight_requires_a_native_presentation_decision(self):
        column = spec('Type', 'plasmic-antd6-table-column', 'category')
        for display in ('text', 'custom'):
            with self.subTest(display=display):
                self.assertEqual(plan_errors({'components': [{**column, 'props': {'displayType': display}}], 'feedback': []}), [])
        for display in (None, 'tag', 'link', '{{ $state.display }}'):
            with self.subTest(display=display):
                self.assertTrue(plan_errors({'components': [{**column, 'props': {'displayType': display}}], 'feedback': []}))

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
                    declarations = [spec('Type', column, 'category', props={'displayType': expected})]
                    body = render if actual == 'custom' else ''
                    result = self.result(declarations, node('Type', column, {'displayType': actual, 'dataIndex': 'type'}, body))
                    self.assertEqual(result['passed'], expected == actual, result)
                    if expected != actual:
                        self.assertTrue(any(e['check'] == 'categoryPresentation' for e in result['errors']), result)

    def test_state_like_columns_require_status_role_or_reason(self):
        column = 'plasmic-antd6-table-column'
        for values in ({'dataIndex': 'status'}, {'dataIndex': 'auditState'}, {'dataIndex': 'order_status'},
                       {'dataIndex': ['user', 'status']}, {'dataIndex': 'name', 'title': '审核状态'}):
            with self.subTest(values=values):
                declaration = spec('Type', column, 'category', props={'displayType': 'text', **values})
                errors = plan_errors({'components': [declaration], 'feedback': []})
                self.assertEqual([(e['check'], e['pointer']) for e in errors], [('statusRole', '/components/0/role')])
                declaration['nonStatusReason'] = 'Address type label, not a lifecycle state'
                self.assertEqual(plan_errors({'components': [declaration], 'feedback': []}), [])
        for data_index in ('estate', 'statement'):
            with self.subTest(dataIndex=data_index):
                declaration = spec('Type', column, 'category', props={'displayType': 'text', 'dataIndex': data_index})
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
        declarations = [spec('Type', column, 'category', props={'displayType': 'custom'}),
                        spec('TypeHelp', tooltip, 'help', owner={'nodeName': 'Type', 'slot': 'render'})]
        render = '<slot name="render">' + node('TypeHelp', tooltip, body='<slot name="children"><span>{{ cell }}</span></slot>') + '</slot>'
        self.assertTrue(self.result(declarations, node('Type', column, {'displayType': 'custom'}, render))['passed'])

    def test_custom_category_checks_tag_ownership_and_actual_render(self):
        column, tag, tooltip = 'plasmic-antd6-table-column', 'plasmic-antd6-tag', 'plasmic-antd6-tooltip'
        declarations = [spec('Type', column, 'category', props={'displayType': 'custom'}),
                        spec('TypeHelp', tooltip, 'help', owner={'nodeName': 'Type', 'slot': 'render'}),
                        spec('TypeTag', tag, 'category', owner={'nodeName': 'TypeHelp', 'slot': 'children'})]
        label = node('TypeTag', tag, {'value': '{{ cell }}'})
        render = '<slot name="render">' + node('TypeHelp', tooltip, body='<slot name="children">' + label + '</slot>') + '</slot>'
        markup = node('Type', column, {'displayType': 'custom'}, render)
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
        declarations = [spec('Type', column, 'category', props={'displayType': 'custom'})]
        for render in ('', '<slot name="render"></slot>', '<slot name="render">   </slot>'):
            self.assertFalse(self.result(declarations, node('Type', column, {'displayType': 'custom'}, render))['passed'])
        declarations.append(spec('TitleTag', tag, 'category', owner={'nodeName': 'Type', 'slot': 'title'}))
        render = '<slot name="render">' + node('TitleTag', tag, {'value': '{{ cell }}'}) + '</slot>'
        result = self.result(declarations, node('Type', column, {'displayType': 'custom'}, render))
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
