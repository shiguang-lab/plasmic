import unittest
import copy
import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path
from verify_forms import check


class FormCheckTests(unittest.TestCase):
    def setUp(self):
        self.expected = {"pages": [{"componentUuid": "page", "forms": [{"name": "Form", "fields": [{"nodeName": "NameField", "name": "name", "label": "Name", "control": "Name", "rules": [{"ruleType": "required"}], "tooltip": "Help"}]}]}]}
        self.html = '''<plasmic-component data-plasmic-component="plasmicAntd6Form" data-plasmic-name="Form" data-props='{"mode":"advanced"}'><slot name="children"><plasmic-component data-plasmic-component="plasmic-antd6-form-item" data-plasmic-name="NameField" data-props='{"name":"name","rules":[{"ruleType":"required","message":"Required"}]}'><slot name="label"><span>Name</span></slot><slot name="tooltip"><span>Help</span></slot><slot name="children"><plasmic-component data-plasmic-component="plasmic-antd6-input" data-plasmic-name="Name" data-props='{}'></plasmic-component></slot></plasmic-component></slot></plasmic-component>'''
        self.expected["pages"][0]["forms"][0]["formLayout"] = "horizontal"
        self.expected["pages"][0]["forms"][0]["fields"][0]["copyTriage"] = "perceive-on-demand"
        self.html = self.html.replace('{"mode":"advanced"}', '{"mode":"advanced","layout":"horizontal"}')
        self.html = self.html.replace('data-plasmic-name="Form"', 'data-plasmic-name="Form" style="width:100%"')
        self.html = self.html.replace('data-plasmic-name="Name"', 'data-plasmic-name="Name" style="width:100%"')

    def result(self, html):
        return check(self.expected, self.overview(), self.readback(html))

    def overview(self):
        return {"results": [{"__type": "Project", "components": [{"uuid": "page", "type": "page"}]}]}

    def readback(self, html):
        return {"results": [{"uuid": "page", "type": "page", "baseVariantTplTree": html}]}

    def test_real_fields_pass_with_both_component_name_formats(self):
        self.assertTrue(self.result(self.html)["passed"])

    def test_hidden_advanced_children_cannot_pass_in_simplified_mode(self):
        for html in [self.html.replace('"advanced"', '"simplified"'), self.html.replace(' data-props=\'{"mode":"advanced","layout":"horizontal"}\'', '')]:
            result = self.result(html)
            self.assertFalse(result["passed"])
            self.assertIn("mode=advanced", result["errors"][0]["error"])

    def test_rule_parameters_preserve_json_types(self):
        self.expected['pages'][0]['forms'][0]['fields'][0]['rules'].append({'ruleType': 'min', 'length': 1})
        actual = self.html.replace('"message":"Required"}]', '"message":"Required"},{"ruleType":"min","length":1}]')
        self.assertTrue(self.result(actual)['passed'])
        result = self.result(actual.replace('"length":1', '"length":true'))
        self.assertFalse(result['passed'])
        self.assertEqual(result['errors'], [{'page': 'page', 'form': 'Form', 'field': 'name', 'errors': ['Missing expected validation rule']}])


    def test_path_inventory_reuses_new_project_uuids_without_mutation(self):
        page = self.expected["pages"][0]
        page.pop("componentUuid")
        page["path"] = "/records"
        expected = copy.deepcopy(self.expected)
        for uuid in ("first-project-page", "second-project-page"):
            overview, readback = self.overview(), self.readback(self.html)
            overview["results"][0]["components"][0].update(uuid=uuid, pageMeta={"path": "/records"})
            readback["results"][0].update(uuid=uuid, pageMeta={"path": "/records"})
            self.assertTrue(check(self.expected, overview, readback)["passed"])
        self.assertEqual(self.expected, expected)

    def test_unique_name_and_agreeing_selectors(self):
        overview = self.overview()
        overview["results"][0]["components"][0].update(name="Records", pageMeta={"path": "/records"})
        page = self.expected["pages"][0]
        page.pop("componentUuid")
        page["name"] = "Records"
        self.assertTrue(check(self.expected, overview, self.readback(self.html))["passed"])
        page.update(path="/records", componentUuid="page")
        self.assertTrue(check(self.expected, overview, self.readback(self.html))["passed"])
        page["componentUuid"] = "stale-page"
        self.assertFalse(check(self.expected, overview, self.readback(self.html))["passed"])

    def test_missing_ambiguous_empty_and_duplicate_selectors_fail_cleanly(self):
        page = self.expected["pages"][0]
        page.pop("componentUuid")
        self.assertFalse(self.result(self.html)["passed"])
        page["path"] = "/missing"
        self.assertFalse(self.result(self.html)["passed"])
        page["path"] = ""
        self.assertFalse(self.result(self.html)["passed"])
        overview = self.overview()
        first = overview["results"][0]["components"][0]
        first.update(name="Records", pageMeta={"path": "/records"})
        page["path"] = "/records"
        overview["results"][0]["components"].append({**first, "uuid": "other"})
        self.assertFalse(check(self.expected, overview, self.readback(self.html))["passed"])
        overview["results"][0]["components"].pop()
        self.expected["pages"].append({"name": "Records", "forms": []})
        self.assertFalse(check(self.expected, overview, self.readback(self.html))["passed"])

    def test_native_form_layout_and_single_error_setting(self):
        form = self.expected["pages"][0]["forms"][0]
        form["formLayout"] = "horizontal"
        form["fields"][0]["validateFirst"] = True
        html = self.html.replace('{"mode":"advanced"}', '{"mode":"advanced","layout":"horizontal"}').replace('"name":"name","rules"', '"name":"name","validateFirst":true,"rules"')
        self.assertTrue(self.result(html)["passed"])
        self.assertFalse(self.result(html.replace('"horizontal"', '"vertical"'))["passed"])
        self.assertFalse(self.result(html.replace('"validateFirst":true', '"validateFirst":false'))["passed"])

    def test_layout_decision_is_required_and_cannot_silently_inherit_defaults(self):
        form = self.expected["pages"][0]["forms"][0]
        form.pop("formLayout")
        result = self.result(self.html)
        self.assertFalse(result["passed"])
        self.assertIn("source-derived formLayout", str(result["errors"]))
        form["formLayout"] = {"layout": "horizontal"}
        self.assertFalse(self.result(self.html)["passed"])
        form["formLayout"] = "horizontal"
        self.assertFalse(self.result(self.html.replace(',"layout":"horizontal"', ''))["passed"])

    def source_reason(self, quote):
        path = Path(tempfile.mkdtemp()) / "req.md"
        path.write_text("# 需求\n" + quote + "\n", encoding="utf-8")
        return {"kind": "source", "evidence": {"path": str(path), "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "quote": quote}}

    def test_page_vertical_needs_structured_evidence_and_still_checks_width(self):
        form = self.expected["pages"][0]["forms"][0]
        form["formLayout"] = "vertical"
        html = self.html.replace('"layout":"horizontal"', '"layout":"vertical"')
        self.assertFalse(self.result(html)["passed"])
        # Prose, booleans and half-filled objects are rejected.
        for reason in (True, "Design source specifies long stacked field labels", {"kind": "source"}, {"kind": "prose", "text": "narrow"}):
            with self.subTest(reason=reason):
                form["layoutReason"] = reason
                result = self.result(html)
                self.assertFalse(result["passed"])
                self.assertIn("layoutReason", str(result["errors"]))
        # A source quote that does not state the label direction is not evidence.
        form["layoutReason"] = self.source_reason("客群管理平台要求字段顺序与需求一致")
        self.assertFalse(self.result(html)["passed"])
        # A source that explicitly requires vertical labels is accepted.
        form["layoutReason"] = self.source_reason("基本信息区字段较多且标签较长，采用纵向标签排布")
        self.assertTrue(self.result(html)["passed"])
        self.assertFalse(self.result(html.replace('width:100%', 'width:240px'))["passed"])

    def test_measurement_reason_must_show_real_crowding(self):
        form = self.expected["pages"][0]["forms"][0]
        form["formLayout"] = "vertical"
        html = self.html.replace('"layout":"horizontal"', '"layout":"vertical"')
        form["layoutReason"] = {"kind": "measurement", "labelWidth": 220, "controlMinWidth": 160, "regionWidth": 360}
        self.assertTrue(self.result(html)["passed"])
        form["layoutReason"] = {"kind": "measurement", "labelWidth": 64, "controlMinWidth": 160, "regionWidth": 420}
        self.assertFalse(self.result(html)["passed"])

    def test_duplicated_layout_reason_across_forms_is_rejected(self):
        page = self.expected["pages"][0]
        reason = self.source_reason("基本信息区采用纵向标签，字段较多")
        form = page["forms"][0]
        form["formLayout"] = "vertical"
        form["layoutReason"] = reason
        html = '<plasmic-component data-plasmic-component="plasmic-antd6-card"><slot name="children">' + self.html.replace('"layout":"horizontal"', '"layout":"vertical"') + self.html.replace('"layout":"horizontal"', '"layout":"vertical"').replace('data-plasmic-name="Form"', 'data-plasmic-name="Form2"').replace('data-plasmic-name="NameField"', 'data-plasmic-name="NameField2"').replace('data-plasmic-name="Name"', 'data-plasmic-name="Name2"') + '</slot></plasmic-component>'
        second = copy.deepcopy(form)
        second["name"] = "Form2"
        second["fields"] = [dict(f, nodeName=f["nodeName"] + "2", control=f["control"] + "2") for f in form["fields"]]
        page["forms"].append(second)
        result = self.result(html)
        self.assertFalse(result["passed"])
        self.assertIn("Duplicated layoutReason", str(result["errors"]))

    def test_overlay_default_is_inferred_through_card_and_slots(self):
        form = self.expected["pages"][0]["forms"][0]
        for kind in ("modal", "drawer"):
            with self.subTest(kind=kind):
                html = '<plasmic-component data-plasmic-component="plasmic-antd6-' + kind + '"><slot name="children"><plasmic-component data-plasmic-component="plasmic-antd6-card"><slot name="children">' + self.html + '</slot></plasmic-component></slot></plasmic-component>'
                form["formLayout"] = "horizontal"
                form.pop("layoutReason", None)
                self.assertFalse(self.result(html)["passed"])
                form["layoutReason"] = self.source_reason("宽弹窗中标签横向排布，控制列宽度经设计稿确认")
                self.assertTrue(self.result(html)["passed"])
                form.pop("layoutReason")
                form["formLayout"] = "vertical"
                self.assertTrue(self.result(html.replace('"layout":"horizontal"', '"layout":"vertical"'))["passed"])

    def wrap_fields(self, opening, closing="</div>"):
        prefix, rest = self.html.split('<slot name="children">', 1)
        body, suffix = rest.rsplit('</slot>', 1)
        return prefix + '<slot name="children">' + opening + body + closing + '</slot>' + suffix

    def test_screenshot_shrink_is_rejected_without_optional_grid_inventory(self):
        html = self.wrap_fields('<div style="display:grid;grid-template-columns:1fr 1fr;column-gap:24px">')
        result = self.result(html)
        self.assertFalse(result["passed"])
        self.assertIn("intermediate layout wrappers", str(result["errors"]))
        self.assertTrue(self.result(html.replace('display:grid;', 'display:grid;width:100%;'))["passed"])
        self.assertTrue(self.result(html.replace('data-plasmic-name="Form" style="width:100%"', 'data-plasmic-name="Form" style="width:stretch;align-items:stretch"'))["passed"])

    def test_nested_unnamed_wrapper_cannot_hide_shrink(self):
        html = self.wrap_fields('<div style="width:100%;display:flex;flex-direction:column;align-items:flex-start"><div style="display:grid;grid-template-columns:1fr 1fr">', '</div></div>')
        self.assertFalse(self.result(html)["passed"])
        self.assertTrue(self.result(html.replace('display:grid;', 'display:grid;align-self:stretch;'))["passed"])
        self.assertFalse(self.result(html.replace('display:grid;', 'display:grid;max-width:100%;'))["passed"])

    def test_fixed_width_and_max_width_limits_fail_at_every_level(self):
        html = self.wrap_fields('<div style="width:100%">')
        for target in ['data-plasmic-name="Form"', 'data-plasmic-name="Name"']:
            for size in ('width:240px', 'width:100%;max-width:500px'):
                with self.subTest(target=target, size=size):
                    self.assertFalse(self.result(html.replace(target + ' style="width:100%"', target + ' style="' + size + '"'))["passed"])
        self.assertFalse(self.result(html.replace('data-plasmic-name="NameField"', 'data-plasmic-name="NameField" style="width:50%"'))["passed"])
        self.assertFalse(self.result(html.replace('<div style="width:100%">', '<div style="width:100%;max-width:500px">'))["passed"])

    def test_outer_surface_wrapper_must_also_fill(self):
        html = '<plasmic-component data-plasmic-component="plasmic-antd6-card"><slot name="children"><div style="width:500px">' + self.html + '</div></slot></plasmic-component>'
        self.assertFalse(self.result(html)["passed"])
        self.assertTrue(self.result(html.replace('width:500px', 'width:100%'))["passed"])

    def test_registered_flex_row_col_respect_allocated_column_width(self):
        opening = '''<plasmic-component data-plasmic-component="plasmic-antd6-flex" style="width:100%" data-props='{"vertical":true,"align":"stretch"}'><slot name="children"><plasmic-component data-plasmic-component="plasmic-antd6-row" data-props='{"gutter":24}'><slot name="children"><plasmic-component data-plasmic-component="plasmic-antd6-col" data-props='{"span":12}'><slot name="children">'''
        html = self.wrap_fields(opening, '</slot></plasmic-component>' * 3)
        self.assertTrue(self.result(html)["passed"])
        for old, new in [('"span":12', '"span":0'), ('"span":12', '"span":30'), ('"align":"stretch"', '"align":"start"'), ('"vertical":true', '"vertical":false')]:
            with self.subTest(old=old, new=new):
                self.assertFalse(self.result(html.replace(old, new))["passed"])
        self.assertTrue(self.result(html.replace('"span":12', '"flex":"1"'))["passed"])

    def test_compact_controls_are_not_forced_full_width(self):
        html = self.html.replace('plasmic-antd6-input', 'plasmic-antd6-switch').replace('data-plasmic-name="Name" style="width:100%"', 'data-plasmic-name="Name"')
        self.assertTrue(self.result(html)["passed"])
        html = html.replace('plasmic-antd6-switch', 'plasmic-antd6-input-number')
        self.assertFalse(self.result(html)["passed"])
        field = self.expected["pages"][0]["forms"][0]["fields"][0]
        field["controlWidthReason"] = True
        self.assertFalse(self.result(html)["passed"])
        field["controlWidthReason"] = "Three-digit day count beside a short inline instruction"
        self.assertFalse(self.result(html)["passed"])
        field["controlWidthReason"] = {"kind": "measurement", "controlWidth": 180, "columnWidth": 420}
        self.assertTrue(self.result(html)["passed"])
        field["controlWidthReason"] = {"kind": "measurement", "controlWidth": 420, "columnWidth": 420}
        self.assertFalse(self.result(html)["passed"])
        # A compact control exception never exempts the Form or its wrappers.
        self.assertFalse(self.result(html.replace('width:100%', 'width:300px'))["passed"])

    def test_persistent_description_must_belong_to_item(self):
        self.expected["pages"][0]["forms"][0]["fields"][0]["description"] = "Default 14 days"
        self.expected["pages"][0]["forms"][0]["fields"][0]["copyTriage"] = "perceive-now"
        # copy triage is required once copy is rendered
        html = self.html.replace('<slot name="label">', '<slot name="description"><span>Default 14 days</span></slot><slot name="label">')
        self.assertTrue(self.result(html)["passed"])
        self.assertFalse(self.result(self.html + '<span>Default 14 days</span>')["passed"])
        duplicate = html.replace('</slot></plasmic-component>', '<span>Default 14 days</span></slot></plasmic-component>')
        self.assertFalse(self.result(duplicate)["passed"])

    def inline_fixture(self):
        field = self.expected["pages"][0]["forms"][0]["fields"][0]
        field.update(description="Short instructions", descriptionPlacement="afterControl", descriptionNode="Instructions")
        field["copyTriage"] = "perceive-now"
        text = '''<plasmic-component data-plasmic-component="plasmic-antd6-typography-text" data-plasmic-name="Instructions" data-props='{"type":"secondary"}'><slot name="children"><span>Short instructions</span></slot></plasmic-component>'''
        return self.html.replace('</plasmic-component></slot></plasmic-component>', '</plasmic-component>' + text + '</slot></plasmic-component>', 1)

    def test_inline_secondary_instructions_after_control_pass(self):
        self.assertTrue(self.result(self.inline_fixture())["passed"])

    def test_inline_instructions_reject_wrong_type_color_text_and_ownership(self):
        html = self.inline_fixture()
        for old, new in [('plasmic-antd6-typography-text', 'native-text'), ('"secondary"', '"success"'), ('Short instructions</span>', 'Wrong text</span>'), ('data-plasmic-name="Instructions"', 'data-plasmic-name="Elsewhere"')]:
            with self.subTest(old=old):
                self.assertFalse(self.result(html.replace(old, new))["passed"])
        self.expected["pages"][0]["forms"][0]["fields"][0].pop("descriptionNode")
        self.assertFalse(self.result(html)["passed"])

    def test_inline_instructions_reject_duplicate_extra_and_invalid_placement(self):
        html = self.inline_fixture()
        duplicate = html.replace('<slot name="label">', '<slot name="description"><span>Short instructions</span></slot><slot name="label">')
        self.assertFalse(self.result(duplicate)["passed"])
        self.expected["pages"][0]["forms"][0]["fields"][0]["descriptionPlacement"] = "label"
        self.assertFalse(self.result(html)["passed"])

    def test_native_wrappers_and_label_stars_fail(self):
        self.assertFalse(self.result(self.html.replace("plasmic-antd6-form-item", "native-field"))["passed"])
        self.assertFalse(self.result(self.html.replace(">Name</span>", ">Name *</span>"))["passed"])

    def test_missing_rules_tooltip_or_form_fail(self):
        for old, new in [('"required"', '"whitespace"'), (">Help</span>", ">Wrong</span>"), ("plasmicAntd6Form\"", "plasmicAntd6Card\"")]:
            with self.subTest(old=old):
                self.assertFalse(self.result(self.html.replace(old, new))["passed"])

    def test_competing_control_values_and_wrapped_controls_fail(self):
        self.assertFalse(self.result(self.html.replace("data-props='{}'", "data-props='{\"value\":\"seed\"}'"))["passed"])
        self.assertFalse(self.result(self.html.replace('<slot name="children"><plasmic-component data-plasmic-component="plasmic-antd6-input"', '<slot name="children"><div><plasmic-component data-plasmic-component="plasmic-antd6-input"').replace('</plasmic-component></slot></plasmic-component>', '</plasmic-component></div></slot></plasmic-component>', 1))["passed"])

    def test_removed_or_duplicate_fields_fail(self):
        self.assertFalse(self.result(self.html.replace('"name":"name"', '"name":"other"'))["passed"])
        self.assertFalse(self.result(self.html + self.html)["passed"])

    def grid_fixture(self):
        form = self.expected["pages"][0]["forms"][0]
        form["formLayout"] = "vertical"
        form["layout"] = {"container": "Fields", "modalWidth": 720, "columns": 2, "columnGap": 16, "rows": [{"container": "ShortRow", "fields": ["TypeField", "ScenarioField"]}]}
        form["labelWidth"] = {"longestLabel": "Name", "labelTextPx": 78, "requiredMarkPx": 10, "helpIconPx": 14, "paddingPx": 8, "measuredPx": 110}
        help_source = Path(tempfile.mkdtemp()) / "req.md"
        help_source.write_text("字段说明 Help", encoding="utf-8")
        help_evidence = {"path": str(help_source), "sha256": hashlib.sha256(help_source.read_bytes()).hexdigest(), "quote": "字段说明 Help"}
        form["sourceCopyUnits"] = [{"field": name + "Field", "text": "Help", "decision": "perceive-on-demand", "source": help_evidence}
                                   for name in ("Name", "Type", "Scenario")]
        form["fields"][0]["span"] = 2
        start = self.html.index('<plasmic-component data-plasmic-component="plasmic-antd6-form-item"')
        end = self.html.rindex('</slot></plasmic-component>')
        item = self.html[start:end].replace('data-plasmic-name="NameField"', 'data-plasmic-name="NameField" style="width:100%"')
        short = []
        for name in ["Type", "Scenario"]:
            field = copy.deepcopy(form["fields"][0])
            field.update(nodeName=name + "Field", name=name.lower(), control=name, span=1)
            form["fields"].append(field)
            short.append(item.replace('NameField', name + 'Field').replace('"name":"name"', '"name":"' + name.lower() + '"').replace('data-plasmic-name="Name"', 'data-plasmic-name="' + name + '"'))
        row = '<div label="ShortRow" style="display:grid;width:100%;grid-template-columns:repeat(2,minmax(0, 1fr));column-gap:16px">' + ''.join(short) + '</div>'
        html = self.html[:start].replace('"layout":"horizontal"', '"layout":"vertical","labelCol":{"flex":"110px"}') + '<div label="Fields" style="display:flex;flex-direction:column;width:100%">' + item + row + '</div>' + self.html[end:]
        return '<plasmic-component data-plasmic-component="plasmic-antd6-modal" data-props=\'{"width":"720"}\'>' + html + '</plasmic-component>'

    def test_full_width_rows_and_short_field_pair_pass(self):
        html = self.grid_fixture()
        self.assertTrue(self.result(html)["passed"])
        self.assertTrue(self.result(html.replace('column-gap:', 'grid-column-gap:'))["passed"])

    def test_page_form_layout_does_not_require_an_overlay_container(self):
        html = self.grid_fixture()
        html = html[html.index('>') + 1:-len('</plasmic-component>')]
        self.expected["pages"][0]["forms"][0]["layout"].pop("modalWidth")
        self.expected["pages"][0]["forms"][0]["formLayout"] = "horizontal"
        self.expected["pages"][0]["forms"][0]["fields"][0]["copyTriage"] = "perceive-on-demand"
        html = html.replace('"layout":"vertical","labelCol":{"flex":"110px"}', '"layout":"horizontal","labelCol":{"flex":"110px"}')
        self.expected["pages"][0]["forms"][0]["columnsReason"] = {"kind": "measurement", "controlWidth": 480, "columnWidth": 640}
        self.assertTrue(self.result(html)["passed"])
        self.expected["pages"][0]["forms"][0]["layout"]["modalWidth"] = 640
        self.assertFalse(self.result(html)["passed"])

    def test_shrinking_container_wrong_columns_gap_and_field_span_fail(self):
        html = self.grid_fixture()
        for old, new in [('width:100%', 'width:50%'), ('"width":"720"', '"width":"800"'), ('repeat(2', 'repeat(1'), ('column-gap:16px', 'column-gap:24px'), ('display:flex;flex-direction:column', 'display:flex;flex-direction:row'), ('display:flex;flex-direction:column', 'display:flex;flex-direction:column;row-gap:24px')]:
            with self.subTest(old=old):
                self.assertFalse(self.result(html.replace(old, new))["passed"])
        self.expected["pages"][0]["forms"][0]["fields"][0]["span"] = 1
        self.assertFalse(self.result(html)["passed"])


    def test_page_grid_form_needs_measured_label_width_and_right_alignment(self):
        html = self.grid_fixture()
        page = self.expected["pages"][0]
        form = page["forms"][0]
        inner = html[html.index('>') + 1:-len('</plasmic-component>')]
        page_html = inner.replace('"layout":"vertical","labelCol":{"flex":"110px"}', '"layout":"horizontal","labelCol":{"flex":"110px"}')
        form["formLayout"] = "horizontal"
        form["layout"].pop("modalWidth", None)
        form["columnsReason"] = {"kind": "measurement", "controlWidth": 480, "columnWidth": 640}
        self.assertTrue(self.result(page_html)["passed"])
        # Missing measured width, wrong native labelCol and left alignment without source all fail.
        form.pop("labelWidth")
        self.assertFalse(self.result(page_html)["passed"])
        form["labelWidth"] = {"longestLabel": "Name", "labelTextPx": 78, "requiredMarkPx": 10, "helpIconPx": 14, "paddingPx": 8, "measuredPx": 110}
        help_source = Path(tempfile.mkdtemp()) / "req.md"
        help_source.write_text("字段说明 Help", encoding="utf-8")
        help_evidence = {"path": str(help_source), "sha256": hashlib.sha256(help_source.read_bytes()).hexdigest(), "quote": "字段说明 Help"}
        form["sourceCopyUnits"] = [{"field": name + "Field", "text": "Help", "decision": "perceive-on-demand", "source": help_evidence}
                                   for name in ("Name", "Type", "Scenario")]
        self.assertFalse(self.result(page_html.replace('"flex":"110px"', '"flex":"72px"'))["passed"])
        form["labelAlign"] = "left"
        self.assertFalse(self.result(page_html)["passed"])
        form["labelAlignReason"] = {"kind": "source"}
        self.assertFalse(self.result(page_html)["passed"])
        # Three columns are the default; a two-column page Form needs a measurement showing crowding.
        form.pop("labelAlignReason", None)
        form.pop("labelAlign", None)
        form.pop("columnsReason")
        self.assertFalse(self.result(page_html)["passed"])
        form["columnsReason"] = {"kind": "measurement", "controlWidth": 100, "columnWidth": 640}
        self.assertFalse(self.result(page_html)["passed"])
        form["columnsReason"] = {"kind": "measurement", "controlWidth": 480, "columnWidth": 640}
        self.assertTrue(self.result(page_html)["passed"])

    def test_long_description_in_multi_column_form_needs_tooltip(self):
        from verify_forms import description_budget_problem
        long_text = "存量分区数据保留天数，选择 3 天则保留近 3 天所有分区的明细数据，超期分区会清理且不可恢复"
        self.assertIn("label tooltip", description_budget_problem(3, [{"nodeName": "RetentionField", "description": long_text}]))
        self.assertIsNone(description_budget_problem(3, [{"nodeName": "RetentionField", "description": "3-180 days"}]))
        self.assertIsNone(description_budget_problem(2, [{"nodeName": "RetentionField", "description": long_text}]))

    def test_source_copy_units_must_cover_every_rendered_sentence(self):
        from verify_forms import copy_coverage_problem
        source = Path(tempfile.mkdtemp()) / "prd.md"
        source.write_text("配 info 小按钮提示「存量分区数据保留天数，超期会被清理（不可恢复）」", encoding="utf-8")
        evidence = {"path": str(source), "sha256": hashlib.sha256(source.read_bytes()).hexdigest(), "quote": source.read_text()}
        field = {"nodeName": "RetentionField", "tooltip": "存量分区数据保留天数，超期会被清理（不可恢复）", "copyTriage": "perceive-on-demand"}
        form = {"fields": [field], "sourceCopyUnits": [{"field": "RetentionField", "text": field["tooltip"], "decision": "perceive-on-demand", "source": evidence}]}
        self.assertEqual(copy_coverage_problem(form), [])
        # A rendered sentence with no unit fails.
        self.assertIn("without sourceCopyUnits", str(copy_coverage_problem({"fields": [field]})))
        # A paraphrase that is absent from the quote fails.
        paraphrased = copy.deepcopy(form)
        paraphrased["sourceCopyUnits"][0]["text"] = "分区保留策略说明"
        paraphrased["fields"][0]["tooltip"] = "分区保留策略说明"
        self.assertIn("verbatim", str(copy_coverage_problem(paraphrased)))
        # A not-user-facing unit must be excluded from rendering and recorded.
        excluded = copy.deepcopy(form)
        excluded["sourceCopyUnits"][0].update(decision="not-user-facing")
        excluded["fields"][0]["tooltip"] = None
        self.assertIn("excludedCopy", str(copy_coverage_problem(excluded)))
        excluded["fields"][0]["excludedCopy"] = [{"text": excluded["sourceCopyUnits"][0]["text"], "source": evidence}]
        self.assertEqual(copy_coverage_problem(excluded), [])

    def test_compact_single_column_modal_passes(self):
        html = self.grid_fixture()
        form = self.expected["pages"][0]["forms"][0]
        form["fields"] = form["fields"][:1]
        form["fields"][0]["span"] = 1
        form["layout"].update(modalWidth=520, columns=1, rows=[])
        html = html[:html.index('<div label="ShortRow"')] + '</div></slot></plasmic-component></plasmic-component>'
        html = html.replace('"width":"720"', '"width":"520"')
        self.assertTrue(self.result(html)["passed"])

    def test_missing_or_incomplete_short_field_row_fails(self):
        html = self.grid_fixture()
        self.assertFalse(self.result(html.replace('label="Fields"', 'label="Other"'))["passed"])
        self.assertFalse(self.result(html.replace('label="ShortRow"', 'label="OtherRow"'))["passed"])
        self.expected["pages"][0]["forms"][0]["layout"]["rows"][0]["fields"] = ["TypeField"]
        self.assertFalse(self.result(html)["passed"])

    def test_missing_extra_duplicate_pages_and_missing_full_readback_fail(self):
        for target in ["overview", "readback"]:
            for operation in ["missing", "extra", "duplicate"]:
                with self.subTest(target=target, operation=operation):
                    overview, readback = self.overview(), self.readback(self.html)
                    pages = overview["results"][0]["components"] if target == "overview" else readback["results"]
                    if operation == "missing":
                        pages.clear()
                    else:
                        extra = copy.deepcopy(pages[0])
                        if operation == "extra":
                            extra["uuid"] = "other"
                        pages.append(extra)
                    self.assertFalse(check(self.expected, overview, readback)["passed"])
        self.assertFalse(self.result("")["passed"])

    def test_empty_form_inventory_cannot_hide_a_form(self):
        self.expected["pages"][0]["forms"] = []
        self.assertFalse(self.result(self.html)["passed"])
        self.assertTrue(self.result("<div>Read only detail</div>")["passed"])

    def test_uninventoried_form_and_unnamed_item_fail(self):
        hidden = self.html.replace('data-plasmic-name="Form"', 'data-plasmic-name="HiddenForm"')
        self.assertFalse(self.result(self.html + hidden)["passed"])
        self.assertFalse(self.result(self.html.replace('"name":"name",', ''))["passed"])

    def test_orphan_and_non_children_slot_items_fail(self):
        item = '<plasmic-component data-plasmic-component="plasmic-antd6-form-item" data-plasmic-name="Extra"></plasmic-component>'
        self.assertFalse(self.result(self.html+item)["passed"])
        html = self.html[:-len('</plasmic-component>')]+'<slot name="submitSlot">'+item+'</slot></plasmic-component>'
        self.assertFalse(self.result(html)["passed"])

    def test_unowned_native_and_registered_controls_fail_even_outside_forms(self):
        for control in ['<input label="Extra">', '<select label="Extra"></select>', '<textarea label="Extra"></textarea>', '<plasmic-component data-plasmic-component="plasmic-antd6-select" data-plasmic-name="Extra"></plasmic-component>']:
            with self.subTest(control=control):
                self.assertFalse(self.result(self.html + control)["passed"])
                self.assertFalse(self.result(self.html.replace('<slot name="children">', '<slot name="children">'+control, 1))["passed"])

    def test_standalone_exceptions_are_named_unique_and_used(self):
        page = self.expected["pages"][0]
        page["standaloneControls"] = [{"nodeName": "SQLEditor", "reason": "Separate SQL workflow validation"}]
        html = self.html + '<textarea label="SQLEditor"></textarea>'
        self.assertTrue(self.result(html)["passed"])
        self.assertFalse(self.result(self.html)["passed"])
        self.assertFalse(self.result(html+'<textarea label="SQLEditor"></textarea>')["passed"])
        page["standaloneControls"][0]["reason"] = ""
        self.assertFalse(self.result(html)["passed"])

    def test_standalone_exception_cannot_exempt_a_form_control(self):
        self.expected["pages"][0]["standaloneControls"] = [{"nodeName": "Extra", "reason": "Separate workflow"}]
        html = self.html.replace('<slot name="children">', '<slot name="children"><input label="Extra">', 1)
        self.assertFalse(self.result(html)["passed"])

    def test_search_form_ownership_remains_valid(self):
        search = '<plasmic-component data-plasmic-component="plasmic-overseas-search-form"><slot name="children"><plasmic-component data-plasmic-component="plasmic-overseas-search-form-item"><slot name="children"><plasmic-component data-plasmic-component="plasmic-antd6-input"></plasmic-component></slot></plasmic-component></slot></plasmic-component>'
        self.assertTrue(self.result(self.html + search)["passed"])

    def test_group_options_are_owned_by_the_group_control(self):
        marker = '<plasmic-component data-plasmic-component="plasmic-antd6-input" data-plasmic-name="Name" style="width:100%" data-props=\'{}\'></plasmic-component>'
        group = '<plasmic-component data-plasmic-component="plasmic-antd6-radio-group" data-plasmic-name="Name"><slot name="children"><plasmic-component data-plasmic-component="plasmic-antd6-radio-button" data-props=\'{"value":"option"}\'></plasmic-component></slot></plasmic-component>'
        self.assertTrue(self.result(self.html.replace(marker, group))["passed"])
        self.assertFalse(self.result(self.html+'<plasmic-component data-plasmic-component="plasmic-antd6-input-password"></plasmic-component>')["passed"])

    def test_label_help_imitation_and_manual_errors_in_form_region_fail(self):
        imitations = [
            '<button label="RetentionHelp">i</button>',
            '<span title="Field help">?</span>',
            '<plasmic-component data-plasmic-component="plasmic-antd6-tooltip"></plasmic-component>',
            '<plasmic-component data-plasmic-component="plasmic-antd-icon-QuestionCircleOutlined"></plasmic-component>',
            '<div label="NameError">Required</div>',
            '<div style="color:#ff4d4f">请输入名称</div>',
            '<span>{{ $state.newError }}</span>',
            '<div data-visible-if="{{ !!$state.formError }}">Required</div>',
        ]
        for imitation in imitations:
            with self.subTest(imitation=imitation):
                self.assertFalse(self.result(self.html.replace('<slot name="children">', '<slot name="children">'+imitation, 1))["passed"])
                modal = '<plasmic-component data-plasmic-component="plasmic-antd6-modal"><slot name="children">'+self.html+imitation+'</slot></plasmic-component>'
                self.assertFalse(self.result(modal)["passed"])

    def test_unrelated_tooltips_and_persistent_help_do_not_fail(self):
        outside = '<plasmic-component data-plasmic-component="plasmic-antd6-tooltip" data-plasmic-name="BackToListTooltip"></plasmic-component>'
        self.assertTrue(self.result(self.html + outside)["passed"])
        self.assertTrue(self.result(self.html.replace('<slot name="children">', '<slot name="children"><span>Persistent instructions</span>', 1))["passed"])

    def test_control_must_be_first_and_only_editable_child(self):
        marker = '<slot name="children"><plasmic-component data-plasmic-component="plasmic-antd6-input"'
        self.assertFalse(self.result(self.html.replace(marker, '<slot name="children"><button>Regenerate</button><plasmic-component data-plasmic-component="plasmic-antd6-input"'))["passed"])
        self.assertFalse(self.result(self.html.replace(marker, '<slot name="children"><input><plasmic-component data-plasmic-component="plasmic-antd6-input"'))["passed"])

    def test_advanced_validator_must_be_bound_as_code(self):
        for custom, passes in [("(_rule,value)=>!!value", False), ("{{ (_rule,value)=>!!value }}", True)]:
            html = self.html.replace('"ruleType":"required","message":"Required"', '"ruleType":"required","message":"Required"},{"ruleType":"advanced","custom":'+json.dumps(custom))
            self.assertEqual(self.result(html)["passed"], passes)

    def test_cli_requires_overview_and_exits_nonzero_for_violation(self):
        with tempfile.TemporaryDirectory() as directory:
            paths = []
            for name, value in [("expected", self.expected), ("overview", self.overview()), ("pages", self.readback(self.html))]:
                path = Path(directory) / (name + ".json")
                path.write_text(json.dumps(value))
                paths.append(str(path))
            script = str(Path(__file__).with_name("verify_forms.py"))
            command = [sys.executable, script, paths[0], paths[2]]
            self.assertNotEqual(subprocess.run(command, capture_output=True).returncode, 0)
            command += ["--overview", paths[1]]
            self.assertEqual(subprocess.run(command, capture_output=True).returncode, 0)
            Path(paths[2]).write_text(json.dumps(self.readback(self.html+'<input label="Extra">')))
            self.assertNotEqual(subprocess.run(command, capture_output=True).returncode, 0)


if __name__ == "__main__":
    unittest.main()
