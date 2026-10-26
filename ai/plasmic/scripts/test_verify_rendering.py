import copy
import unittest
from verify_rendering import check


class RenderingTests(unittest.TestCase):
    def setUp(self):
        self.layout = {"page": {"snapshot": {"checked": ["horizontal-overflow", "table-cell-control-overflow", "image-load"], "frames": [{"ready": True, "truncated": False,
            "read": {"view": "full"}, "width": 1440, "height": 1024,
            "elements": [{"horizontalOverflow": False}], "images": [{"loaded": True}], "problems": []}]}}}

    def test_clipped_scrolling_content_without_reported_overflow_passes(self):
        self.assertTrue(check(self.layout, ["page"])["passed"])

    def test_old_capture_without_cell_containment_check_cannot_pass(self):
        del self.layout["page"]["snapshot"]["checked"]
        self.assertFalse(check(self.layout, ["page"])["passed"])

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

    def test_sticky_cell_controls_cannot_spill_into_padding_inside_the_viewport(self):
        frame = self.layout["page"]["snapshot"]["frames"][0]
        frame["elements"] = [{"horizontalOverflow": False, "cellContent": {
            "overflow": True, "requiredWidth": 160, "paddingLeft": 8, "paddingRight": 8,
        }}]
        self.assertFalse(check(self.layout, ["page"])["passed"])
        frame["elements"][0]["cellContent"]["overflow"] = False
        self.assertTrue(check(self.layout, ["page"])["passed"])
    def test_fixed_operation_column_is_sized_from_its_widest_row(self):
        frame = self.layout["page"]["snapshot"]["frames"][0]
        def cell(required, width=220):
            return {"tag": "td", "x": 1179, "width": width, "horizontalOverflow": False,
                    "cellContent": {"overflow": False, "requiredWidth": required, "paddingLeft": 16, "paddingRight": 16}}
        # Regression: a saved 220px operation column around 176px of actions.
        frame["elements"] = [cell(176), cell(120)]
        self.assertFalse(check(self.layout, ["page"])["passed"])
        frame["elements"] = [cell(162, 162), cell(120, 162)]
        self.assertTrue(check(self.layout, ["page"])["passed"])
        frame["elements"] = [cell(155, 162)]
        self.assertTrue(check(self.layout, ["page"])["passed"], "Rounding up stays within slack")


if __name__ == "__main__":
    unittest.main()
