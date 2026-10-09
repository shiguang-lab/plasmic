import copy
import html
import json
import unittest
from verify_descriptions import check


ITEMS = [{"key": "name", "label": "Name", "children": "Example"},
         {"key": "count", "label": "Count", "children": 0}]
INVENTORY = {"pages": [{"componentUuid": "page", "groups": [{
    "name": "Summary", "container": "InformationCard", "title": "Information",
    "column": 2, "items": ITEMS}]}]}


def model(items=ITEMS, component="plasmicAntd6Descriptions", title="Information"):
    markup = '<div label="InformationCard"><plasmic-component data-plasmic-name="Summary" data-plasmic-component="{}" data-props="{}"><slot name="title"><span>{}</span></slot></plasmic-component></div>'.format(
        component, html.escape(json.dumps({"column": 2, "items": items}), quote=True), title)
    return {"results": [{"uuid": "page", "baseVariantTplTree": markup}]}


class InformationSelectionTests(unittest.TestCase):
    def test_native_fields_and_zero_pass(self):
        self.assertTrue(check(INVENTORY, model())["passed"])

    def test_text_substitute_fails_independent_of_generator_intent(self):
        self.assertFalse(check(INVENTORY, model(component="plasmicAntd6TypographyText"))["passed"])

    def test_missing_or_extra_fields_fail(self):
        for items in (ITEMS[:1], ITEMS + [{"key": "demo", "label": "Demo", "children": "Example"}]):
            self.assertFalse(check(INVENTORY, model(items))["passed"])

    def test_changed_binding_fails_without_execution(self):
        expected = copy.deepcopy(INVENTORY)
        expression = "{{ [{key:'name',label:'Name',children:$ctx.query.name}] }}"
        expected["pages"][0]["groups"][0]["items"] = expression
        self.assertTrue(check(expected, model(expression))["passed"])
        self.assertFalse(check(expected, model(expression.replace('query.name', 'query.owner')))["passed"])

    def test_wrong_container_or_title_fails(self):
        expected = copy.deepcopy(INVENTORY)
        expected["pages"][0]["groups"][0]["container"] = "OtherCard"
        self.assertFalse(check(expected, model())["passed"])
        self.assertFalse(check(INVENTORY, model(title="Details"))["passed"])

    def test_missing_page_fails(self):
        self.assertFalse(check(INVENTORY, {"results": []})["passed"])

    def test_card_extra_is_not_business_content(self):
        actual = model()
        actual["results"][0]["baseVariantTplTree"] = actual["results"][0]["baseVariantTplTree"].replace(
            '<div label="InformationCard">', '<plasmic-component data-plasmic-name="InformationCard" data-plasmic-component="plasmicAntd6Card"><slot name="extra">'
        ).replace('</div>', '</slot></plasmic-component>')
        self.assertFalse(check(INVENTORY, actual)["passed"])

    def test_false_cannot_replace_zero(self):
        changed = copy.deepcopy(ITEMS)
        changed[1]["children"] = False
        self.assertFalse(check(INVENTORY, model(changed))["passed"])

    def test_duplicate_group_and_unplanned_group_fail(self):
        actual = model()
        actual["results"][0]["baseVariantTplTree"] *= 2
        self.assertFalse(check(INVENTORY, actual)["passed"])
        expected = {"pages": [{"componentUuid": "page", "groups": []}]}
        self.assertFalse(check(expected, model())["passed"])


if __name__ == "__main__":
    unittest.main()
