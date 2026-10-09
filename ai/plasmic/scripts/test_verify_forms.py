import unittest
import copy
import json
import subprocess
import sys
import tempfile
from pathlib import Path
from verify_forms import check


class FormCheckTests(unittest.TestCase):
    def setUp(self):
        self.expected = {"pages": [{"componentUuid": "page", "forms": [{"name": "Form", "fields": [{"nodeName": "NameField", "name": "name", "label": "Name", "control": "Name", "rules": [{"ruleType": "required"}], "tooltip": "Help"}]}]}]}
        self.html = '''<plasmic-component data-plasmic-component="plasmicAntd6Form" data-plasmic-name="Form"><slot name="children"><plasmic-component data-plasmic-component="plasmic-antd6-form-item" data-plasmic-name="NameField" data-props='{"name":"name","rules":[{"ruleType":"required","message":"Required"}]}'><slot name="label"><span>Name</span></slot><slot name="tooltip"><span>Help</span></slot><slot name="children"><plasmic-component data-plasmic-component="plasmic-antd6-input" data-plasmic-name="Name" data-props='{}'></plasmic-component></slot></plasmic-component></slot></plasmic-component>'''

    def result(self, html):
        return check(self.expected, self.overview(), self.readback(html))

    def overview(self):
        return {"results": [{"__type": "Project", "components": [{"uuid": "page", "type": "page"}]}]}

    def readback(self, html):
        return {"results": [{"uuid": "page", "type": "page", "baseVariantTplTree": html}]}

    def test_real_fields_pass_with_both_component_name_formats(self):
        self.assertTrue(self.result(self.html)["passed"])

    def test_native_form_layout_and_single_error_setting(self):
        form = self.expected["pages"][0]["forms"][0]
        form["formLayout"] = "horizontal"
        form["fields"][0]["validateFirst"] = True
        html = self.html.replace('data-plasmic-name="Form"', 'data-plasmic-name="Form" data-props=\'{"layout":"horizontal"}\'').replace('"name":"name","rules"', '"name":"name","validateFirst":true,"rules"')
        self.assertTrue(self.result(html)["passed"])
        self.assertFalse(self.result(html.replace('"horizontal"', '"vertical"'))["passed"])
        self.assertFalse(self.result(html.replace('"validateFirst":true', '"validateFirst":false'))["passed"])

    def test_persistent_description_must_belong_to_item(self):
        self.expected["pages"][0]["forms"][0]["fields"][0]["description"] = "Default 14 days"
        html = self.html.replace('<slot name="label">', '<slot name="description"><span>Default 14 days</span></slot><slot name="label">')
        self.assertTrue(self.result(html)["passed"])
        self.assertFalse(self.result(self.html + '<span>Default 14 days</span>')["passed"])
        duplicate = html.replace('</slot></plasmic-component>', '<span>Default 14 days</span></slot></plasmic-component>')
        self.assertFalse(self.result(duplicate)["passed"])

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
        form["layout"] = {"container": "Fields", "modalWidth": 640, "columns": 2, "columnGap": 16, "rows": [{"container": "ShortRow", "fields": ["TypeField", "ScenarioField"]}]}
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
        html = self.html[:start].replace('data-plasmic-name="Form"', 'data-plasmic-name="Form" style="width:100%"') + '<div label="Fields" style="display:flex;flex-direction:column;width:100%">' + item + row + '</div>' + self.html[end:]
        return '<plasmic-component data-plasmic-component="plasmic-antd6-modal" data-props=\'{"width":"640"}\'>' + html + '</plasmic-component>'

    def test_full_width_rows_and_short_field_pair_pass(self):
        html = self.grid_fixture()
        self.assertTrue(self.result(html)["passed"])
        self.assertTrue(self.result(html.replace('column-gap:', 'grid-column-gap:'))["passed"])

    def test_shrinking_container_wrong_columns_gap_and_field_span_fail(self):
        html = self.grid_fixture()
        for old, new in [('width:100%', 'width:50%'), ('"width":"640"', '"width":"800"'), ('repeat(2', 'repeat(1'), ('column-gap:16px', 'column-gap:24px'), ('display:flex;flex-direction:column', 'display:flex;flex-direction:row'), ('display:flex;flex-direction:column', 'display:flex;flex-direction:column;row-gap:24px')]:
            with self.subTest(old=old):
                self.assertFalse(self.result(html.replace(old, new))["passed"])
        self.expected["pages"][0]["forms"][0]["fields"][0]["span"] = 1
        self.assertFalse(self.result(html)["passed"])

    def test_compact_single_column_modal_passes(self):
        html = self.grid_fixture()
        form = self.expected["pages"][0]["forms"][0]
        form["fields"] = form["fields"][:1]
        form["fields"][0]["span"] = 1
        form["layout"].update(modalWidth=480, columns=1, rows=[])
        html = html[:html.index('<div label="ShortRow"')] + '</div></slot></plasmic-component></plasmic-component>'
        html = html.replace('"width":"640"', '"width":"480"')
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
        marker = '<plasmic-component data-plasmic-component="plasmic-antd6-input" data-plasmic-name="Name" data-props=\'{}\'></plasmic-component>'
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
