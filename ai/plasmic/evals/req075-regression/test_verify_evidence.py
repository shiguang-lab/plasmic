import copy
import hashlib
import json
from pathlib import Path
import tempfile
import subprocess
import sys
import unittest
from unittest.mock import patch

from verify_evidence import HERE, check
from verify_all import evidence_hashes, write_json


class VisualEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.manifest = json.loads((HERE / 'short-screen-evidence.json').read_text())
        source = self.root / 'requirement.md'
        source.write_text('Reviewed requirement fixture')
        self.manifest['source'] = {'path': str(source), 'sha256': hashlib.sha256(source.read_bytes()).hexdigest()}
        models = {'results': [dict(uuid=str(i), type='page', pageMeta={'path': path},
                      baseVariantTplTree='<div></div>', props=[], states=[], variants=[], variantGroups=[], interactions=[])
                  for i, path in enumerate(['/req-075/groups', '/req-075/regular', '/req-075/onetime', '/req-075/detail'])]}
        self.current = self.root / 'current'
        for directory in [self.root / 'original', self.current]:
            directory.mkdir()
            write_json(directory / 'pages.json', models)
            write_json(directory / 'overview.json', {'results': [{'__type': 'Project', 'id': self.manifest['projectId'], 'components': models['results']}]})
            write_json(directory / 'layouts.json', {})
            identity = dict(projectId=self.manifest['projectId'], branchId=None, sessionId=directory.name, revision=164, changeCounter=0)
            write_json(directory / 'capture.json', dict(projectId=self.manifest['projectId'], before=identity, after=identity,
                  desktopVersion=self.manifest['desktopVersion'], build=self.manifest['build'],
                  collectedAt='2026-10-17T00:00:00+00:00', files=evidence_hashes(directory)))
        self.manifest['modelCapture'] = {'path': 'original', 'pagesSha256': evidence_hashes(self.current)['pages.json']}
        for case in self.manifest['cases']:
            for capture in case['captures']:
                file = self.root / capture['path']
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_bytes(capture['path'].encode())
                capture['sha256'] = hashlib.sha256(file.read_bytes()).hexdigest()

    def result(self, manifest=None):
        return check(manifest or self.manifest, self.current, self.root)

    def test_unchanged_models_can_reference_intact_historical_images_across_sessions(self):
        result = self.result()
        self.assertTrue(result['passed'], result)
        self.assertEqual((result['surfaces'], result['captures']), (13, 25))
        self.assertIn('not a new Preview', result['scope'])

    def test_missing_surface_state_duplicate_screenshot_and_review_failure_are_rejected(self):
        for kind in ['surface', 'state', 'duplicate', 'review']:
            manifest = copy.deepcopy(self.manifest)
            if kind == 'surface':
                manifest['cases'].pop()
            elif kind == 'state':
                next(c for c in manifest['cases'] if c.get('overlay') == 'ApplicationModal')['captures'].pop(2)
            elif kind == 'duplicate':
                manifest['cases'][0]['captures'][1] = copy.deepcopy(manifest['cases'][0]['captures'][0])
            else:
                manifest['passed'] = False
            with self.subTest(kind=kind):
                self.assertFalse(self.result(manifest)['passed'])

    def test_changed_build_or_branch_invalidates_visual_applicability(self):
        file = self.current / 'capture.json'
        original = json.loads(file.read_text())
        for kind in ['build', 'branch']:
            capture = copy.deepcopy(original)
            if kind == 'build':
                capture['build']['rendererHash'] = 'f' * 64
            else:
                capture['before']['branchId'] = capture['after']['branchId'] = 'other-branch'
            write_json(file, capture)
            self.assertFalse(self.result()['passed'], kind)

    def test_duplicate_image_identity_fails_with_complete_state_coverage(self):
        manifest = copy.deepcopy(self.manifest)
        first, second = manifest['cases'][0]['captures']
        second.update({key: first[key] for key in ['path', 'sha256']})
        self.assertNotEqual(first['state'], second['state'])
        self.assertFalse(self.result(manifest)['passed'])

    def test_every_case_requires_pass_observation_and_short_viewport(self):
        for key, value in [('passed', False), ('passed', 1), ('observation', '  '),
                           ('viewport', {'width': 1440, 'height': 1024})]:
            manifest = copy.deepcopy(self.manifest)
            manifest['cases'][0][key] = value
            with self.subTest(field=key, value=value):
                self.assertFalse(self.result(manifest)['passed'])

    def test_behavior_rejects_tampering_even_with_python_optimization(self):
        file = self.current / 'pages.json'
        file.write_text(file.read_text() + ' ')
        output = self.root / 'behavior'
        run = subprocess.run([sys.executable, '-O', str(HERE / 'run-behavior.py'), str(self.current), str(output)],
                             capture_output=True, text=True)
        self.assertNotEqual(run.returncode, 0)
        self.assertIn('captured file hashes', run.stderr)
        self.assertFalse(output.exists())

    def test_behavior_rejects_extra_page_even_when_route_count_stays_four(self):
        models = json.loads((self.current / 'pages.json').read_text())
        extra = {**models['results'][0], 'uuid': 'extra'}
        models['results'].append(extra)
        write_json(self.current / 'pages.json', models)
        overview = json.loads((self.current / 'overview.json').read_text())
        overview['results'][0]['components'].append(extra)
        write_json(self.current / 'overview.json', overview)
        capture = json.loads((self.current / 'capture.json').read_text())
        capture['files'] = evidence_hashes(self.current)
        write_json(self.current / 'capture.json', capture)
        output = self.root / 'behavior'
        run = subprocess.run([sys.executable, str(HERE / 'run-behavior.py'), str(self.current), str(output)],
                             capture_output=True, text=True)
        self.assertNotEqual(run.returncode, 0)
        self.assertIn('Duplicate Page path', run.stderr)
        self.assertFalse(output.exists())

    def test_boolean_to_number_change_is_a_model_change(self):
        for directory in [self.root / 'original', self.current]:
            models = json.loads((directory / 'pages.json').read_text())
            models['results'][0]['states'] = [{'name': 'flag', 'initialValue': True}]
            write_json(directory / 'pages.json', models)
            capture = json.loads((directory / 'capture.json').read_text())
            capture['files'] = evidence_hashes(directory)
            write_json(directory / 'capture.json', capture)
        self.manifest['modelCapture']['pagesSha256'] = evidence_hashes(self.current)['pages.json']
        models['results'][0]['states'][0]['initialValue'] = 1
        write_json(self.current / 'pages.json', models)
        capture['files'] = evidence_hashes(self.current)
        write_json(self.current / 'capture.json', capture)
        self.assertFalse(self.result()['passed'])

    def test_boolean_to_number_build_change_invalidates_applicability(self):
        path = self.current / 'capture.json'
        capture = json.loads(path.read_text())
        capture['build']['dirty'] = 1
        write_json(path, capture)
        self.assertFalse(self.result()['passed'])

    def test_visual_replay_rejects_files_replaced_after_loading(self):
        original = Path.read_bytes
        changed = False

        def read_bytes(path, *args, **kwargs):
            nonlocal changed
            raw = original(path, *args, **kwargs)
            if path == self.current / 'pages.json' and not changed:
                changed = True
                models = json.loads(raw)
                models['results'][0]['states'] = [{'name': 'replacement'}]
                write_json(path, models)
                capture = json.loads((self.current / 'capture.json').read_text())
                capture['files'] = evidence_hashes(self.current)
                write_json(self.current / 'capture.json', capture)
            return raw

        with patch.object(Path, 'read_bytes', read_bytes):
            with self.assertRaisesRegex(ValueError, 'captured file hashes'):
                self.result()
        self.assertTrue(changed)

    def test_changed_file_source_and_model_require_new_review(self):
        screenshot = self.root / self.manifest['cases'][0]['captures'][0]['path']
        original = screenshot.read_bytes()
        screenshot.write_bytes(b'changed')
        self.assertFalse(self.result()['passed'])
        screenshot.write_bytes(original)
        source = Path(self.manifest['source']['path'])
        original = source.read_bytes()
        source.write_bytes(b'changed')
        self.assertFalse(self.result()['passed'])
        source.write_bytes(original)
        models = json.loads((self.current / 'pages.json').read_text())
        models['results'][0]['states'] = [{'name': 'changed'}]
        write_json(self.current / 'pages.json', models)
        capture = json.loads((self.current / 'capture.json').read_text())
        capture['files'] = evidence_hashes(self.current)
        write_json(self.current / 'capture.json', capture)
        self.assertFalse(self.result()['passed'])


if __name__ == '__main__':
    unittest.main()
