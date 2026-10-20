import copy
import unittest
from verify_page_layout import check


class PageLayoutTests(unittest.TestCase):
    def setUp(self):
        self.project = {"__type": "Project", "components": [{"uuid": "page", "type": "page"}],
                        "devicePresets": [{"name": "Desktop", "width": 1440, "height": 1024}],
                        "pageFrames": [{"componentUuid": "page", "width": 1440, "height": 1024}],
                        "canvases": [{"name": "页面总览", "frames": [{"uuid": "frame", "componentUuid": "page", "width": 1440, "height": 1024, "x": 0, "y": 0}]}]}

    def result(self):
        return check({"results": [self.project]})

    def test_native_desktop_and_shared_reference_pass(self):
        self.assertTrue(self.result()["passed"])

    def test_custom_resolution_mobile_and_missing_frames_fail(self):
        original = copy.deepcopy(self.project)
        for frames in [[], [{"componentUuid": "page", "width": 1366, "height": 768}],
                       self.project["pageFrames"] + [{"componentUuid": "page", "width": 414, "height": 736}]]:
            self.project = {**copy.deepcopy(original), "pageFrames": frames}
            self.assertFalse(self.result()["passed"])

    def test_empty_missing_duplicate_and_overlapping_overviews_fail(self):
        frame = self.project["canvases"][0]["frames"][0]
        for groups in [[], [{"name": "Empty", "frames": []}], [{"name": "Duplicate", "frames": [frame, frame]}],
                       self.project["canvases"] * 2]:
            self.project["canvases"] = groups
            self.assertFalse(self.result()["passed"])

    def test_invalid_preset_geometry_cannot_establish_a_native_device(self):
        for value in (True, 0, float("nan"), "1440"):
            self.project["devicePresets"][0]["width"] = value
            self.assertFalse(self.result()["passed"])

    def test_overview_directory_name_checks_defaults_and_reviewed_override(self):
        for name in ("Custom arena 1", "Pages overview", "", None):
            self.project["canvases"][0]["name"] = name
            self.assertFalse(self.result()["passed"])
        self.project["canvases"][0]["name"] = "客群管理页面总览"
        self.assertFalse(self.result()["passed"])
        self.assertTrue(check({"results": [self.project]}, overview_name="客群管理页面总览")["passed"])
        self.project["canvases"][0]["name"] = "Explicit user name"
        self.assertTrue(check({"results": [self.project]}, overview_name="Explicit user name")["passed"])
        self.assertFalse(check({"results": [self.project]}, overview_name="")["passed"])

    def test_explicit_other_device_is_supported(self):
        self.project["devicePresets"][0]["name"] = "RequestedDevice"
        self.assertTrue(check({"results": [self.project]}, ["RequestedDevice"])["passed"])
        self.assertFalse(self.result()["passed"])
