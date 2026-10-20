import copy
import unittest

from verify_mcp_contract import check


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
        self.state["editorTools"]["preview"] = {"inputSchema": {"properties": {"action": {"enum": ["open", "close"]}, "componentUuid": {}, "width": {}, "height": {}}}}

    def test_current_advertised_contracts_pass(self):
        self.assertTrue(check(self.state)["passed"])

    def test_source_free_reference_browser_cannot_pass_preflight(self):
        self.state["runtimeCapabilities"]["reference_browser"].append("open")
        report = check(self.state)
        self.assertFalse(report["passed"])
        self.assertIn("source-free open", " ".join(report["errors"]))

    def test_missing_runtime_interaction_or_reference_bridge_is_rejected(self):
        for name in self.state["runtimeCapabilities"]:
            state = copy.deepcopy(self.state)
            state["runtimeCapabilities"][name] = []
            self.assertFalse(check(state)["passed"])

    def test_old_candidate_contract_cannot_pass_current_resources(self):
        for tool in ("read", "queryElements"):
            state = copy.deepcopy(self.state)
            fields = state["editorTools"][tool]["inputSchema"]["properties"]
            fields["view"]["enum"].remove("properties")
            del fields["propNames"]
            self.assertFalse(check(state)["passed"])

    def test_native_preview_and_runtime_identity_are_required(self):
        for missing in ("preview", "validate", "session", "build"):
            state = copy.deepcopy(self.state)
            if missing in ("preview", "validate"):
                del state["editorTools"][missing]
            elif missing == "session":
                state["editorContext"] = {}
            else:
                del state["buildId"]
            self.assertFalse(check(state)["passed"])


if __name__ == "__main__":
    unittest.main()
