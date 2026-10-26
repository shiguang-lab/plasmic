import unittest
import copy
import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path
from verify_forms import check



_LAYOUT = None


def measured_from():
    """A retained snapshot_layout capture for measured label widths."""
    global _LAYOUT
    import hashlib, tempfile
    if _LAYOUT is None:
        import atexit
        handle = tempfile.NamedTemporaryFile('w', suffix='-layout.json', delete=False)
        handle.write('{"frames": []}')
        handle.close()
        _LAYOUT = Path(handle.name)
        atexit.register(_LAYOUT.unlink, missing_ok=True)
    return {"path": str(_LAYOUT), "sha256": hashlib.sha256(_LAYOUT.read_bytes()).hexdigest()}

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

    def visual_reference(self):
        from verify_references import REQUIRED_FIELDS
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        source = Path(directory.name) / "original.pen"
        source.write_bytes(b"Original source fixture")
        image = Path(directory.name) / "original.webp"
        image.write_bytes(b"Original image fixture; perception is outside this static gate")
        ref = {"id": "form", "filePath": str(source), "nodeId": "form-frame"}
        key = json.dumps([str(source), ref["nodeId"]], separators=(",", ":"))
        evidence = {"referenceFiles": [str(source)], "referenceHashes": {str(source): hashlib.sha256(source.read_bytes()).hexdigest()},
                    "references": {key: {"complete": True, "read": {"depth": 1, "fields": list(REQUIRED_FIELDS), "total": 1},
                        "pages": {"0": [{"id": ref["nodeId"], "type": "frame", "layout": "vertical", "width": 700, "height": 400}]},
                        "image": {"kind": "reference", "source": {"provider": "pen-mcp", "filePath": str(source), "nodeId": ref["nodeId"]},
                                  "file": str(image), "sha256": hashlib.sha256(image.read_bytes()).hexdigest()}}}}
        inventory = {"pages": [{"componentUuid": "page", "references": [ref], "regions": [
            {"referenceId": "form", "nodeNames": ["Form"], "decision": "Reviewed labels above controls; preserve vertical labels using native Form layout"}]}]}
        reason = {**self.source_reason("界面以 original.pen 为准"), "kind": "reference", "referenceId": "form"}
        return reason, {"inventory": inventory, "evidence": evidence}

    def test_selected_reference_can_preserve_form_label_direction(self):
        reason, references = self.visual_reference()
        form = self.expected["pages"][0]["forms"][0]
        form.update(formLayout="vertical", layoutReason=reason)
        html = self.html.replace('"layout":"horizontal"', '"layout":"vertical"')
        result = check(self.expected, self.overview(), self.readback(html), references)
        self.assertTrue(result["passed"], result["errors"])
        self.assertIn("correctness of visual source interpretation", result["notChecked"])
        self.assertFalse(check(self.expected, self.overview(), self.readback(self.html), references)["passed"])
        # Outer source frame direction is not proof of the labels' orientation.
        next(iter(references["evidence"]["references"].values()))["pages"]["0"][0]["layout"] = "horizontal"
        self.assertTrue(check(self.expected, self.overview(), self.readback(html), references)["passed"])
        self.assertIn("reference inventory and evidence", str(self.result(html)["errors"]))
        form["layoutReason"] = {**self.source_reason("界面以 .pen 为准"), "kind": "reference", "referenceId": "form"}
        self.assertTrue(check(self.expected, self.overview(), self.readback(html), references)["passed"])
        references["inventory"]["pages"][0]["references"].append({"id": "other", "filePath": "/other.pen", "nodeId": "other"})
        self.assertFalse(check(self.expected, self.overview(), self.readback(html), references)["passed"], "Generic selection cannot disambiguate multiple source files")

    def test_reference_reason_rejects_mentions_wrong_form_and_incomplete_evidence(self):
        reason, references = self.visual_reference()
        form = self.expected["pages"][0]["forms"][0]
        form.update(formLayout="vertical", layoutReason=reason)
        html = self.html.replace('"layout":"horizontal"', '"layout":"vertical"')
        def result(refs=references):
            return check(self.expected, self.overview(), self.readback(html), refs)
        for quote in ("附件 original.pen 可供了解项目背景", "界面以 other.pen 为准", "不要以 original.pen 为准",
                      "按需求生成页面；original.pen 仅是历史附件", "按需求生成页面，original.pen 仅是历史附件"):
            form["layoutReason"] = {**self.source_reason(quote), "kind": "reference", "referenceId": "form"}
            self.assertFalse(result()["passed"], quote)
        form["layoutReason"] = reason
        for change in (
            lambda r: r["inventory"]["pages"][0].update(componentUuid="other-page"),
            lambda r: r["inventory"]["pages"][0]["regions"][0].update(nodeNames=["OtherForm"]),
            lambda r: r["inventory"]["pages"][0]["regions"][0].update(decision="Use horizontal labels"),
            lambda r: r["evidence"].update(referenceHashes={}),
            lambda r: next(iter(r["evidence"]["references"].values())).update(complete=False),
            lambda r: next(iter(r["evidence"]["references"].values()))["read"].update(fields=["id", "type"]),
            lambda r: next(iter(r["evidence"]["references"].values()))["image"].update(sha256="changed"),
            lambda r: next(iter(r["evidence"]["references"].values()))["image"]["source"].update(nodeId="other-frame"),
        ):
            invalid = copy.deepcopy(references)
            change(invalid)
            self.assertFalse(result(invalid)["passed"])
        form["layoutReason"] = {**reason, "referenceId": "invented"}
        self.assertFalse(result()["passed"])

    def test_reference_selection_negation_is_scoped_to_the_selection_verb(self):
        _, references = self.visual_reference()
        form = self.expected["pages"][0]["forms"][0]
        form["formLayout"] = "vertical"
        html = self.html.replace('"layout":"horizontal"', '"layout":"vertical"')
        cases = [
            ("按 original.pen 生成，不要额外标题", True),
            ("Use original.pen for labels, do not change content", True),
            ("不要额外标题，按 original.pen 生成", True),
            ("Do not change content; use original.pen for labels", True),
            ("不要以 original.pen 为准", False),
            ("不要按 original.pen 生成", False),
            ("Do not use original.pen for labels", False),
            ("Don't follow original.pen for labels", False),
            ("Never reproduce original.pen", False),
        ]
        for quote, passed in cases:
            with self.subTest(quote=quote):
                form["layoutReason"] = {**self.source_reason(quote), "kind": "reference", "referenceId": "form"}
                result = check(self.expected, self.overview(), self.readback(html), references)
                self.assertEqual(result["passed"], passed, result["errors"])

    def test_reference_reason_standalone_cli_requires_both_evidence_inputs(self):
        reason, references = self.visual_reference()
        self.expected["pages"][0]["forms"][0].update(formLayout="vertical", layoutReason=reason)
        html = self.html.replace('"layout":"horizontal"', '"layout":"vertical"')
        with tempfile.TemporaryDirectory() as directory:
            files = {}
            for name, value in (("expected", self.expected), ("overview", self.overview()), ("readback", self.readback(html)), *references.items()):
                files[name] = str(Path(directory) / (name + ".json"))
                Path(files[name]).write_text(json.dumps(value), encoding="utf-8")
            cmd = [sys.executable, str(Path(__file__).with_name("verify_forms.py")), files["expected"], files["readback"], "--overview", files["overview"]]
            self.assertEqual(subprocess.run(cmd, capture_output=True).returncode, 1)
            self.assertEqual(subprocess.run(cmd + ["--references-inventory", files["inventory"]], capture_output=True).returncode, 2)
            result = subprocess.run(cmd + ["--references-inventory", files["inventory"], "--references-evidence", files["evidence"]], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

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
        form["labelWidth"] = {"longestLabel": "Name", "labelTextPx": 78, "requiredMarkPx": 10, "helpIconPx": 14, "paddingPx": 8, "measuredPx": 110, "measuredFrom": measured_from()}
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

    def row_col_fixture(self, names=("Name", "Desc", "Type", "Mode", "Retention"), full_row=()):
        """Page Form: one Row of span-8 Cols, horizontal right-aligned labels, no tooltips."""
        form = self.expected["pages"][0]["forms"][0]
        base = form["fields"][0]
        base.pop("tooltip")
        base.pop("copyTriage")
        start = self.html.index('<plasmic-component data-plasmic-component="plasmic-antd6-form-item"')
        end = self.html.rindex('</slot></plasmic-component>')
        item_html = self.html[start:end].replace('<slot name="tooltip"><span>Help</span></slot>', '')
        fields, cols = [], []
        for name in names:
            field = copy.deepcopy(base)
            field.update(nodeName=name + "Field", name=name.lower(), control=name, label=name, span=3 if name in full_row else 1)
            fields.append(field)
            item = (item_html.replace('NameField', name + 'Field').replace('"name":"name"', '"name":"' + name.lower() + '"')
                    .replace('data-plasmic-name="Name"', 'data-plasmic-name="' + name + '"').replace('<span>Name</span>', '<span>' + name + '</span>'))
            span = 24 if name in full_row else 8
            cols.append(f'<plasmic-component data-plasmic-component="plasmic-antd6-col" data-plasmic-name="{name}Col" data-props=\'{{"span":{span}}}\'>'
                        f'<slot name="children">{item}</slot></plasmic-component>')
        form["fields"] = fields
        form["layout"] = {"container": "Fields", "columns": 3, "gutter": 16}
        form["labelWidth"] = {"longestLabel": "Retention", "labelTextPx": 70, "requiredMarkPx": 10, "helpIconPx": 0, "paddingPx": 8, "measuredPx": 88, "measuredFrom": measured_from()}
        row = ('<plasmic-component data-plasmic-component="plasmic-antd6-row" data-plasmic-name="Fields" data-props=\'{"gutter":16,"wrap":true}\' '
               'style="align-self:stretch;max-width:none;min-width:0"><slot name="children">' + ''.join(cols) + '</slot></plasmic-component>')
        head = self.html[:start].replace('"layout":"horizontal"', '"layout":"horizontal","labelAlign":"right","labelCol":{"flex":"88px"}')
        return head + row + self.html[end:]

    def test_page_form_requires_one_row_of_cols(self):
        html = self.row_col_fixture()
        self.assertTrue(self.result(html)["passed"], self.result(html))
        form = self.expected["pages"][0]["forms"][0]
        layout = form.pop("layout")
        result = self.result(html)
        self.assertFalse(result["passed"])
        self.assertIn("page-form-structure", str(result["errors"]))
        form["layout"] = layout
        for old, new in [('"span":8}\'><slot name="children"><plasmic-component data-plasmic-component="plasmic-antd6-form-item" data-plasmic-name="ModeField"',
                          '"span":12}\'><slot name="children"><plasmic-component data-plasmic-component="plasmic-antd6-form-item" data-plasmic-name="ModeField"'),
                         ('max-width:none;', ''), ('"wrap":true', '"wrap":false'), ('"gutter":16', '"gutter":24')]:
            with self.subTest(old=old[:40]):
                self.assertFalse(self.result(html.replace(old, new, 1))["passed"])
        form["fields"][0], form["fields"][1] = form["fields"][1], form["fields"][0]
        self.assertFalse(self.result(html)["passed"], "fields must stay in reading order")

    def test_single_row_container_list_matches_the_same_native_row(self):
        html = self.row_col_fixture()
        self.expected['pages'][0]['forms'][0]['layout']['container'] = ['Fields']
        self.assertTrue(self.result(html)['passed'], self.result(html))

    def test_pending_inventory_metadata_is_never_a_valid_decision(self):
        for key in ('layoutReason', 'sourceCopyUnits', 'labelWidth'):
            with self.subTest(key=key):
                form = self.expected['pages'][0]['forms'][0]
                form[key] = '__DECIDE__'
                result = self.result(self.html)
                self.assertFalse(result['passed'])
                self.assertIn('__DECIDE__', str(result['errors']))
                del form[key]

    def test_overlay_dimensions_are_native_values_not_design_presets(self):
        from verify_forms import valid_dimension
        for value in (880, 800.5, '880px', '.5px', '80vw', '40rem', 'calc(100% - 24px)'):
            self.assertTrue(valid_dimension(value), value)
        for value in ('default', 'large'):
            self.assertTrue(valid_dimension(value, drawer=True), value)
            self.assertFalse(valid_dimension(value), value)
        for value in (None, True, False, 0, -10, float('nan'), '', '__DECIDE__', 'wide', '-20px', '0rem'):
            self.assertFalse(valid_dimension(value, drawer=True), value)

    def test_grouped_form_uses_one_row_per_group_card(self):
        html = self.row_col_fixture()
        start = html.index('<plasmic-component data-plasmic-component="plasmic-antd6-row"')
        end = html.rindex('</slot></plasmic-component>')
        cols = html[start:end].split('<slot name="children">', 1)[1].rsplit('</slot></plasmic-component>', 1)[0]
        parts = cols.split('<plasmic-component data-plasmic-component="plasmic-antd6-col"')[1:]
        parts = ['<plasmic-component data-plasmic-component="plasmic-antd6-col"' + part for part in parts]
        def group(name, chunk):
            row = (f'<plasmic-component data-plasmic-component="plasmic-antd6-row" data-plasmic-name="{name}" data-props=\'{{"gutter":16,"wrap":true}}\' '
                   'style="align-self:stretch;max-width:none;min-width:0"><slot name="children">' + ''.join(chunk) + '</slot></plasmic-component>')
            return (f'<plasmic-component data-plasmic-component="plasmic-antd6-card" data-plasmic-name="{name}Card" style="width:100%">'
                    '<slot name="title"><span>' + name + '</span></slot><slot name="children">' + row + '</slot></plasmic-component>')
        grouped = html[:start] + group('BasicGroup', parts[:3]) + group('RuleGroup', parts[3:]) + html[end:]
        form = self.expected["pages"][0]["forms"][0]
        form["layout"]["container"] = ["BasicGroup", "RuleGroup"]
        self.assertTrue(self.result(grouped)["passed"], self.result(grouped))
        form["layout"]["container"] = ["RuleGroup", "BasicGroup"]
        self.assertFalse(self.result(grouped)["passed"], "groups keep reading order")
        form["layout"]["container"] = ["BasicGroup", "RuleGroup"]
        form.pop("labelWidth")
        self.assertFalse(self.result(grouped)["passed"], "grouped Forms still need the measured label width")

    def test_full_row_field_uses_span_24_and_trailing_row_keeps_span_8(self):
        html = self.row_col_fixture(full_row=("Desc",))
        self.assertTrue(self.result(html)["passed"], self.result(html))
        self.assertFalse(self.result(html.replace('"span":24', '"span":8'))["passed"])

    def test_per_line_flex_rows_fail_even_when_declared(self):
        html = self.row_col_fixture()
        start = html.index('<plasmic-component data-plasmic-component="plasmic-antd6-row"')
        items = [chunk.split('<slot name="children">', 1)[1].rsplit('</slot></plasmic-component>', 1)[0]
                 for chunk in html[start:].split('<plasmic-component data-plasmic-component="plasmic-antd6-col"')[1:]]
        flex = lambda group: '<div style="display:flex;flex-direction:row;width:100%;column-gap:16px">' + ''.join(
            i.replace('style="width:100%"', 'style="width:100%;flex:1 1 0;min-width:0"', 1) for i in group) + '</div>'
        rows = '<div label="Fields" style="display:flex;flex-direction:column;width:100%">' + flex(items[:3]) + flex(items[3:]) + '</div>'
        end = html.rindex('</slot></plasmic-component>')
        result = self.result(html[:start] + rows + html[end:])
        self.assertFalse(result["passed"])
        self.assertIn("needs rows", str(result["errors"]))

    def test_default_fill_controls_need_no_width_reason(self):
        html = self.row_col_fixture().replace('data-plasmic-name="Desc" style="width:100%"', 'data-plasmic-name="Desc"')
        self.assertTrue(self.result(html)["passed"], self.result(html))
        narrow = html.replace('data-plasmic-name="Desc"', 'data-plasmic-name="Desc" style="width:240px"')
        self.assertIn("controlWidthReason", str(self.result(narrow)["errors"]))

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
        form["labelWidth"] = {"longestLabel": "Name", "labelTextPx": 78, "requiredMarkPx": 10, "helpIconPx": 14, "paddingPx": 8, "measuredPx": 110, "measuredFrom": measured_from()}
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

    def test_measured_label_width_alone_is_sufficient(self):
        from verify_forms import label_width_problem
        self.assertIn("measuredFrom", label_width_problem({"longestLabel": "名称", "measuredPx": 72}, False))
        stale = {**measured_from(), "sha256": "0" * 64}
        self.assertIn("changed after measurement", label_width_problem({"longestLabel": "名称", "measuredPx": 72, "measuredFrom": stale}, False))
        self.assertIsNone(label_width_problem({"longestLabel": "数据保存天数", "measuredPx": 120, "measuredFrom": measured_from()}, True))
        self.assertIn("positive measuredPx", label_width_problem({"longestLabel": "名称", "measuredPx": "__DECIDE__"}, False))
        self.assertIn("positive measuredPx", label_width_problem({"longestLabel": "名称"}, False))
        # A supplied decomposition must still add up.
        self.assertIn("must equal", label_width_problem(
            {"longestLabel": "名称", "labelTextPx": 28, "requiredMarkPx": 10, "helpIconPx": 0, "paddingPx": 8, "measuredPx": 90, "measuredFrom": measured_from()}, False))

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
        form["sourceCopyUnits"] = [unit for unit in form["sourceCopyUnits"] if unit["field"] == form["fields"][0]["nodeName"]]
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
