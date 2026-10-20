import copy
import unittest
from verify_rendering import check


class RenderingTests(unittest.TestCase):
    def setUp(self):
        self.layout = {"page": {"snapshot": {"frames": [{"ready": True, "truncated": False,
            "read": {"view": "full"}, "width": 1440, "height": 1024,
            "elements": [{"horizontalOverflow": False}], "images": [{"loaded": True}], "problems": []}]}}}

    def test_clipped_scrolling_content_without_reported_overflow_passes(self):
        self.assertTrue(check(self.layout, ["page"])["passed"])

    def test_missing_partial_or_failed_layout_cannot_pass(self):
        for key, value in [("ready", 1), ("truncated", 0), ("read", {"view": "summary"}),
                           ("width", float("nan")), ("height", 0), ("elements", []), ("images", None)]:
            layout = copy.deepcopy(self.layout)
            layout["page"]["snapshot"]["frames"][0][key] = value
            self.assertFalse(check(layout, ["page"])["passed"], key)
        self.assertFalse(check(self.layout, ["other"])["passed"])

    def test_real_overflow_and_unloaded_images_cannot_pass(self):
        for key, value in [("problems", [{"type": "horizontal-overflow"}]),
                           ("elements", [{"horizontalOverflow": True}]), ("images", [{"loaded": False}])]:
            layout = copy.deepcopy(self.layout)
            layout["page"]["snapshot"]["frames"][0][key] = value
            self.assertFalse(check(layout, ["page"])["passed"], key)
