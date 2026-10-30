import copy
import html
import hashlib
import tempfile
from pathlib import Path
import json
import unittest
from verify_descriptions import check
from verify_component_policy import plan_errors, check_page


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
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.source = Path(directory.name) / "request.md"
        self.source.write_text("Use native items for this group.\nThe API determines which fields are displayed.", encoding="utf-8")
        self.evidence = {"path": str(self.source), "sha256": hashlib.sha256(self.source.read_bytes()).hexdigest(),
                         "quote": "Use native items for this group."}
        self.inventory = copy.deepcopy(INVENTORY)
        self.inventory["pages"][0]["groups"][0]["itemsReason"] = {
            "kind": "explicit-user-request", "evidence": self.evidence}

    def assert_items_policy(self, items, reason, passed):
        expected = copy.deepcopy(self.inventory)
        group = expected["pages"][0]["groups"][0]
        group.update(items=items, itemsReason=reason)
        actual = model(items)
        result = check(expected, actual)
        self.assertEqual(result["passed"], passed, result)
        plan = {"components": [{"nodeName": "Summary", "component": "plasmic-antd6-descriptions",
                                "props": {"column": 2, "items": items}, "itemsReason": reason}]}
        # The same rule must apply before generation and to saved-model readback.
        for errors in (plan_errors(plan), check_page(plan, actual["results"][0])):
            self.assertEqual(not errors, passed, errors)

    def test_fixed_items_require_explicit_exception_even_with_bound_values(self):
        for items in (ITEMS, [], [{**ITEMS[0], "children": "{{ $ctx.query.name }}"}],
                      "{{ [{key:'name',label:'Name',children:$ctx.query.name}] }}"):
            with self.subTest(items=items):
                self.assert_items_policy(items, None, False)

    def test_dynamic_field_collection_requires_matching_binding_and_evidence(self):
        items = "{{ $ctx.query.fields.map(field => ({key:field.id,label:field.name,children:field.value})) }}"
        reason = {"kind": "dynamic-fields", "binding": "$ctx.query.fields",
                  "evidence": {**self.evidence, "quote": "The API determines which fields are displayed."}}
        self.assert_items_policy(items, reason, True)
        self.assert_items_policy(ITEMS, reason, False)
        self.assert_items_policy("{{ [{key:'name',label:'Name',children:$ctx.query.name}] }}", reason, False)
        for binding in (None, "", "$ctx.query.other", "$ctx.query.field"):
            self.assert_items_policy(items, {**reason, "binding": binding}, False)

    def test_native_items_exception_evidence_is_verified(self):
        reason = self.inventory["pages"][0]["groups"][0]["itemsReason"]
        self.assert_items_policy(ITEMS, reason, True)
        self.assert_items_policy([], reason, True)
        for patch in ({"kind": "data-bound"}, {"evidence": None},
                      {"evidence": {**self.evidence, "quote": "Not in the source"}},
                      {"evidence": {**self.evidence, "sha256": "stale"}},
                      {"evidence": {**self.evidence, "path": str(self.source.parent / "missing.md")}}):
            self.assert_items_policy(ITEMS, {**reason, **patch}, False)

    def editable_group(self):
        expected = copy.deepcopy(self.inventory)
        group = expected["pages"][0]["groups"][0]
        del group["items"]
        del group["itemsReason"]
        group["itemSlots"] = [{"name": "NameItem", "key": "name", "label": "Name", "children": "Example"}]
        item = ('<plasmic-component data-plasmic-name="NameItem" data-plasmic-component="plasmicAntd6DescriptionsItem" '
                'data-props="{&quot;key&quot;:&quot;name&quot;}"><slot name="label"><span>Name</span></slot>'
                '<slot name="children"><span>Example</span></slot></plasmic-component>')
        return expected, item

    def with_field_children(self, actual, children, named_slot=True):
        actual = copy.deepcopy(actual)
        # Insert after the title of the parent, not into an Item's content.
        title_end = '</span></slot>'
        fields = '<slot name="children">' + children + '</slot>' if named_slot else children
        actual["results"][0]["baseVariantTplTree"] = actual["results"][0]["baseVariantTplTree"].replace(
            title_end, title_end + fields, 1)
        return actual

    def test_direct_item_structure_rejects_extra_fields_and_wrappers(self):
        expected, item = self.editable_group()
        plan = {"components": []}
        valid = self.with_field_children(model(items=None), '\n  ' + item + '\n')
        self.assertTrue(check(expected, valid)["passed"])
        self.assertEqual(check_page(plan, valid["results"][0]), [])
        invalid = ['<span>Owner: Operations</span>', 'Owner: Operations', '<div></div>',
                   '<plasmic-component data-plasmic-component="plasmicAntd6Flex"></plasmic-component>']
        for child in invalid:
            for body in (child, item + child):
                with self.subTest(body=body):
                    actual = self.with_field_children(model(items=None), body)
                    self.assertFalse(check(expected, actual)["passed"])
                    self.assertTrue(check_page(plan, actual["results"][0]))
        for body in ('<div>' + item + '</div>',
                     '<plasmic-component data-plasmic-component="plasmicAntd6Flex"><slot name="children">'
                     + item + '</slot></plasmic-component>'):
            actual = self.with_field_children(model(items=None), body)
            self.assertFalse(check(expected, actual)["passed"])
            self.assertTrue(check_page(plan, actual["results"][0]))
        # Unnamed direct markup must not disappear merely because there is no children Slot.
        actual = self.with_field_children(model(items=None), '<span>Owner</span>', named_slot=False)
        self.assertFalse(check(expected, actual)["passed"])
        self.assertTrue(check_page(plan, actual["results"][0]))

    def test_uninventoried_span_fields_cannot_pass_an_empty_item_inventory(self):
        expected, _ = self.editable_group()
        expected["pages"][0]["groups"][0]["itemSlots"] = []
        actual = self.with_field_children(model(items=None), '<span>Name</span><span>Example</span>')
        self.assertFalse(check(expected, actual)["passed"])

    def test_native_items_reject_even_hidden_child_fields(self):
        _, item = self.editable_group()
        reason = self.inventory["pages"][0]["groups"][0]["itemsReason"]
        plan = {"components": [{"nodeName": "Summary", "component": "plasmic-antd6-descriptions",
                                "props": {"items": ITEMS}, "itemsReason": reason}]}
        for items in (ITEMS, []):
            expected = copy.deepcopy(self.inventory)
            expected["pages"][0]["groups"][0]["items"] = items
            for body in (item, '<span>Owner</span>'):
                actual = self.with_field_children(model(items), body)
                self.assertFalse(check(expected, actual)["passed"])
                self.assertTrue(check_page(plan, actual["results"][0]))

    def test_item_slots_allow_rich_content_and_title_text(self):
        expected, item = self.editable_group()
        item = item.replace('<span>Example</span>', '<plasmic-component data-plasmic-component="plasmicAntd6Tag">'
                            '<slot name="children"><span>Example</span></slot></plasmic-component>')
        actual = self.with_field_children(model(items=None), item)
        self.assertTrue(check(expected, actual)["passed"])
        self.assertEqual(check_page({"components": []}, actual["results"][0]), [])

    def test_plan_rejects_invalid_field_children_and_mixed_sources(self):
        parent = {"nodeName": "Summary", "component": "plasmic-antd6-descriptions", "props": {"column": 2}}
        item = {"nodeName": "NameItem", "component": "plasmic-antd6-descriptions-item",
                "owner": {"nodeName": "Summary", "slot": "children"}}
        plan = {"components": [parent, item], "nodes": [
            {"nodeName": "Label", "tag": "span", "owner": {"nodeName": "NameItem", "slot": "label"}},
            {"nodeName": "Value", "tag": "span", "owner": {"nodeName": "NameItem", "slot": "children"}},
            {"nodeName": "Title", "tag": "span", "owner": {"nodeName": "Summary", "slot": "title"}}]}
        self.assertEqual(plan_errors(plan), [])
        for tag in ('span', 'div', 'text'):
            invalid = copy.deepcopy(plan)
            invalid['nodes'].append({"nodeName": "FakeField", "tag": tag,
                                     "owner": {"nodeName": "Summary", "slot": "children"}})
            self.assertTrue(plan_errors(invalid))
        invalid = copy.deepcopy(plan)
        invalid['components'][1]['component'] = 'plasmic-antd6-flex'
        self.assertTrue(plan_errors(invalid))
        invalid = copy.deepcopy(plan)
        invalid['copy'] = {"entries": [{"nodeName": "Summary", "at": "/slots/children/text", "text": "Name: Example"}]}
        self.assertTrue(plan_errors(invalid))
        parent['props']['children'] = 'Name: Example'
        self.assertTrue(plan_errors(plan))
        del parent['props']['children']
        parent['props']['items'] = []
        parent['itemsReason'] = self.inventory["pages"][0]["groups"][0]["itemsReason"]
        self.assertTrue(plan_errors(plan))

    def test_wide_one_column_group_needs_evidence(self):
        items = [{"key": k, "label": k, "children": "short"} for k in ("syntax", "source", "role")]
        expected = copy.deepcopy(self.inventory)
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
        expected = copy.deepcopy(self.inventory)
        group = expected["pages"][0]["groups"][0]
        del group["items"]
        del group["itemsReason"]
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
        self.assertTrue(check(self.inventory, model())["passed"])

    def test_text_substitute_fails_independent_of_generator_intent(self):
        self.assertFalse(check(self.inventory, model(component="plasmicAntd6TypographyText"))["passed"])

    def test_missing_or_extra_fields_fail(self):
        for items in (ITEMS[:1], ITEMS + [{"key": "demo", "label": "Demo", "children": "Example"}]):
            self.assertFalse(check(self.inventory, model(items))["passed"])

    def test_changed_binding_fails_without_execution(self):
        expected = copy.deepcopy(self.inventory)
        expression = "{{ [{key:'name',label:'Name',children:$ctx.query.name}] }}"
        expected["pages"][0]["groups"][0]["items"] = expression
        self.assertTrue(check(expected, model(expression))["passed"])
        self.assertFalse(check(expected, model(expression.replace('query.name', 'query.owner')))["passed"])

    def test_wrong_container_or_title_fails(self):
        expected = copy.deepcopy(self.inventory)
        expected["pages"][0]["groups"][0]["container"] = "OtherCard"
        self.assertFalse(check(expected, model())["passed"])
        self.assertFalse(check(self.inventory, model(title="Details"))["passed"])

    def test_missing_page_fails(self):
        self.assertFalse(check(self.inventory, {"results": []})["passed"])

    def test_card_extra_is_not_business_content(self):
        actual = model()
        actual["results"][0]["baseVariantTplTree"] = actual["results"][0]["baseVariantTplTree"].replace(
            '<div label="InformationCard">', '<plasmic-component data-plasmic-name="InformationCard" data-plasmic-component="plasmicAntd6Card"><slot name="extra">'
        ).replace('</div>', '</slot></plasmic-component>')
        self.assertFalse(check(self.inventory, actual)["passed"])

    def test_false_cannot_replace_zero(self):
        changed = copy.deepcopy(ITEMS)
        changed[1]["children"] = False
        self.assertFalse(check(self.inventory, model(changed))["passed"])

    def test_duplicate_group_and_unplanned_group_fail(self):
        actual = model()
        actual["results"][0]["baseVariantTplTree"] *= 2
        self.assertFalse(check(self.inventory, actual)["passed"])
        expected = {"pages": [{"componentUuid": "page", "groups": []}]}
        self.assertFalse(check(expected, model())["passed"])

    def test_empty_page_inventory_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "distinct reviewed pages"):
            check({"pages": []}, model())

    def test_matching_invalid_columns_do_not_pass(self):
        for column in (0, -1, 1.5, True, None, "2"):
            with self.subTest(column=column):
                expected = copy.deepcopy(self.inventory)
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
                expected = copy.deepcopy(self.inventory)
                expected["pages"][0]["groups"][0]["items"] = items
                result = check(expected, model(items=items))
                self.assertFalse(result["passed"])
                self.assertIn("Item span must be", str(result["errors"]))

    def test_matching_invalid_editable_item_span_does_not_pass(self):
        expected = copy.deepcopy(self.inventory)
        group = expected["pages"][0]["groups"][0]
        del group["items"]
        del group["itemsReason"]
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
        expected = copy.deepcopy(self.inventory)
        expected["pages"][0]["groups"][0]["items"] = items
        result = check(expected, model(items=items))
        self.assertTrue(result["passed"], result)
        self.assertIn("evaluate span binding", str(result["notChecked"]))

    def test_title_equality_does_not_certify_heading_ownership(self):
        expected = copy.deepcopy(self.inventory)
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
            result = check(self.inventory, actual, layouts)
            self.assertTrue(result["passed"], result)
            self.assertIn("Container-specific column choice", str(result["notChecked"]))
            self.assertEqual("wide-single-column check unverified" in str(result["notChecked"]), width not in (1127, 640))


if __name__ == "__main__":
    unittest.main()
