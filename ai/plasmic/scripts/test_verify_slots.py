import unittest

from verify_slots import check


TABS = '<plasmic-component data-plasmic-name="scopeTabs" data-plasmic-component="plasmic-antd6-tabs"></plasmic-component>'
CARD = '<plasmic-component data-plasmic-name="listCard" data-plasmic-component="plasmic-antd6-card"><slot name="children">' + TABS + '</slot></plasmic-component>'


class CardOwnershipTests(unittest.TestCase):
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

    def test_unprovided_examples_still_fail(self):
        actual = CARD.replace('</plasmic-component>', '<slot name="title"><span id="example">Example</span></slot></plasmic-component>', 1)
        self.assertFalse(check(CARD, actual)["passed"])

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
