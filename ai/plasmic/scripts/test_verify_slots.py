import unittest
import json
from pathlib import Path
import subprocess
import sys
import tempfile

from verify_slots import check


TABS = '<plasmic-component data-plasmic-name="scopeTabs" data-plasmic-component="plasmic-antd6-tabs"></plasmic-component>'
CARD = '<plasmic-component data-plasmic-name="listCard" data-plasmic-component="plasmic-antd6-card"><slot name="children">' + TABS + '</slot></plasmic-component>'


class CardOwnershipTests(unittest.TestCase):
    def assert_only(self, result, field):
        self.assertFalse(result['passed'])
        self.assertTrue(result[field])
        self.assertTrue(all(not value for key, value in result.items() if key not in {field, 'passed'}), result)

    def test_duplicate_names_cannot_hide_a_wrong_component(self):
        bad = TABS.replace('plasmic-antd6-tabs', 'plasmic-antd6-input')
        self.assert_only(check(CARD, bad + CARD), 'duplicateComponents')
        self.assert_only(check(TABS + CARD, CARD), 'duplicateComponents')

    def test_duplicate_slots_cannot_shadow_reviewed_content(self):
        actual = CARD.replace('</slot></plasmic-component>', '</slot><slot name="children"><span>Replacement</span></slot></plasmic-component>')
        self.assert_only(check(CARD, actual), 'duplicateSlots')
        self.assert_only(check(actual, CARD), 'duplicateSlots')
        self.assertTrue(check(CARD, CARD)['passed'])

    def test_text_only_card_content_is_not_empty(self):
        text = CARD.replace(TABS, 'Summary')
        self.assertTrue(check(text, text)['passed'])
        self.assert_only(check(text, text.replace('Summary', ' \n ')), 'emptyCards')


    def test_unprovided_content_without_uuid_and_plain_text_are_not_empty(self):
        for child in ['<span>Example</span>', 'Example']:
            actual = CARD.replace('</plasmic-component>', '<slot name="title">' + child + '</slot></plasmic-component>', 1)
            with self.subTest(child=child):
                self.assert_only(check(CARD, actual), 'unprovidedSlotChildren')
        actual = CARD.replace('</plasmic-component>', '<slot name="title"> \n </slot></plasmic-component>', 1)
        self.assertTrue(check(CARD, actual)['passed'])

    def test_empty_intent_cannot_disable_the_gate(self):
        for intent in ['', ' \n', '<div></div>']:
            with self.subTest(intent=intent):
                self.assert_only(check(intent, CARD), 'intentErrors')

    def test_card_padding_preserves_json_types(self):
        expected = CARD.replace('data-plasmic-name="listCard"', '''data-plasmic-name="listCard" data-props='{"styles":{"body":{"padding":0}}}' ''')
        self.assertTrue(check(expected, expected)['passed'])
        self.assert_only(check(expected, expected.replace('"padding":0', '"padding":false')), 'wrongCardPadding')

    def test_allow_defaults_inspection_cannot_hide_structural_errors(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            intent, model = root / 'intent.html', root / 'pages.json'
            duplicate_slot = CARD.replace('</slot></plasmic-component>', '</slot><slot name="children"><span>Replacement</span></slot></plasmic-component>')
            for field, expected, actual in [('duplicateComponents', CARD, TABS + CARD),
                                            ('duplicateSlots', CARD, duplicate_slot),
                                            ('intentErrors', '', CARD)]:
                with self.subTest(field=field):
                    intent.write_text(expected)
                    model.write_text(json.dumps({'results': [{'uuid': 'page', 'baseVariantTplTree': actual}]}))
                    run = subprocess.run([sys.executable, str(Path(__file__).with_name('verify_slots.py')),
                                          str(intent), str(model), '--allow-defaults'], capture_output=True, text=True)
                    self.assertEqual(run.returncode, 1, run.stderr)
                    self.assert_only(json.loads(run.stdout), field)

    def test_registered_card_with_tabs_passes(self):
        actual = CARD.replace("plasmic-antd6-card", "plasmicAntd6Card").replace("plasmic-antd6-tabs", "plasmicAntd6Tabs")
        self.assertTrue(check(CARD, actual)["passed"])

    def test_native_card_substitute_fails(self):
        actual = '<section data-plasmic-name="listCard">' + TABS + '</section>'
        self.assertEqual(check(CARD, actual)["missingComponents"], ["listCard"])

    def test_wrong_component_type_fails(self):
        actual = CARD.replace("plasmic-antd6-card", "plasmic-antd6-flex")
        self.assertEqual(check(CARD, actual)["wrongComponents"], ["listCard"])

    def test_empty_card_with_sibling_tabs_fails(self):
        actual = CARD.replace(TABS, "") + TABS
        result = check(CARD, actual)
        self.assertEqual(result["emptyCards"], ["listCard"])
        self.assertEqual(result["cardContentOutsideSlot"], [{"card": "listCard", "component": "scopeTabs"}])

    def test_tabs_in_wrong_slot_fail(self):
        actual = CARD.replace('name="children"', 'name="extra"')
        self.assertFalse(check(CARD, actual)["passed"])

    def test_non_card_slot_ownership_ignores_layout_but_rejects_moved_controls(self):
        intent = CARD.replace("plasmic-antd6-card", "plasmic-antd6-tabs")
        wrapped = intent.replace(TABS, '<div><section>' + TABS + '</section></div>')
        self.assertTrue(check(intent, wrapped)["passed"])
        moved = intent.replace(TABS, '') + TABS
        self.assertTrue(check(intent, moved)["wrongSlotOwners"])

    def test_scope_tabs_own_each_panel_and_the_shared_action(self):
        table = '<plasmic-component data-plasmic-name="Results" data-plasmic-component="plasmic-antd6-table"></plasmic-component>'
        pager = '<plasmic-component data-plasmic-name="Pager" data-plasmic-component="plasmic-antd6-pagination"></plasmic-component>'
        action = '<plasmic-component data-plasmic-name="Create" data-plasmic-component="plasmic-antd6-button"></plasmic-component>'
        panels = '<slot name="items"><plasmic-component data-plasmic-name="AllPanel" data-plasmic-component="plasmic-antd6-tab-item"><slot name="label">All</slot><slot name="children">' + table + pager + '</slot></plasmic-component></slot>'
        intent = TABS.replace('></plasmic-component>', '>' + panels + '<slot name="tabBarExtraContentRight">' + action + '</slot></plasmic-component>')
        self.assertTrue(check(intent, intent)["passed"])
        for component in (table, pager, action):
            with self.subTest(component=component):
                actual = intent.replace(component, '') + component
                self.assertTrue(check(intent, actual)["wrongSlotOwners"])

    def test_unprovided_examples_still_fail(self):
        actual = CARD.replace('</plasmic-component>', '<slot name="title"><span id="example">Example</span></slot></plasmic-component>', 1)
        self.assertFalse(check(CARD, actual)["passed"])

    def test_explicit_empty_header_slots_reject_retained_defaults(self):
        expected = CARD.replace('<slot name="children">', '<slot name="title"></slot><slot name="extra"></slot><slot name="children">')
        self.assertTrue(check(expected, expected)['passed'])
        for slot_name in ['title', 'extra']:
            for child in ['Card title', '<span id="sample">Card title</span>']:
                with self.subTest(slot=slot_name, child=child):
                    actual = expected.replace(f'<slot name="{slot_name}"></slot>', f'<slot name="{slot_name}">{child}</slot>')
                    self.assert_only(check(expected, actual), 'unprovidedSlotChildren')

    def test_hidden_default_does_not_fulfill_empty_header_intent(self):
        expected = CARD.replace('<slot name="children">', '<slot name="title"></slot><slot name="children">')
        actual = expected.replace('<slot name="title"></slot>', '<slot name="title">Card title</slot>').replace('data-plasmic-name="listCard"', '''data-plasmic-name="listCard" data-props='{"styles":{"header":{"display":"none"}}}' ''')
        self.assert_only(check(expected, actual), 'unprovidedSlotChildren')

    def test_tabs_card_padding_is_not_information_card_padding(self):
        expected = CARD.replace('data-plasmic-name="listCard"', '''data-plasmic-name="listCard" data-props='{"styles":{"body":{"padding":"0 20px"}}}' ''')
        actual = expected.replace('0 20px', '16px 20px')
        self.assertEqual(check(expected, actual)["wrongCardPadding"], [{"card": "listCard", "property": "padding", "expected": "0 20px", "actual": "16px 20px"}])
        self.assertTrue(check(expected, expected)["passed"])

    def test_information_card_keeps_its_own_padding(self):
        expected = CARD.replace('data-plasmic-name="listCard"', '''data-plasmic-name="listCard" data-props='{"styles":{"body":{"padding":"16px 20px"}}}' ''')
        self.assertTrue(check(expected, expected)["passed"])

    def test_native_names_use_public_readback_labels(self):
        expected = CARD.replace(TABS, '<div data-plasmic-name="listBody">' + TABS + '</div>')
        actual = expected.replace('data-plasmic-name="listBody"', 'label="listBody"')
        self.assertTrue(check(expected, actual)["passed"])

    def test_labeled_native_content_outside_card_still_fails(self):
        native = '<div data-plasmic-name="listBody">' + TABS + '</div>'
        expected = CARD.replace(TABS, native)
        actual = expected.replace(native, '') + native.replace('data-plasmic-name="listBody"', 'label="listBody"')
        self.assertIn({"card": "listCard", "component": "listBody"}, check(expected, actual)["cardContentOutsideSlot"])


if __name__ == "__main__":
    unittest.main()
