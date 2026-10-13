import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from verify_all import GATES, collect, run_suite, write_json
import test_verify_forms
import test_verify_shell_height


class SuiteTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        shell = test_verify_shell_height.ShellHeightTests()
        shell.setUp()
        form = test_verify_forms.FormCheckTests()
        form.setUp()
        self.model = shell.readback["results"][0]
        self.model.update(uuid="page", name="Records", pageMeta={"path": "/records"})
        menu = [{"key": "records", "label": "Records", "href": "/records"}]
        self.model["baseVariantTplTree"] = self.model["baseVariantTplTree"].replace('style="height:100%"',
            'data-plasmic-name="AppShell" data-props=\'' + json.dumps({"menuItems": menu}) + '\' style="height:100%"').replace(
                '</plasmic-component>', '<slot name="children">' + form.html + '</slot></plasmic-component>')
        self.overview = {"results": [{"__type": "Project", "components": [self.model]}]}
        self.readback = {"results": [self.model]}
        self.snapshot = shell.snapshot
        self.context = {"projectId": "project", "branchId": None, "revision": 1, "changeCounter": 0}
        self.config = {
            "structure": {"inventory": "structure.json"}, "forms": {"inventory": "forms.json"},
            "descriptions": {"inventory": "descriptions.json"}, "overlays": {"inventory": "overlays.json"},
            "slots": {"pages": [{"path": "/records", "intent": "intent.html"}]}, "shell_height": {},
        }
        write_json(self.root / "overview.json", self.overview)
        write_json(self.root / "pages.json", self.readback)
        write_json(self.root / "layouts.json", {"page": {"snapshot": self.snapshot}})
        write_json(self.root / "capture.json", {"projectId": "project", "before": self.context, "after": self.context})
        write_json(self.root / "structure.json", {"pages": [{"path": "/records", "source": "requirement §Records"}],
                   "navigation": {"items": menu, "source": "requirement §Navigation"}})
        form.expected["pages"][0].pop("componentUuid")
        form.expected["pages"][0]["path"] = "/records"
        write_json(self.root / "forms.json", form.expected)
        for gate, key in [("descriptions", "groups"), ("overlays", "overlays")]:
            write_json(self.root / (gate + ".json"), {"pages": [{"path": "/records", key: []}]})
        (self.root / "intent.html").write_text(self.model["baseVariantTplTree"])

    def run_suite(self):
        return run_suite(self.config, self.root, self.root, "project")

    def test_all_six_existing_gates_pass(self):
        report = self.run_suite()
        self.assertTrue(report["passed"], report)
        self.assertEqual([check["gate"] for check in report["checks"]], ["evidence", *GATES])
        self.assertIn("save/reopen persistence", report["notChecked"])

    def test_independent_failures_are_aggregated(self):
        (self.root / "forms.json").write_text("invalid JSON")
        write_json(self.root / "layouts.json", {"page": {"error": "Editor command timed out: metadata"}})
        report = self.run_suite()
        self.assertFalse(report["passed"])
        self.assertEqual({item["gate"] for item in report["checks"] if item["status"] == "failed"}, {"forms", "shell_height"})
        self.assertEqual(len(report["checks"]), 7)

    def test_missing_gates_do_not_pass_and_exemptions_require_reason(self):
        del self.config["forms"]
        report = self.run_suite()
        self.assertFalse(report["passed"])
        self.assertEqual(next(item for item in report["checks"] if item["gate"] == "forms")["status"], "unverified")
        self.config["forms"] = {"notApplicable": "No business Forms in this reviewed scope"}
        self.assertTrue(self.run_suite()["passed"])
        self.config["forms"] = {"notApplicable": ""}
        self.assertFalse(self.run_suite()["passed"])

    def test_invalid_gate_input_does_not_abort_remaining_checks(self):
        write_json(self.root / "forms.json", [])
        self.config["shell_height"] = {"pages": []}
        report = self.run_suite()
        self.assertFalse(report["passed"])
        self.assertEqual(len(report["checks"]), 7)
        failures = {item["gate"]: item for item in report["checks"] if item["status"] == "failed"}
        self.assertIn("errorType", failures["forms"]["report"])
        self.assertIn("shell_height", failures)

    def test_dynamic_menu_is_not_evaluated_or_silently_accepted(self):
        self.model["baseVariantTplTree"] = self.model["baseVariantTplTree"].replace(
            json.dumps({"menuItems": [{"key": "records", "label": "Records", "href": "/records"}]}),
            json.dumps({"menuItems": "{{ $state.menu }}"}))
        write_json(self.root / "pages.json", self.readback)
        report = self.run_suite()
        structure = next(item for item in report["checks"] if item["gate"] == "structure")
        self.assertEqual(structure["status"], "failed")
        self.assertIn("Static menuItems", json.dumps(structure))

    def test_changed_context_and_incomplete_page_reads_fail(self):
        for field, value in [("projectId", "other"), ("branchId", "branch"), ("revision", 2), ("changeCounter", 1)]:
            with self.subTest(field=field):
                write_json(self.root / "capture.json", {"projectId": "project", "before": self.context,
                           "after": {**self.context, field: value}})
                self.assertFalse(self.run_suite()["passed"])
        write_json(self.root / "capture.json", {"projectId": "project", "before": self.context, "after": self.context})
        write_json(self.root / "pages.json", {"results": [self.model, self.model]})
        self.assertFalse(self.run_suite()["passed"])

    def test_every_page_height_is_checked(self):
        other = {**self.model, "uuid": "other", "pageMeta": {"path": "/other"}}
        self.overview["results"][0]["components"].append(other)
        self.readback["results"].append(other)
        write_json(self.root / "overview.json", self.overview)
        write_json(self.root / "pages.json", self.readback)
        height = next(item for item in self.run_suite()["checks"] if item["gate"] == "shell_height")
        self.assertEqual(height["status"], "failed")
        self.assertEqual(len(height["report"]["pages"]), 2)

    def test_cli_writes_markdown_json_and_preserves_prior_output(self):
        write_json(self.root / "suite.json", self.config)
        output = self.root / "report"
        command = [sys.executable, str(Path(__file__).with_name("verify_all.py")), "--project-id", "project",
                   "--evidence", str(self.root), "--expectations", str(self.root / "suite.json"), "--output", str(output)]
        run = subprocess.run(command, capture_output=True, text=True)
        self.assertEqual(run.returncode, 0, run.stderr + run.stdout)
        self.assertTrue(json.loads((output / "report.json").read_text())["passed"])
        self.assertIn("Not checked", (output / "report.md").read_text())
        before = (output / "report.json").read_bytes()
        self.assertNotEqual(subprocess.run(command, capture_output=True).returncode, 0)
        self.assertEqual(before, (output / "report.json").read_bytes())

    def test_collection_uses_targeted_snapshots_and_never_navigates_or_saves(self):
        calls = []
        fixture = self

        class Desktop:
            def call(self, method, input=None):
                calls.append((method, input))
                if method == "get_app_state":
                    return {"ready": True, "projectId": "project", "version": "test"}
                if method == "snapshot_layout":
                    fixture.assertEqual(input, {"componentUuid": "page"})
                    return fixture.snapshot
                raise AssertionError(method)

            def execute(self, name, input=None):
                calls.append((name, input))
                if name == "identify":
                    return {}
                if name == "getEditorContext":
                    return fixture.context
                if name == "read":
                    return fixture.readback if input else fixture.overview
                raise AssertionError(name)

        collect(Desktop(), "project", self.root)
        self.assertEqual([name for name, _ in calls], ["get_app_state", "identify", "getEditorContext", "read", "read", "snapshot_layout", "getEditorContext"])
        calls.clear()
        with self.assertRaisesRegex(ValueError, "never switches"):
            collect(Desktop(), "wrong-project", self.root)
        self.assertEqual(len(calls), 1)


if __name__ == "__main__":
    unittest.main()
