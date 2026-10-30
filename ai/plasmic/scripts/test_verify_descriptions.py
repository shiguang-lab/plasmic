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
    def test_wide_one_column_group_needs_evidence(self):
        items = [{"key": k, "label": k, "children": "short"} for k in ("syntax", "source", "role")]
        expected = copy.deepcopy(INVENTORY)
        group = expected["pages"][0]["groups"][0]
        group.update(column=1, items=items)
        actual = model(items=items)
        tree = actual["results"][0]["baseVariantTplTree"].replace('data-plasmic-name="Summary"', 'id="desc1" data-plasmic-name="Summary"')
        actual["results"][0]["baseVariantTplTree"] = tree.replace('&quot;column&quot;: 2', '&quot;column&quot;: 1')
        layouts = lambda width: {"page": {"snapshot": {"frames": [{"elements": [{"elementUuid": "desc1", "width": width}]}]}}}
        self.assertTrue(check(expected, actual)["passed"], "no layout evidence: geometry not checked here")
        self.assertIn("wide-single-column check unverified", str(check(expected, actual)["notChecked"]))
        self.assertTrue(check(expected, actual, layouts(480))["passed"])
        result = check(expected, actual, layouts(1127))
        self.assertFalse(result["passed"])
        self.assertIn("column-and-span", str(result["errors"]))
        group["columnReason"] = {"kind": "measurement", "longestValuePx": 300}
        self.assertFalse(check(expected, actual, layouts(1127))["passed"], "values that fit two per row do not justify one column")
        group["columnReason"] = {"kind": "measurement", "longestValuePx": 700}
        self.assertTrue(check(expected, actual, layouts(1127))["passed"])
        self.assertIn("exception applies to every value", str(check(expected, actual, layouts(1127))["notChecked"]))
        for value in (True, float('nan'), float('inf'), 0):
            group["columnReason"]["longestValuePx"] = value
            self.assertFalse(check(expected, actual, layouts(1127))["passed"])

    def test_editable_item_slots_and_bindings(self):
        expected = copy.deepcopy(INVENTORY)
        group = expected["pages"][0]["groups"][0]
        del group["items"]
        group["itemSlots"] = [{"name": "NameItem", "key": "name", "label": "Name",
                               "children": "{{ $ctx.query.name }}", "span": 2}]
        actual = model(items=None)
        node = '<slot name="children"><plasmic-component data-plasmic-name="NameItem" data-plasmic-component="plasmicAntd6DescriptionsItem" data-props="{}"><slot name="label"><span>Name</span></slot><slot name="children"><span>{{{{ $ctx.query.name }}}}</span></slot></plasmic-component></slot>'.format(
            html.escape(json.dumps({"key": "name", "span": 2}), quote=True))
        actual["results"][0]["baseVariantTplTree"] = actual["results"][0]["baseVariantTplTree"].replace(
            '</plasmic-component>', node + '</plasmic-component>')
        self.assertTrue(check(expected, actual)["passed"])
        original = actual["results"][0]["baseVariantTplTree"]
        for before, after in [('query.name', 'query.owner'), ('NameItem', 'OtherItem'),
                              ('&quot;span&quot;: 2', '&quot;span&quot;: 1'),
                              ('plasmicAntd6DescriptionsItem', 'plasmicAntd6TypographyText'),
                              ('&quot;items&quot;: null', '&quot;items&quot;: []')]:
            actual["results"][0]["baseVariantTplTree"] = original.replace(before, after)
            self.assertFalse(check(expected, actual)["passed"], after)

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

    def test_empty_page_inventory_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "distinct reviewed pages"):
            check({"pages": []}, model())

    def test_matching_invalid_columns_do_not_pass(self):
        for column in (0, -1, 1.5, True, None, "2"):
            with self.subTest(column=column):
                expected = copy.deepcopy(INVENTORY)
                expected["pages"][0]["groups"][0]["column"] = column
                actual = model()
                actual["results"][0]["baseVariantTplTree"] = actual["results"][0]["baseVariantTplTree"].replace(
                    '&quot;column&quot;: 2', '&quot;column&quot;: ' + html.escape(json.dumps(column), quote=True))
                result = check(expected, actual)
                self.assertFalse(result["passed"])
                self.assertIn("column must be a positive integer", str(result["errors"]))

    def test_matching_invalid_native_item_spans_do_not_pass(self):
        for span in (0, -1, 1.5, True, 3):
            with self.subTest(span=span):
                items = [{**item, "span": span} for item in ITEMS]
                expected = copy.deepcopy(INVENTORY)
                expected["pages"][0]["groups"][0]["items"] = items
                result = check(expected, model(items=items))
                self.assertFalse(result["passed"])
                self.assertIn("Item span must be", str(result["errors"]))

    def test_matching_invalid_editable_item_span_does_not_pass(self):
        expected = copy.deepcopy(INVENTORY)
        group = expected["pages"][0]["groups"][0]
        del group["items"]
        group["itemSlots"] = [{"name": "NameItem", "key": "name", "label": "Name", "children": "Example", "span": 3}]
        actual = model(items=None)
        field = ('<slot name="children"><plasmic-component data-plasmic-name="NameItem" '
                 'data-plasmic-component="plasmicAntd6DescriptionsItem" data-props="{&quot;key&quot;:&quot;name&quot;,&quot;span&quot;:3}">'
                 '<slot name="label"><span>Name</span></slot><slot name="children"><span>Example</span></slot>'
                 '</plasmic-component></slot>')
        actual["results"][0]["baseVariantTplTree"] = actual["results"][0]["baseVariantTplTree"].replace(
            '</plasmic-component>', field + '</plasmic-component>')
        result = check(expected, actual)
        self.assertFalse(result["passed"])
        self.assertEqual(len(result["errors"]), 1, result)
        self.assertIn("Item span must be", result["errors"][0]["error"])

    def test_dynamic_values_remain_runtime_obligations(self):
        items = [{**ITEMS[0], "span": "{{ $ctx.span }}"}]
        expected = copy.deepcopy(INVENTORY)
        expected["pages"][0]["groups"][0]["items"] = items
        result = check(expected, model(items=items))
        self.assertTrue(result["passed"], result)
        self.assertIn("evaluate span binding", str(result["notChecked"]))

    def test_title_equality_does_not_certify_heading_ownership(self):
        expected = copy.deepcopy(INVENTORY)
        expected["pages"][0]["groups"][0]["title"] = ""
        for surrounding in ('<span>Information</span>', '<span>Contact support for help.</span>', ''):
            actual = model(title="")
            actual["results"][0]["baseVariantTplTree"] = actual["results"][0]["baseVariantTplTree"].replace(
                '<div label="InformationCard">', '<div label="InformationCard">' + surrounding)
            result = check(expected, actual)
            self.assertTrue(result["passed"], "Do not guess semantic heading ownership from adjacent text")
            self.assertIn("Heading ownership", str(result["notChecked"]))

    def test_width_does_not_guess_container_type(self):
        actual = model()
        actual["results"][0]["baseVariantTplTree"] = actual["results"][0]["baseVariantTplTree"].replace(
            'data-plasmic-name="Summary"', 'id="desc1" data-plasmic-name="Summary"')
        for width in (1127, 640, 0, -1, True, float('nan')):
            layouts = {"page": {"snapshot": {"frames": [{"elements": [{"elementUuid": "desc1", "width": width}]}]}}}
            result = check(INVENTORY, actual, layouts)
            self.assertTrue(result["passed"], result)
            self.assertIn("Container-specific column choice", str(result["notChecked"]))
            self.assertEqual("wide-single-column check unverified" in str(result["notChecked"]), width not in (1127, 640))


if __name__ == "__main__":
    unittest.main()
