import copy
import hashlib
from pathlib import Path
import tempfile
import unittest

from verify_page_sequence import check


class PageSequenceTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.base = Path(self.directory.name)
        self.events = [{"kind": "started"}]
        self.task = {"id": "run", "pages": [], "images": {}, "pinned": {}, "ended": "complete"}
        for route in ("/list", "/detail"):
            name = route[1:]
            report = self.base / (name + "-report.json")
            report.write_text('{"passed": true}')
            image = self.base / (name + ".webp")
            image.write_bytes(b"actual image fixture")
            sha = lambda file: hashlib.sha256(file.read_bytes()).hexdigest()
            evidence = {"id": name, "page": route, "file": str(image), "sha256": sha(image)}
            self.task["images"][name] = evidence
            self.task["pages"].append({"path": route, "runtimeCases": [{"id": "query"}]})
            self.events.extend([
                {"kind": "begin_page", "page": route},
                {"kind": "mutation", "page": route},
                {"kind": "structural_check", "page": route, "report": {"reportPath": str(report), "sha256": sha(report)}},
                {"kind": "image", "page": route, "evidence": evidence},
                {"kind": "visual_review", "page": route, "status": "review_recorded", "observations": [{"generatedEvidenceId": name, "result": "matched"}]},
                {"kind": "begin_case", "page": route, "caseId": "query"},
                {"kind": "preview", "page": route, "action": "assert", "caseId": "query", "caseCompleted": True, "passed": True, "checks": [{"passed": True}]},
                {"kind": "complete_page", "page": route},
            ])
        final = self.base / "final-report.json"
        final.write_text('{"passed":true}')
        self.events.append({"kind": "finished", "reportPath": str(final), "sha256": sha(final)})

    def result(self, events=None):
        events = copy.deepcopy(events if events is not None else self.events)
        for index, event in enumerate(events):
            event["seq"] = index + 1
        return check({**self.task, "seq": len(events)}, events)

    def test_actual_page_loop_retains_independent_visual_scope(self):
        self.assertTrue(self.result()["passed"])
        self.assertIn("visual quality remains independent", self.result()["scope"])

    def test_all_page_bodies_before_checks_are_rejected(self):
        events = [self.events[0], *self.events[1:3], *self.events[9:11], *self.events[3:9], *self.events[11:]]
        self.assertFalse(self.result(events)["passed"])

    def test_failed_assertion_or_new_edit_requires_new_checkpoints(self):
        events = copy.deepcopy(self.events)
        next(e for e in events if e["kind"] == "preview")["passed"] = False
        self.assertFalse(self.result(events)["passed"])
        events = [*self.events[:8], {"kind": "mutation", "page": "/list"}, *self.events[8:]]
        self.assertFalse(self.result(events)["passed"])

    def test_reopened_session_or_reread_reference_invalidates_acceptance(self):
        events = [*self.events[:-1], {"kind": "reopened"}, self.events[-1]]
        self.assertFalse(self.result(events)["passed"])
        self.task["pages"][0]["references"] = [{"filePath": "/tmp/original.pen", "nodeId": "frame"}]
        events = [*self.events[:-1], {"kind": "reference_changed", "pages": ["/list"]}, self.events[-1]]
        self.assertFalse(self.result(events)["passed"])

    def test_unchanged_reference_acquisition_preserves_completed_evidence(self):
        events = [*self.events[:-1], {"kind": "reference_read", "action": "read", "source": {"filePath": "/tmp/original.pen", "nodeId": "frame"}}, self.events[-1]]
        self.assertTrue(self.result(events)["passed"])

    def test_destination_revision_requires_repeating_dependent_navigation(self):
        self.task["pages"][0]["runtimeCases"].append({"id": "navigate", "deferred": True, "targetPath": "/detail"})
        navigation = [
            {"kind": "begin_case", "page": "/list", "caseId": "navigate"},
            {"kind": "preview", "page": "/detail", "caseId": "navigate", "caseCompleted": True, "passed": True, "checks": [{"passed": True}]},
        ]
        for change in ({"kind": "plan_revised", "pages": ["/detail"]}, {"kind": "reference_changed", "pages": ["/detail"]}):
            events = [*self.events[:-1], *navigation, change, *copy.deepcopy(self.events[9:17]), self.events[-1]]
            self.assertFalse(self.result(events)["passed"])
            self.assertTrue(self.result([*events[:-1], *copy.deepcopy(navigation), events[-1]])["passed"])

    def test_changed_final_report_is_rejected(self):
        (self.base / "final-report.json").write_text('{"passed":false}')
        self.assertFalse(self.result()["passed"])

    def test_changed_screenshot_is_rejected(self):
        (self.base / "list.webp").write_bytes(b"replaced")
        self.assertFalse(self.result()["passed"])

    def test_synthetic_timeline_format_is_not_accepted(self):
        with self.assertRaises(ValueError):
            check({"pages": ["/list"], "events": []}, [])


if __name__ == "__main__":
    unittest.main()
