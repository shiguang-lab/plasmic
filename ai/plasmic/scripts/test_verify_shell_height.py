import copy
import unittest
from verify_shell_height import check


class ShellHeightTests(unittest.TestCase):
    def setUp(self):
        self.readback = {"results": [{"type": "page", "uuid": "detail", "baseVariantTplTree":
            '<div style="width:stretch; height:100vh; min-height:0; overflow:hidden"><plasmic-component data-plasmic-component="plasmicOverseasAppShell" style="height:100%"></plasmic-component></div>'}]}
        self.snapshot = {"frames": [{"frameUuid": "desktop", "height": 1024, "ready": True, "truncated": False, "elements": [
            {"classes": "__wab_instance shell", "y": 0, "height": 1024},
            {"classes": "ant-layout ant-layout-has-sider", "y": 0, "height": 1024},
            {"classes": "ant-layout-sider", "y": 0, "height": 1024},
        ]}]}

    def test_viewport_fill_at_full_and_short_height(self):
        for height in [1024, 807]:
            self.snapshot["frames"][0]["height"] = height
            for element in self.snapshot["frames"][0]["elements"]:
                element["height"] = height
            self.assertTrue(check(self.readback, self.snapshot)["passed"])

    def test_short_and_overflowing_shells_fail_even_when_the_document_is_clipped(self):
        self.snapshot["frames"][0]["contentHeight"] = 1024
        for height in [742, 1713]:
            for element in self.snapshot["frames"][0]["elements"]:
                element["height"] = height
            self.assertFalse(check(self.readback, self.snapshot)["passed"])

    def test_default_or_fixed_shell_height_cannot_pass_at_one_matching_viewport(self):
        original = self.readback["results"][0]["baseVariantTplTree"]
        for height in ["default", "auto", "1024px"]:
            self.readback["results"][0]["baseVariantTplTree"] = original.replace('style="height:100%"', f'style="height:{height}"')
            self.assertFalse(check(self.readback, self.snapshot)["passed"])
        self.readback["results"][0]["baseVariantTplTree"] = original.replace(' style="height:100%"', '')
        self.assertFalse(check(self.readback, self.snapshot)["passed"])

    def test_indefinite_root_fails_even_when_geometry_happens_to_fill(self):
        original = self.readback["results"][0]["baseVariantTplTree"]
        for height in ["stretch", "auto", "100%", "1024px"]:
            self.readback["results"][0]["baseVariantTplTree"] = original.replace("height:100vh;", f"height:{height}; min-height:100vh; max-height:100vh;")
            self.assertFalse(check(self.readback, self.snapshot)["passed"])

    def test_root_width_must_preserve_studio_page_sizing(self):
        original = self.readback["results"][0]["baseVariantTplTree"]
        for width in ["100%", "100vw", "1440px", "auto"]:
            self.readback["results"][0]["baseVariantTplTree"] = original.replace("width:stretch;", f"width:{width};")
            result = check(self.readback, self.snapshot)
            self.assertFalse(result["passed"])
            self.assertTrue(any("width:stretch" in error for error in result["errors"]))
        self.readback["results"][0]["baseVariantTplTree"] = original
        self.assertTrue(check(self.readback, self.snapshot)["passed"])

    def test_shell_percentage_width_is_allowed(self):
        self.readback["results"][0]["baseVariantTplTree"] = self.readback["results"][0]["baseVariantTplTree"].replace('style="height:100%"', 'style="width:100%; height:100%"')
        self.assertTrue(check(self.readback, self.snapshot)["passed"])

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
        for key, value in [("ready", False), ("truncated", True), ("height", 0), ("elements", [])]:
            snapshot = copy.deepcopy(self.snapshot)
            snapshot["frames"][0][key] = value
            cases.append(snapshot)
        for snapshot in cases:
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
            for field in ['y', 'height']:
                snapshot = copy.deepcopy(self.snapshot)
                snapshot['frames'][0]['elements'][0][field] = value
                with self.subTest(value=value, field=field):
                    self.assertFalse(check(self.readback, snapshot)['passed'])
            snapshot = copy.deepcopy(self.snapshot)
            snapshot['frames'][0]['height'] = value
            with self.subTest(value=value, field='viewport'):
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
