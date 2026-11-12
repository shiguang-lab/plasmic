import copy
import hashlib
import json
import struct
import subprocess
import sys
import tempfile
import unittest
import zlib
from pathlib import Path

import verify_codegen_visual as gate


STATE = {'projectId': 'project', 'branchId': None, 'sessionId': 'session', 'revision': 4, 'changeCounter': 0}
CONTEXT = {'viewport': {'width': 1200, 'height': 800}, 'contentWidth': 1100,
           'fixture': 'Account A, 5 rows', 'role': 'Editor', 'locale': 'zh-CN', 'scroll': 'Top of panel'}


class CodegenVisualTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        (self.root / 'src').mkdir()
        (self.root / 'src/page.tsx').write_text('export const Page = () => null;')
        self.plan = {'implementation': {'root': str(self.root), 'paths': ['src']},
                     'pages': [{'path': '/records', 'visualScenarios': []}]}
        self.capture = {'before': dict(STATE), 'after': dict(STATE), 'pagePath': None}
        self.readback = {'results': [{'type': 'page', 'name': 'Records', 'pageMeta': {'path': '/records'},
                                     'props': [], 'states': [], 'interactions': [], 'variants': [],
                                     'variantGroups': [], 'variantSettings': [],
                                     'baseVariantTplTree': '<div id="root">Records</div>'}]}
        self.overview = {'results': [{'__type': 'Project', 'id': 'project',
                                     'globalVariantGroups': [], 'screenBreakpoints': []}]}
        self.serial = 0

    def image(self):
        self.serial += 1
        def chunk(kind, body):
            return struct.pack('>I', len(body)) + kind + body + struct.pack('>I', zlib.crc32(kind + body))
        data = (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 1, 1, 8, 2, 0, 0, 0))
                + chunk(b'IDAT', zlib.compress(b'\0\x00\x00\x00')) + chunk(b'IEND', b''))
        path = self.root / f'capture-{self.serial}.png'
        path.write_bytes(data)
        return {'path': str(path), 'sha256': hashlib.sha256(data).hexdigest()}

    def attempt(self):
        return {'design': {'checkedState': dict(STATE), 'screenshot': self.image(),
                           'context': copy.deepcopy(CONTEXT), 'steps': ['Select the design state in Preview']},
                'implementation': {'sourceSha256': gate.source_snapshot(self.plan)['sha256'],
                                   'screenshot': self.image(), 'context': copy.deepcopy(CONTEXT),
                                   'steps': ['Open /records and select the corresponding state'],
                                   'url': 'http://localhost:5173/records'},
                'analysis': {'layout': 'Both panels fit the same content width with aligned footer actions.',
                             'content': 'Both show the same five record labels and status values.',
                             'controls': 'Both show the enabled entry and reachable close action.'},
                'issues': [], 'repairs': []}

    def review(self):
        review = gate.skeleton(self.plan, self.capture, self.readback, self.overview)
        for page in review['pages']:
            page['sourceCoverage'] = {'reviewed': True, 'sources': ['Requirements section 2'],
                                      'notes': 'Reconciled all panel, permission and fixture outcomes with the source.'}
            for scene in page['visualScenarios']:
                scene.update(given='Account A with five records', steps=['Enter the required state'],
                             expected='Required content and controls fit the panel', context=copy.deepcopy(CONTEXT),
                             attempts=[self.attempt()])
        return review

    def result(self, review):
        return gate.check(self.plan, review, self.capture, self.readback, self.overview)

    @staticmethod
    def scene(review):
        return review['pages'][0]['visualScenarios'][0]

    def test_complete_pair_and_identical_pixels_in_separate_captures_pass(self):
        self.assertEqual(self.result(self.review()), {'passed': True, 'errors': []})

    def test_missing_each_discovered_state_blocks(self):
        model = self.readback['results'][0]
        model['variants'] = [{'__type': 'ComponentVariant', 'type': 'single', 'group': 'Mode',
                              'variant': {'__type': 'Variant', 'uuid': 'compact', 'name': 'Compact'}}]
        model['baseVariantTplTree'] = '''<div id="root">
          <div id="hidden" data-visibility="notRendered">Hidden</div>
          <button id="entry" disabled="{{ $state.readonly }}">Edit</button>
          <plasmic-component id="drawer" data-plasmic-component="plasmic-antd6-drawer">
            <plasmic-component id="tab" data-plasmic-component="plasmic-antd6-tab-item"></plasmic-component>
          </plasmic-component></div>'''
        self.overview['results'][0]['screenBreakpoints'] = [
            {'__type': 'ScreenBreakpoint', 'uuid': 'mobile', 'name': 'Mobile'}]
        self.overview['results'][0]['globalVariantGroups'] = [
            {'__type': 'GlobalVariantGroup', 'uuid': 'theme', 'name': 'Theme',
             'variants': [{'__type': 'Variant', 'uuid': 'dark', 'name': 'Dark'}]}]
        review = self.review()
        self.assertTrue(self.result(review)['passed'])
        records = review['pages'][0]['visualScenarios']
        self.assertEqual({s['kind'] for s in records},
                         {'default', 'variant', 'visibility', 'entry', 'overlay', 'panel', 'breakpoint', 'global-variant'})
        for index in range(len(records)):
            with self.subTest(scene=records[index]['id']):
                missing = copy.deepcopy(review)
                del missing['pages'][0]['visualScenarios'][index]
                self.assertFalse(self.result(missing)['passed'])

    def test_both_images_are_required_and_verified(self):
        for side in ('design', 'implementation'):
            for damage in ('missing', 'hash', 'bytes', 'same-file'):
                with self.subTest(side=side, damage=damage):
                    review = self.review()
                    attempt = self.scene(review)['attempts'][0]
                    picture = attempt[side]['screenshot']
                    if damage == 'missing':
                        del attempt[side]['screenshot']
                    elif damage == 'hash':
                        picture['sha256'] = '0' * 64
                    elif damage == 'bytes':
                        Path(picture['path']).write_text('not an image')
                        picture['sha256'] = hashlib.sha256(b'not an image').hexdigest()
                    else:
                        attempt['implementation']['screenshot'] = attempt['design']['screenshot']
                    self.assertFalse(self.result(review)['passed'])

    def test_pair_context_must_match_scene(self):
        for field, value in [('viewport', {'width': 900, 'height': 800}), ('contentWidth', 1000),
                             ('fixture', 'Different account'), ('role', 'Reader'),
                             ('locale', 'en-US'), ('scroll', 'Bottom of panel')]:
            review = self.review()
            self.scene(review)['attempts'][0]['implementation']['context'][field] = value
            with self.subTest(field=field):
                self.assertFalse(self.result(review)['passed'])

    def test_stale_source_modified_added_deleted_and_review_only_relabel_rejected(self):
        for mutation in ('modified', 'added', 'deleted'):
            with self.subTest(mutation=mutation):
                file = self.root / 'src/page.tsx'
                file.write_text('original')
                review = self.review()
                if mutation == 'modified':
                    file.write_text('updated')
                elif mutation == 'added':
                    (self.root / 'src/new.tsx').write_text('new component')
                else:
                    file.unlink()
                    (self.root / 'src/other.tsx').write_text('remaining component')
                self.assertFalse(self.result(review)['passed'])
                review['checkedImplementation'] = gate.source_snapshot(self.plan)
                self.assertFalse(self.result(review)['passed'])

    def test_repair_requires_fresh_retest_and_current_code(self):
        review = self.review()
        scene = self.scene(review)
        first = scene['attempts'][0]
        first['issues'] = [{'id': 'clipped', 'description': 'Implementation footer is clipped; design footer fits.'}]
        first['repairs'] = [{'issueId': 'clipped', 'change': 'Corrected panel flex sizing in src/page.tsx.'}]
        self.assertFalse(self.result(review)['passed'])
        (self.root / 'src/page.tsx').write_text('fixed panel sizing')
        review['checkedImplementation'] = gate.source_snapshot(self.plan)
        second = self.attempt()
        second['design'] = copy.deepcopy(first['design'])
        scene['attempts'].append(second)
        self.assertTrue(self.result(review)['passed'])
        second['implementation']['screenshot'] = first['implementation']['screenshot']
        self.assertFalse(self.result(review)['passed'])

    def test_malformed_omitted_unknown_and_unreconciled_records_rejected(self):
        mutations = [lambda r: r.update(pages=[]), lambda r: r['pages'].append(copy.deepcopy(r['pages'][0])),
                     lambda r: r['pages'][0].update(sourceCoverage={}),
                     lambda r: self.scene(r).update(id='unknown'),
                     lambda r: self.scene(r).update(state='wrong'),
                     lambda r: self.scene(r).update(attempts=[]),
                     lambda r: self.scene(r)['attempts'][0].update(analysis={'layout': 'pass', 'content': 'ok', 'controls': '正常'}),
                     lambda r: self.scene(r)['attempts'][0]['design']['checkedState'].update(revision=3),
                     lambda r: self.scene(r)['attempts'][0]['implementation'].update(url=''),
                     lambda r: r.update(checkedPlanSha256='old')]
        for index, mutation in enumerate(mutations):
            with self.subTest(index=index):
                review = self.review()
                mutation(review)
                self.assertFalse(self.result(review)['passed'])

    def test_source_declared_case_cannot_be_removed_or_rewritten(self):
        source = {'id': 'empty', 'kind': 'business', 'nodeName': 'Records', 'state': 'empty',
                  'source': 'Requirement 3', 'given': 'No records', 'steps': ['Query account B'],
                  'expected': 'Empty result and query controls'}
        self.plan['pages'][0]['visualScenarios'] = [source]
        review = self.review()
        scene = review['pages'][0]['visualScenarios'][1]
        scene.update({key: source[key] for key in ('given', 'steps', 'expected')})
        self.assertTrue(self.result(review)['passed'])
        scene['expected'] = 'Different expected result'
        self.assertFalse(self.result(review)['passed'])
        review['pages'][0]['visualScenarios'].pop()
        self.assertFalse(self.result(review)['passed'])

    def test_incomplete_design_and_empty_scope_fail_closed(self):
        review = self.review()
        del self.readback['results'][0]['variantSettings']
        self.assertFalse(self.result(review)['passed'])
        self.plan['pages'] = []
        self.assertFalse(self.result(review)['passed'])

    def test_scoped_capture_cannot_cover_different_page(self):
        review = self.review()
        self.capture['pagePath'] = '/other'
        self.assertFalse(self.result(review)['passed'])

    def test_source_scope_requires_real_contained_nonempty_files(self):
        for paths in ([], ['absent'], ['../outside']):
            with self.subTest(paths=paths):
                self.plan['implementation']['paths'] = paths
                with self.assertRaises(ValueError):
                    gate.source_snapshot(self.plan)
        (self.root / 'alias').symlink_to(self.root / 'src', target_is_directory=True)
        self.plan['implementation']['paths'] = ['alias']
        with self.assertRaises(ValueError):
            gate.source_snapshot(self.plan)

    def write_json(self, name, data):
        path = self.root / name
        path.write_text(json.dumps(data))
        return path

    def test_cli_checks_capture_hashes_and_never_overwrites_evidence(self):
        plan = self.write_json('plan.json', self.plan)
        pages = self.write_json('pages.json', self.readback)
        overview = self.write_json('overview.json', self.overview)
        self.capture['files'] = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in (pages, overview)}
        capture = self.write_json('capture.json', self.capture)
        review = self.write_json('review.json', self.review())
        script = Path(gate.__file__)
        args = [sys.executable, str(script), 'check', str(plan), '--capture', str(capture),
                '--pages', str(pages), '--overview', str(overview), '--review', str(review)]
        result = subprocess.run(args, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        self.assertTrue(json.loads(result.stdout)['passed'])
        result = subprocess.run(args + ['--output', str(review)], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        pages.write_text(pages.read_text() + '\n')
        result = subprocess.run(args, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('bytes differ', result.stderr)


if __name__ == '__main__':
    unittest.main()
