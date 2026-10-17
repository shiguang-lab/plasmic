import json
import unittest
from verify_bindings import object_binding, role_menu


class BindingTests(unittest.TestCase):
    def test_flat_object_preserves_dynamic_disabled_for_exact_comparison(self):
        self.assertEqual(object_binding('{{ ({ disabled: $state.busy, loading: false }) }}'),
                         {'disabled': '{{ $state.busy }}', 'loading': False})

    def test_no_execution_or_ambiguous_object_shape(self):
        for value in ['{{ $state.buttons }}', '{{ ({ ...$state.buttons }) }}',
                      '{{ ({ [key]: true }) }}', '{{ ({ disabled: (sideEffect(), false) }) }}',
                      '{{ ({ disabled: false, disabled: true }) }}',
                      '{{ ({ style: {display: "none"} }) }}',
                      '{{ ({ disabled: $state.busy = false }) }}',
                      '{{ ({ disabled: $state.busy() }) }}',
                      '{{ ({ __proto__: $state.props }) }}',
                      '{{\u0085({ disabled: $state.busy }) }}',
                      '{{ ({ disabled:\u0085$state.busy }) }}',
                      '{{ ({ disabled: NaN }) }}']:
            with self.subTest(value=value), self.assertRaises(ValueError):
                object_binding(value)

    def test_quoted_binding_text_cannot_masquerade_as_a_read(self):
        for value in ['{{ ({ disabled: "{{ $state.busy }}" }) }}',
                      '{{ ({ disabled: "\\u007b\\u007b $state.busy }}" }) }}']:
            with self.subTest(value=value), self.assertRaises(ValueError):
                object_binding(value)

    def test_role_menu_program_is_proved_against_independent_literal_inventory(self):
        items = [{'key': 'records', 'label': 'Records', 'href': '/records'}]
        contract = {'state': 'role', 'query': 'role', 'default': 'Reader'}
        # Source fixture written independently from the compiler under test.
        expression = '''{{ (()=>{const map=items=>items.map(item=>({...item,...(item.href?{href:item.href+'?role='+encodeURIComponent(($state.role || $ctx.query?.role || 'Reader'))}:{}),...(item.children?{children:map(item.children)}:{})}));return map([{"key":"records","label":"Records","href":"/records"}]);})() }}'''
        self.assertEqual(role_menu(items, contract, expression), items)
        self.assertEqual(role_menu(items, contract, expression.replace(';return', ';\nreturn')), items)
        for broken in [expression.replace('/records', '/other'),
                       expression.replace('Reader', 'Administrator'),
                       expression.replace('encodeURIComponent', 'decodeURIComponent'),
                       expression.replace('$state.role || $ctx.query?.role', '$ctx.query?.role || $state.role'),
                       expression.replace('children:map(item.children)', 'children:[]'),
                       expression.replace('return map(', 'sideEffect();return map('),
                       expression.replace('const map', 'con st map'),
                       expression.replace('return map(', 'return\nmap('),
                       expression.replace('=>', '= >'),
                       expression.replace('||', '| |'),
                       expression.replace('?.', '? .'),
                       expression.replace('items=>', 'items\n=>'),
                       expression.replace('const map', 'const\u0085map'),
                       expression.replace("'Reader'", "'Read\\zer'")]:
            with self.subTest(broken=broken), self.assertRaises(ValueError):
                role_menu(items, contract, broken)
        prototype_menu = [{'key': 'records', 'label': 'Records', '__proto__': {'href': '/unexpected'}}]
        prototype_expression = expression.replace('[{"key":"records","label":"Records","href":"/records"}]', json.dumps(prototype_menu))
        with self.assertRaises(ValueError):
            role_menu(prototype_menu, contract, prototype_expression)
        for href in ['/records?view=all', '/records#section']:
            query_menu = [{**items[0], 'href': href}]
            with self.assertRaises(ValueError):
                role_menu(query_menu, contract, expression.replace('/records', href))
        for invalid in [{}, {**contract, 'extra': True}, {**contract, 'state': 'role()'}]:
            with self.assertRaises(ValueError):
                role_menu(items, invalid, expression)


if __name__ == '__main__':
    unittest.main()
