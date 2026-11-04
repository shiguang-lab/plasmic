import copy
import hashlib
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

    def test_persistence_command_binds_both_models_to_matching_runtime_environments(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            model = dict(type='page', uuid='page', pageMeta={'path': '/records'}, baseVariantTplTree='<div></div>')
            raw = json.dumps({'results': [model]}).encode()
            first, second = root / 'first.json', root / 'second.json'
            first.write_bytes(raw); second.write_bytes(raw)
            identity = {'projectId': 'project', 'branchId': None, 'sessionId': 'before', 'revision': 1, 'changeCounter': 0}
            capture = {'projectId': 'project', 'before': identity, 'after': identity,
                       'desktopVersion': '0.6.6', 'build': {'rendererHash': 'a' * 64, 'desktopHash': 'b' * 64},
                       'files': {'pages.json': hashlib.sha256(raw).hexdigest()}}
            reopened = copy.deepcopy(capture)
            reopened['before']['sessionId'] = reopened['after']['sessionId'] = 'reopened'
            first_capture, second_capture = root / 'first-capture.json', root / 'second-capture.json'
            first_capture.write_text(json.dumps(capture))
            second_capture.write_text(json.dumps(reopened))
            command = [sys.executable, str(Path(__file__).with_name('compare_models.py')), str(first), str(second)]
            plain = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(plain.returncode, 0, plain.stderr)
            self.assertEqual(json.loads(plain.stdout)['scope'], 'normalized Page models only')
            self.assertIn('cannot carry a runtime report forward', ' '.join(json.loads(plain.stdout)['notChecked']))
            command += ['--first-capture', str(first_capture), '--second-capture', str(second_capture)]
            valid = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(valid.returncode, 0, valid.stderr)
            self.assertTrue(json.loads(valid.stdout)['captureComparison']['passed'])
            self.assertIn('runtime execution', json.loads(valid.stdout)['notChecked'])

            changes = {
                'renderer changed': {'build': {**reopened['build'], 'rendererHash': 'c' * 64}},
                'desktop changed': {'build': {**reopened['build'], 'desktopHash': 'c' * 64}},
                'source build changed': {'build': {**reopened['build'], 'sourceHash': 'c' * 64}},
                'missing build': {'build': None},
                'version changed': {'desktopVersion': '0.6.7'},
                'scope changed': {'pagePath': '/records'},
                'project mismatch': {'projectId': 'other'},
                'readback hash changed': {'files': {'pages.json': 'c' * 64}},
                'unstable capture': {'after': {**reopened['after'], 'revision': 2}},
                'different branch': {'before': {**reopened['before'], 'branchId': 'branch'},
                                     'after': {**reopened['after'], 'branchId': 'branch'}},
            }
            for label, change in changes.items():
                with self.subTest(label=label):
                    second_capture.write_text(json.dumps({**reopened, **change}))
                    result = subprocess.run(command, capture_output=True, text=True)
                    self.assertEqual(result.returncode, 1, result.stderr)
                    report = json.loads(result.stdout)
                    self.assertFalse(report['passed'])
                    self.assertTrue(report['pages'][0]['equal'], 'Models remain equal; capture continuity must independently fail')
                    self.assertFalse(report['captureComparison']['passed'])
            first_capture.write_text(json.dumps({**capture, 'files': {}}))
            second_capture.write_text(json.dumps(reopened))
            result = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(result.returncode, 1, result.stderr)
            self.assertIn('first: capture pages hash', ' '.join(json.loads(result.stdout)['captureComparison']['errors']))

    def test_capture_arguments_must_be_supplied_as_a_pair(self):
        command = [sys.executable, str(Path(__file__).with_name('compare_models.py')),
                   'unused-first.json', 'unused-second.json', '--first-capture', 'unused-capture.json']
        result = subprocess.run(command, capture_output=True, text=True)
        self.assertEqual(result.returncode, 2)
        self.assertIn('must be supplied together', result.stderr)


if __name__ == "__main__":
    unittest.main()
