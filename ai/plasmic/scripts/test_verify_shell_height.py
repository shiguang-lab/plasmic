import copy
import unittest
from verify_shell_height import check


class ShellHeightTests(unittest.TestCase):
    def setUp(self):
        self.readback = {"results": [{"type": "page", "uuid": "detail", "baseVariantTplTree":
            '<div style="display:flex; flex-direction:column; width:stretch; height:stretch"><plasmic-component data-plasmic-component="plasmicOverseasAppShell"></plasmic-component></div>'}]}
        self.snapshot = {"frames": [{"frameUuid": "desktop", "width": 1440, "height": 1024, "ready": True, "truncated": False, "elements": [
            {"classes": "__wab_instance shell", "x": 0, "width": 1440, "y": 0, "height": 1024},
            {"classes": "ant-layout ant-layout-has-sider", "x": 0, "width": 1440, "y": 0, "height": 1024},
            {"classes": "ant-layout-sider", "y": 0, "height": 1024},
        ]}]}

    def test_viewport_fill_at_full_and_short_height(self):
        for height in [1024, 807]:
            self.snapshot["frames"][0]["height"] = height
            for element in self.snapshot["frames"][0]["elements"]:
                element["height"] = height
            self.assertTrue(check(self.readback, self.snapshot)["passed"])

    def test_fluid_shell_fills_wider_and_narrower_viewports(self):
        for width in [1280, 1512, 1920]:
            self.snapshot["frames"][0]["width"] = width
            for element in self.snapshot["frames"][0]["elements"][:2]:
                element["width"] = width
            self.assertTrue(check(self.readback, self.snapshot)["passed"])

    def test_fixed_width_is_rejected_at_a_wider_viewport(self):
        self.snapshot["frames"][0]["width"] = 1512
        result = check(self.readback, self.snapshot)
        self.assertFalse(result["passed"])
        self.assertEqual(len(result["errors"]), 2)
        self.assertEqual(result["measurements"][0]["right"], 1440)

    def test_layout_and_shell_width_are_measured_independently(self):
        for index in [0, 1]:
            for width in [1300, 1600]:
                snapshot = copy.deepcopy(self.snapshot)
                snapshot["frames"][0]["elements"][index]["width"] = width
                self.assertFalse(check(self.readback, snapshot)["passed"])

    def test_horizontal_offset_and_rounding_tolerance(self):
        self.snapshot["frames"][0]["elements"][0]["x"] = 0.5
        self.assertTrue(check(self.readback, self.snapshot)["passed"])
        self.snapshot["frames"][0]["elements"][0]["x"] = 16
        self.assertFalse(check(self.readback, self.snapshot)["passed"])

    def test_short_and_overflowing_shells_fail_even_when_the_document_is_clipped(self):
        self.snapshot["frames"][0]["contentHeight"] = 1024
        for height in [742, 1713]:
            for element in self.snapshot["frames"][0]["elements"]:
                element["height"] = height
            self.assertFalse(check(self.readback, self.snapshot)["passed"])

    def test_component_owned_height_does_not_require_instance_styles(self):
        original = self.readback["results"][0]["baseVariantTplTree"]
        for css in ["", "height:100vh", "height:100%", "height:default", "height:auto", "height:1024px"]:
            # Instance CSS cannot override the component's inline viewport height.
            self.readback["results"][0]["baseVariantTplTree"] = original.replace(
                'data-plasmic-component="plasmicOverseasAppShell"',
                f'data-plasmic-component="plasmicOverseasAppShell" style="{css}"')
            self.assertTrue(check(self.readback, self.snapshot)["passed"])
            snapshot = copy.deepcopy(self.snapshot)
            snapshot["frames"][0]["elements"][0]["height"] = 742
            self.assertFalse(check(self.readback, snapshot)["passed"])

    def test_parent_height_is_not_a_shell_requirement(self):
        original = self.readback["results"][0]["baseVariantTplTree"]
        for height in ["stretch", "auto", "100%", "1024px", "100vh"]:
            self.readback["results"][0]["baseVariantTplTree"] = original.replace("height:stretch", f"height:{height}")
            self.assertTrue(check(self.readback, self.snapshot)["passed"])

    def test_parent_width_does_not_determine_viewport_height(self):
        original = self.readback["results"][0]["baseVariantTplTree"]
        for width in ["100%", "100vw", "1440px", "auto"]:
            self.readback["results"][0]["baseVariantTplTree"] = original.replace("width:stretch;", f"width:{width};")
            result = check(self.readback, self.snapshot)
            self.assertTrue(result["passed"])
        self.readback["results"][0]["baseVariantTplTree"] = original
        self.assertTrue(check(self.readback, self.snapshot)["passed"])

    def test_missing_or_multiple_page_roots_fail(self):
        for html in ["", self.readback["results"][0]["baseVariantTplTree"] + "<div></div>"]:
            self.readback["results"][0]["baseVariantTplTree"] = html
            self.assertFalse(check(self.readback, self.snapshot)["passed"])

    def test_sidebar_and_outer_shell_are_measured_independently(self):
        for index in [0, 2]:
            snapshot = copy.deepcopy(self.snapshot)
            snapshot["frames"][0]["elements"][index]["height"] = 742
            self.assertFalse(check(self.readback, snapshot)["passed"])

    def test_shifted_shell_and_rounding_tolerance(self):
        self.snapshot["frames"][0]["elements"][0]["y"] = 0.5
        self.assertTrue(check(self.readback, self.snapshot)["passed"])
        self.snapshot["frames"][0]["elements"][0]["y"] = 16
        self.assertFalse(check(self.readback, self.snapshot)["passed"])

    def test_missing_ambiguous_or_incomplete_geometry_fails(self):
        cases = [{"frames": []}, {"frames": self.snapshot["frames"] * 2}]
        for key, value in [("ready", False), ("truncated", True), ("width", None), ("width", 0), ("height", 0), ("elements", [])]:
            snapshot = copy.deepcopy(self.snapshot)
            snapshot["frames"][0][key] = value
            cases.append(snapshot)
        for snapshot in cases:
            self.assertFalse(check(self.readback, snapshot)["passed"])

    def test_missing_or_zero_shell_width_fails(self):
        for value in [None, 0, -1]:
            snapshot = copy.deepcopy(self.snapshot)
            snapshot["frames"][0]["elements"][0]["width"] = value
            self.assertFalse(check(self.readback, snapshot)["passed"])

    def test_shell_registration_and_model_scope_are_required(self):
        original = self.readback["results"][0]["baseVariantTplTree"]
        self.readback["results"][0]["baseVariantTplTree"] = original.replace("plasmicOverseasAppShell", "plasmic-antd6-app-shell")
        self.assertTrue(check(self.readback, self.snapshot)["passed"])
        self.readback["results"][0]["baseVariantTplTree"] = original.replace("plasmicOverseasAppShell", "OtherShell")
        self.assertFalse(check(self.readback, self.snapshot)["passed"])
        self.assertFalse(check({"results": []}, self.snapshot)["passed"])

    def test_nonfinite_or_non_numeric_measurements_cannot_pass_tolerance_checks(self):
        for value in [float('nan'), float('inf'), float('-inf'), True, None, "1024"]:
            for field in ['x', 'width', 'y', 'height']:
                snapshot = copy.deepcopy(self.snapshot)
                snapshot['frames'][0]['elements'][0][field] = value
                with self.subTest(value=value, field=field):
                    self.assertFalse(check(self.readback, snapshot)['passed'])
            for field in ['width', 'height']:
                snapshot = copy.deepcopy(self.snapshot)
                snapshot['frames'][0][field] = value
                with self.subTest(value=value, field='viewport-' + field):
                    self.assertFalse(check(self.readback, snapshot)['passed'])

    def test_ready_and_truncated_flags_require_literal_booleans(self):
        for field, values in [('ready', [1, 'true', None]), ('truncated', [0, '', None])]:
            for value in values:
                snapshot = copy.deepcopy(self.snapshot)
                snapshot['frames'][0][field] = value
                with self.subTest(field=field, value=value):
                    self.assertFalse(check(self.readback, snapshot)['passed'])


if __name__ == "__main__":
    unittest.main()
