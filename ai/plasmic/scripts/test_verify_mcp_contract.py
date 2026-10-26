import copy
import contextlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from verify_mcp_contract import check, main


class ContractTests(unittest.TestCase):
    def setUp(self):
        reads = {"view": {"enum": ["tree", "properties", "contract", "context", "full"]}, "propNames": {"type": "array"}}
        self.state = {"ready": True, "projectId": "p", "buildId": "build", "editorContext": {"sessionId": "session"},
                      "editorTools": {name: {"inputSchema": {"properties": copy.deepcopy(reads)}} for name in ("read", "queryElements")}}
        self.state["runtimeCapabilities"] = {
            "preview": ["open", "close", "state", "snapshot", "click", "hover", "fill", "select", "press", "scroll", "screenshot", "assert"],
            "design_reference": ["index", "read", "screenshot"],
            "reference_browser": ["load_page", "capture", "close"], "import_reference": ["editable", "screenshot"],
        }
        self.state["editorTools"]["validate"] = {"inputSchema": {"properties": {"componentUuids": {"type": "array"}}}}
        self.tool_list = {"tools": [{"name": "preview", "inputSchema": {"properties": {"action": {"enum": ["open", "close"]}, "componentUuid": {"type": "string"}, "width": {"type": "integer"}, "height": {"type": "integer"}}}}]}

    def test_current_advertised_contracts_pass(self):
        self.assertNotIn("preview", self.state["editorTools"])
        self.assertTrue(check(self.state, self.tool_list)["passed"])

    def test_editor_preview_cannot_replace_missing_top_level_tool(self):
        self.state["editorTools"]["preview"] = self.tool_list["tools"][0]
        report = check(self.state, {"tools": []})
        self.assertFalse(report["passed"])
        self.assertIn("MCP tools/list", " ".join(report["errors"]))

    def test_missing_preview_action_or_parameter_is_rejected(self):
        for missing in ("open", "close", "action", "componentUuid", "width", "height"):
            with self.subTest(missing=missing):
                tool_list = copy.deepcopy(self.tool_list)
                fields = tool_list["tools"][0]["inputSchema"]["properties"]
                if missing in ("open", "close"):
                    fields["action"]["enum"].remove(missing)
                else:
                    del fields[missing]
                self.assertFalse(check(self.state, tool_list)["passed"])

    def run_cli(self, source, tool_list):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "state.json").write_text(json.dumps(self.state), encoding="utf-8")
            (root / "tools.json").write_text(json.dumps(tool_list), encoding="utf-8")
            report_path = root / "report.json"
            argv = ["verify_mcp_contract.py", source, str(root / "state.json"),
                    "--tools", str(root / "tools.json"), "--report", str(report_path)]
            output = io.StringIO()
            with patch("sys.argv", argv), contextlib.redirect_stdout(output), self.assertRaises(SystemExit) as exit_result:
                main()
            report = json.loads(output.getvalue())
            self.assertEqual(report, json.loads(report_path.read_text(encoding="utf-8")))
            return exit_result.exception.code, report

    def test_cli_replays_separate_state_and_tool_list(self):
        code, report = self.run_cli("--state", self.tool_list)
        self.assertEqual(code, 0)
        self.assertTrue(report["passed"])

    def test_profile_collects_only_native_editor_operations(self):
        with patch("verify_all.Desktop") as desktop:
            desktop.return_value.call.return_value = self.state
            code, report = self.run_cli("--profile", self.tool_list)
            desktop.return_value.call.assert_called_once_with(
                "get_app_state", {"toolNames": ["read", "queryElements", "validate"]})
        self.assertEqual(code, 0)
        self.assertTrue(report["passed"])

    def test_cli_reports_missing_tool_without_prescribing_desktop_upgrade(self):
        code, report = self.run_cli("--state", {"tools": []})
        self.assertEqual(code, 1)
        self.assertIn("MCP tools/list", " ".join(report["errors"]))
        self.assertIn("collection errors", report["nextAction"])

    def test_source_free_reference_browser_cannot_pass_preflight(self):
        self.state["runtimeCapabilities"]["reference_browser"].append("open")
        report = check(self.state, self.tool_list)
        self.assertFalse(report["passed"])
        self.assertIn("source-free open", " ".join(report["errors"]))

    def test_missing_runtime_interaction_or_reference_bridge_is_rejected(self):
        for name in self.state["runtimeCapabilities"]:
            state = copy.deepcopy(self.state)
            state["runtimeCapabilities"][name] = []
            self.assertFalse(check(state, self.tool_list)["passed"])

    def test_old_candidate_contract_cannot_pass_current_resources(self):
        for tool in ("read", "queryElements"):
            state = copy.deepcopy(self.state)
            fields = state["editorTools"][tool]["inputSchema"]["properties"]
            fields["view"]["enum"].remove("properties")
            del fields["propNames"]
            self.assertFalse(check(state, self.tool_list)["passed"])

    def test_native_validation_and_runtime_identity_are_required(self):
        for missing in ("validate", "session", "build"):
            state = copy.deepcopy(self.state)
            if missing == "validate":
                del state["editorTools"][missing]
            elif missing == "session":
                state["editorContext"] = {}
            else:
                del state["buildId"]
            self.assertFalse(check(state, self.tool_list)["passed"])


if __name__ == "__main__":
    unittest.main()
