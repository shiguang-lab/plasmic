import copy
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from verify_references import check, REQUIRED_FIELDS


class ReferenceTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.file = Path(self.directory.name) / "reference.webp"
        self.file.write_bytes(b"original Pen image fixture")
        reference_file = str(Path(self.directory.name) / "original.pen")
        self.source = {"provider": "pen-mcp", "filePath": reference_file, "nodeId": "frame"}
        self.expected = {"pages": [{"path": "/list", "componentUuid": "page", "references": [{"id": "main", "filePath": reference_file, "nodeId": "frame"}], "regions": [{"referenceId": "main", "nodeNames": ["SearchForm", "RecordsTable"], "decision": "Preserve hierarchy through native Form/Table contracts"}]}]}
        self.model = {"results": [{"uuid": "page", "baseVariantTplTree": '<div data-plasmic-name="SearchForm"></div><div data-plasmic-name="RecordsTable"></div>'}]}
        self.key = json.dumps([reference_file, "frame"], separators=(",", ":"))
        self.task = {"referenceFiles": [reference_file], "references": {self.key: {"complete": True, "read": {"depth": 1, "fields": list(REQUIRED_FIELDS), "total": 2}, "pages": {"0": [{"id": "frame", "type": "frame"}], "1": [{"id": "child", "type": "text"}]}, "image": {"kind": "reference", "source": self.source, "file": str(self.file), "sha256": hashlib.sha256(self.file.read_bytes()).hexdigest()}}}}

    def test_original_layout_image_and_native_region_mapping_are_required(self):
        result = check(self.expected, self.model, self.task)
        self.assertTrue(result["passed"], result["errors"])
        self.assertIn("visual fidelity and adaptation decisions", result["notChecked"])

    def test_text_only_missing_state_or_invented_native_region_fails(self):
        for change in (lambda e: e["read"].update(fields=["id", "content"]), lambda e: e.update(complete=False), lambda e: e["image"]["source"].update(nodeId="other")):
            task = copy.deepcopy(self.task)
            change(task["references"][self.key])
            self.assertFalse(check(self.expected, self.model, task)["passed"])
        self.expected["pages"][0]["regions"][0]["nodeNames"] = ["InventedNode"]
        self.assertFalse(check(self.expected, self.model, self.task)["passed"])

    def test_complete_flag_cannot_hide_partial_wrong_or_gapped_layout_reads(self):
        for change in (lambda e: e["pages"].pop("1"), lambda e: e["pages"].update({"3": e["pages"].pop("1")}),
                       lambda e: e["read"].update(total=3), lambda e: e["pages"]["0"][0].update(id="other"),
                       lambda e: e["read"].update(depth=True)):
            task = copy.deepcopy(self.task)
            change(task["references"][self.key])
            self.assertFalse(check(self.expected, self.model, task)["passed"])

    def test_replaced_source_image_fails(self):
        self.file.write_bytes(b"replacement")
        self.assertFalse(check(self.expected, self.model, self.task)["passed"])


if __name__ == "__main__":
    unittest.main()
