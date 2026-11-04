from pathlib import Path
import tempfile
import unittest

from artifact_manifest import check, seal


class ArtifactManifestTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        (self.root / "response.md").write_text("observed output", encoding="utf-8")

    def test_seal_checks_files_and_cannot_overwrite_original(self):
        seal(self.root)
        self.assertTrue(check(self.root)["passed"])
        with self.assertRaises(FileExistsError):
            seal(self.root)

    def test_missing_changed_and_extra_files_are_reported(self):
        (self.root / "trace.jsonl").write_text("trace", encoding="utf-8")
        seal(self.root)
        (self.root / "trace.jsonl").unlink()
        (self.root / "response.md").write_text("changed", encoding="utf-8")
        (self.root / "new.md").write_text("new", encoding="utf-8")
        report = check(self.root)
        self.assertFalse(report["passed"])
        self.assertEqual(report["missing"], ["trace.jsonl"])
        self.assertEqual(report["changed"], ["response.md"])
        self.assertEqual(report["added"], ["new.md"])

    def test_dependencies_are_excluded_but_evidence_symlinks_fail(self):
        (self.root / "node_modules").symlink_to(self.root, target_is_directory=True)
        seal(self.root)
        self.assertTrue(check(self.root)["passed"])
        (self.root / "external.md").symlink_to(self.root / "response.md")
        with self.assertRaises(ValueError):
            check(self.root)


if __name__ == "__main__":
    unittest.main()
