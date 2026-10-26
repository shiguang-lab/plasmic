import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from compare_models import canonical, fingerprint, load


class ModelComparisonTests(unittest.TestCase):
    def test_only_element_ids_are_normalized(self):
        model = dict(type='page', uuid='page', pageMeta={'path': '/records'},
                     baseVariantTplTree='<div id="node-a">\n<span id=\'node-b\'>Record</span></div>')
        renamed = {**model, 'baseVariantTplTree': model['baseVariantTplTree'].replace('node-a', 'node-x').replace('node-b', 'node-y')}
        self.assertEqual(fingerprint(canonical(model)), fingerprint(canonical(renamed)))
        for markup in ('<div id="node" data-record-id="REC-001"></div>',
                       '<div id="node">Selected id="REC-001"</div>',
                       '<div id="node" title=\'Selected id="REC-001"\'></div>'):
            first = {**model, 'baseVariantTplTree': markup}
            second = {**model, 'baseVariantTplTree': markup.replace('REC-001', 'REC-002')}
            with self.subTest(markup=markup):
                self.assertNotEqual(fingerprint(canonical(first)), fingerprint(canonical(second)))

    def test_typed_state_change_is_not_equal(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            model = dict(type="page", uuid="page", pageMeta={"path": "/records"},
                         baseVariantTplTree="<div></div>", states=[{"name": "flag", "initialValue": True}])
            first, second = root / "first.json", root / "second.json"
            first.write_text(json.dumps({"results": [model]}))
            second.write_text(first.read_text())
            command = [sys.executable, str(Path(__file__).with_name("compare_models.py")), str(first), str(second)]
            self.assertEqual(subprocess.run(command, capture_output=True).returncode, 0)
            model["states"][0]["initialValue"] = 1
            second.write_text(json.dumps({"results": [model]}))
            run = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(run.returncode, 1, run.stderr)
            self.assertFalse(json.loads(run.stdout)["passed"])

    def test_duplicate_or_empty_routes_cannot_be_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "pages.json"
            model = dict(type="page", uuid="page", pageMeta={"path": "/records"}, baseVariantTplTree="<div></div>")
            path.write_text(json.dumps({"results": [model, model]}))
            with self.assertRaisesRegex(ValueError, "Distinct nonempty"):
                load(path)
            model["pageMeta"]["path"] = ""
            path.write_text(json.dumps({"results": [model]}))
            with self.assertRaisesRegex(ValueError, "Distinct nonempty"):
                load(path)


if __name__ == "__main__":
    unittest.main()
