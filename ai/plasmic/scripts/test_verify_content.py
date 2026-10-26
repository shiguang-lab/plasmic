import copy
import html
import json
import unittest

from verify_content import check_page, inventory, plan_errors
from verify_selection import check as preflight


def component(name, registration, values=None, body=''):
    return (f'<plasmic-component id="{name}" data-plasmic-name="{name}" '
            f'data-plasmic-component="{registration}" data-props="{html.escape(json.dumps(values or {}), quote=True)}">'
            + body + '</plasmic-component>')


class ContentTests(unittest.TestCase):
    def setUp(self):
        self.help = '填写 SQL 查询；返回成员 uid 列。'
        self.markup = component('QueryField', 'plasmic-antd6-form-item', {'rules': [{'message': '请填写查询'}]},
            '<slot name="label"><span id="label" data-plasmic-name="QueryLabel">SQL 查询</span></slot>'
            '<slot name="description"><span id="help" data-plasmic-name="QueryHelp">' + self.help + '</span></slot>')
        self.plan = {
            'path': '/query', 'components': [],
            'nodes': [
                {'nodeName': 'QueryField', 'component': 'plasmic-antd6-form-item', 'owner': None,
                 'purpose': 'Query field', 'source': 'REQ §SQL input'},
                {'nodeName': 'QueryLabel', 'tag': 'span', 'owner': {'nodeName': 'QueryField', 'slot': 'label'},
                 'purpose': 'Query label', 'source': 'REQ §SQL input'},
                {'nodeName': 'QueryHelp', 'tag': 'span', 'owner': {'nodeName': 'QueryField', 'slot': 'description'},
                 'purpose': 'Explain query output shape before submission', 'source': 'REQ §SQL input'}],
            'copy': {'source': 'REQ §SQL input interpreted for user entry', 'excluded': [], 'entries': [
                self.entry('QueryField', '/props/rules/0/message', '请填写查询', 'feedback'),
                self.entry('QueryLabel', '/text', 'SQL 查询', 'label', 'fieldLabel'),
                self.entry('QueryHelp', '/text', self.help, 'help')]}}

    def entry(self, name, at, value, kind, role=None):
        entry = {'nodeName': name, 'at': at, 'text': value, 'kind': kind,
                 'purpose': 'Support entering and submitting the SQL query', 'source': 'REQ §SQL input'}
        return {**entry, 'role': role} if role else entry
    def test_role_refines_kind_and_other_needs_a_reason(self):
        from verify_content import copy_role
        self.assertEqual(copy_role({'kind': 'action'}), 'button')
        self.assertEqual(copy_role({'kind': 'label', 'role': 'columnTitle'}), 'columnTitle')
        self.plan['copy']['entries'][2]['role'] = 'other'
        self.assertIn('roleReason', json.dumps(plan_errors(self.plan)))
        self.plan['copy']['entries'][2]['roleReason'] = 'Generated SQL sample, not prose'
        self.assertEqual(plan_errors(self.plan), [])
        self.plan['copy']['entries'][2]['role'] = 'banner'
        self.assertIn('/role', json.dumps(plan_errors(self.plan)))

    def result(self, markup=None, plan=None):
        return check_page(plan or self.plan, {'baseVariantTplTree': self.markup if markup is None else markup})

    def test_source_reviewed_help_can_contain_technical_terms(self):
        self.assertEqual(plan_errors(self.plan), [])
        self.assertTrue(self.result()['passed'])

    def test_empty_copy_inventory_does_not_exempt_authored_descriptions(self):
        self.plan['copy']['entries'] = []
        errors = self.result()['errors']
        self.assertEqual(len([e for e in errors if e['check'] == 'copyCoverage']), 3)
        self.assertTrue(any(e.get('slot') == 'description' for e in errors))

    def test_extra_changed_missing_or_moved_copy_all_fail(self):
        for markup in [self.markup.replace(self.help, '新增未审查的说明'),
                       self.markup.replace(self.help, ''),
                       self.markup.replace('data-plasmic-name="QueryHelp"', 'data-plasmic-name="OtherHelp"'),
                       self.markup + '<div hidden><span data-plasmic-name="HiddenHelp">请联系后台接口</span></div>']:
            with self.subTest(markup=markup):
                self.assertTrue(any(e['check'] == 'copyCoverage' for e in self.result(markup)['errors']))

    def test_correct_text_moved_to_a_different_field_still_fails(self):
        markup = self.markup.replace('QueryField', 'SourceField')
        self.plan['nodes'][0]['nodeName'] = 'SourceField'
        self.plan['copy']['entries'][0]['nodeName'] = 'SourceField'
        errors = self.result(markup)['errors']
        self.assertTrue(any(e['check'] == 'namingCoverage' and e.get('expectedOwner', {}).get('nodeName') == 'QueryField' for e in errors))

    def test_pascal_case_serial_renames_cannot_discharge_unreviewed_nodes(self):
        for serial in ('CellText01', 'Label012', 'Content99'):
            markup = self.markup.replace('QueryHelp', serial)
            errors = self.result(markup)['errors']
            self.assertTrue(any(e['check'] == 'namingCoverage' and e.get('nodeName') == serial for e in errors))

    def test_meaningful_numbers_are_not_blacklisted(self):
        self.markup = self.markup.replace('QueryHelp', 'IPv6Help')
        self.plan['nodes'][2].update(nodeName='IPv6Help', purpose='Explain IPv6 output constraints')
        self.plan['copy']['entries'][2]['nodeName'] = 'IPv6Help'
        self.assertTrue(self.result()['passed'])

    def test_missing_name_diagnostic_retains_native_context(self):
        markup = self.markup.replace(' data-plasmic-name="QueryHelp"', '')
        error = next(e for e in self.result(markup)['errors'] if e['check'] == 'namingCoverage' and e.get('elementUuid') == 'help')
        self.assertEqual(error['owner'], {'nodeName': 'QueryField', 'slot': 'description'})
        self.assertEqual(error['text'], self.help)

    def test_readonly_inherited_branches_are_not_task_authored(self):
        markup = self.markup + '<div data-editable="false" id="library"><span id="internal">默认文字</span></div>'
        self.assertTrue(self.result(markup)['passed'])

    def test_native_options_bindings_slots_and_custom_copy_props(self):
        values = {'options': [{'value': 'key', 'label': '启用'}], 'placeholder': '{{ $state.hint }}',
                  'customCaption': '自定义契约说明', 'onChange': '{{ console.log("不是文案") }}',
                  'data': [{'label': '模拟数据'}]}
        markup = component('Chooser', 'example-choice', values, '<slot name="description">选择状态</slot>')
        declarations = [{'nodeName': 'Chooser', 'component': 'example-choice', 'copyProps': ['/customCaption']}]
        captured = inventory({'baseVariantTplTree': markup}, declarations)['copy']
        self.assertEqual({(c['at'], c['text']) for c in captured}, {
            ('/props/options/0/label', '启用'), ('/props/placeholder', '{{ $state.hint }}'),
            ('/props/customCaption', '自定义契约说明'), ('/slots/description/text', '选择状态')})

    def test_native_placeholder_or_dynamic_binding_change_fails(self):
        self.plan['copy']['entries'].append(self.entry('QueryField', '/props/placeholder', '{{ $state.queryHint }}', 'placeholder'))
        markup = self.markup.replace('&quot;rules&quot;', '&quot;placeholder&quot;:&quot;{{ $state.queryHint }}&quot;,&quot;rules&quot;')
        self.assertTrue(self.result(markup)['passed'])
        self.assertFalse(self.result(markup.replace('$state.queryHint', '$state.internalNote'))['passed'])

    def test_all_named_node_kinds_require_review(self):
        for extra in ['<div id="layout" data-plasmic-name="Toolbar"></div>',
                      component('Layout', 'plasmic-antd6-flex'),
                      '<span data-plasmic-name="OtherLabel">文字</span>']:
            self.assertTrue(any(e['check'] == 'namingCoverage' for e in self.result(self.markup + extra)['errors']))

    def test_plan_checks_missing_coverage_shape_and_duplicate_locations(self):
        original = copy.deepcopy(self.plan)
        for mutation in [lambda p: p.pop('nodes'), lambda p: p['copy'].pop('entries'),
                         lambda p: p['nodes'][2].pop('purpose'), lambda p: p['nodes'][2].pop('owner'),
                         lambda p: p['nodes'].append(dict(p['nodes'][0])),
                         lambda p: p['copy']['entries'].append(dict(p['copy']['entries'][0]))]:
            plan = copy.deepcopy(original)
            mutation(plan)
            self.assertTrue(plan_errors(plan))

    def test_nonstandard_visible_props_cannot_be_declared_without_copy_review(self):
        self.plan['nodes'][0]['copyProps'] = ['/caption']
        self.assertTrue(any(e.get('at') == '/props/caption' for e in plan_errors(self.plan)))
        self.plan['copy']['entries'].append(self.entry('QueryField', '/props/caption', '查询', 'label'))
        self.assertEqual(plan_errors(self.plan), [])
        self.assertFalse(self.result()['passed'])  # The declared prop is absent in the real model.

    def test_excluded_source_prose_cannot_be_approved_as_ui_copy(self):
        self.plan['copy']['excluded'] = [{'text': self.help, 'source': 'Source review excludes this sentence here'}]
        self.assertTrue(any(e['check'] == 'uiCopy' for e in self.result()['errors']))

    def test_full_preflight_requires_source_content_declarations(self):
        # Fragment-only selection checks remain usable for role diagnostics;
        # the Page preflight must reject omission of the content review itself.
        plan = {'path': '/records', 'components': [], 'feedback': [], 'templates': [],
                'templatesNotApplicable': 'Focused input-format test'}
        self.assertTrue(any(e['check'] == 'contentPlan' for e in preflight({'pages': [plan]})['errors']))


if __name__ == '__main__':
    unittest.main()
