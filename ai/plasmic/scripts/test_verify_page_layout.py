import copy
import unittest
from verify_page_layout import check


class PageLayoutTests(unittest.TestCase):
    def setUp(self):
        self.project = {"__type": "Project", "components": [{"uuid": "page", "type": "page"}],
                        "devicePresets": [{"name": "Desktop", "width": 1440, "height": 1024}],
                        "pageFrames": [{"componentUuid": "page", "width": 1440, "height": 1024}],
                        "canvases": [{"name": "页面总览", "frames": [{"uuid": "frame", "componentUuid": "page", "width": 1440, "height": 1024, "x": 0, "y": 0}]}]}

    def result(self, name=None):
        return check({"results": [self.project]}, overview_name=name)

    def test_native_desktop_and_shared_reference_pass(self):
        self.assertTrue(self.result()["passed"])

    def test_custom_resolution_mobile_and_missing_frames_fail(self):
        original = copy.deepcopy(self.project)
        for frames in [[], [{"componentUuid": "page", "width": 1366, "height": 768}],
                       self.project["pageFrames"] + [{"componentUuid": "page", "width": 414, "height": 736}]]:
            self.project = {**copy.deepcopy(original), "pageFrames": frames}
            self.assertFalse(self.result()["passed"])

    def test_explicit_group_requires_each_page_once(self):
        frame = self.project["canvases"][0]["frames"][0]
        for groups in [[], [{"name": "Empty", "frames": []}], [{"name": "Duplicate", "frames": [frame, frame]}],
                       self.project["canvases"] * 2]:
            self.project["canvases"] = groups
            self.assertTrue(self.result()["passed"])
            self.assertFalse(self.result("页面总览")["passed"])

    def test_invalid_preset_geometry_cannot_establish_a_native_device(self):
        for value in (True, 0, float("nan"), "1440"):
            self.project["devicePresets"][0]["width"] = value
            self.assertFalse(self.result()["passed"])

    def test_group_names_are_checked_only_when_requested(self):
        group = self.project["canvases"][0]
        group["name"] = "健身"
        self.project["canvases"].append({"name": "信贷", "frames": []})
        self.assertTrue(self.result()["passed"])
        self.assertTrue(self.result("健身")["passed"])
        self.assertFalse(self.result("信贷")["passed"])
        self.assertFalse(self.result("页面总览")["passed"])
        self.assertFalse(self.result("")["passed"])

    def test_explicit_other_device_is_supported(self):
        self.project["devicePresets"][0]["name"] = "RequestedDevice"
        self.assertTrue(check({"results": [self.project]}, ["RequestedDevice"])["passed"])
        self.assertFalse(self.result()["passed"])


if __name__ == "__main__":
    unittest.main()
