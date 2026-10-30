import copy
import json
import subprocess
import sys
from pathlib import Path
import tempfile
import unittest

from prepare_plan import example, scaffold
from verify_selection import check, page_body_errors, page_structure_errors, project_reads, required_reads


class PageStructureTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        path = example(self.root / 'example')
        self.plan = json.loads(path.read_text(encoding='utf-8'))
        self.page = self.plan['pages'][0]

    def test_complete_preflight_requires_structure_and_checks_decisions(self):
        self.assertTrue(check(self.plan)['passed'])
        for value in (None, {}, [], '__DECIDE__'):
            with self.subTest(value=value):
                self.page['pageStructure'] = value
                report = check(self.plan)
                self.assertFalse(report['passed'])
                self.assertTrue(any(e.get('pointer', '').startswith('/pages/0/pageStructure')
                                    for e in report['errors']))
        del self.page['pageStructure']
        self.assertTrue(any(e.get('pointer') == '/pages/0/pageStructure' for e in check(self.plan)['errors']))

    def test_regions_reference_real_declarations_including_native_nodes(self):
        structure = self.page['pageStructure']
        structure['regions'].append({'nodeName': 'RowActionAnchor', 'purpose': 'Confirmation anchor'})
        self.assertEqual(page_structure_errors(self.page), [])
        for region in ({'nodeName': 'Missing', 'purpose': 'Preview'},
                       {'nodeName': 'Filters', 'purpose': 'Duplicate'},
                       {'nodeName': ['Filters'], 'purpose': 'Invalid reference'},
                       {'nodeName': 'Results', 'purpose': ''}, 'Preview'):
            with self.subTest(region=region):
                modified = copy.deepcopy(self.page)
                modified['pageStructure']['regions'].append(region)
                self.assertTrue(page_structure_errors(modified))
        for regions in ([], {}, None):
            structure['regions'] = regions
            self.assertTrue(page_structure_errors(self.page))

    def test_no_layout_enum_or_automatic_design_quality_claim(self):
        structure = self.page['pageStructure']
        # Spatial reasoning is prose; the verifier cannot determine whether a
        # proposed arrangement is usable or preserves source intent.
        for layout in ('Editor left, preview right', 'Preview below after submission',
                       'Canvas in the center; tools beside it'):
            structure['layout'] = layout
            self.assertEqual(page_structure_errors(self.page), [])
        for field in ('intent', 'source', 'layout', 'rationale', 'sizing', 'scrolling', 'actions'):
            modified = copy.deepcopy(self.page)
            modified['pageStructure'][field] = ' '
            self.assertTrue(any(e['pointer'] == '/pageStructure/' + field
                                for e in page_structure_errors(modified)))

    def test_horizontal_business_root_preserves_spacing_contract(self):
        body = next(c for c in self.page['components'] if c['nodeName'] == 'PageBody')
        body['props']['vertical'] = False
        self.assertEqual(page_body_errors(self.page), [])
        body['props']['gap'] = 0
        self.assertTrue(page_body_errors(self.page))

    def test_scaffold_keeps_sibling_drafts_and_existing_structure(self):
        sibling = {'path': '/editor', 'name': '消息配置', 'pageType': 'basic-form',
                   'pageStructure': {'intent': 'Edit with live preview'}}
        self.plan['pages'].append(sibling)
        before = copy.deepcopy(self.plan)
        result, _ = scaffold(self.plan, '/records')
        self.assertEqual(self.plan, before)
        self.assertEqual(result['pages'][1], sibling)
        self.assertEqual(result['pages'][0]['pageStructure'], self.page['pageStructure'])
        self.assertTrue(check(result, page_path='/records')['passed'])
        self.assertFalse(check(result)['passed'])
        with self.assertRaisesRegex(ValueError, 'Exactly one'):
            scaffold(self.plan, '/missing')
        del self.page['pageStructure']
        result, _ = scaffold(self.plan, '/records')
        self.assertEqual(result['pages'][0]['pageStructure'], '__DECIDE__')

    def test_structure_rules_reach_early_planning_and_each_page_review(self):
        rule = 'references/design/page-structure.md'
        self.assertIn(rule, project_reads(root={'pages': [{'path': '/draft'}]}))
        self.assertIn(rule, required_reads(self.page, stage='accept'))

    def test_scoped_cli_prepares_no_sibling_inventories(self):
        sibling = {'path': '/editor', 'pageStructure': {'intent': 'Edit with live preview'}}
        self.plan['pages'].append(sibling)
        source = self.root / 'plan.json'
        source.write_text(json.dumps(self.plan), encoding='utf-8')
        reads = self.root / 'reads.jsonl'
        reads.write_text('', encoding='utf-8')  # Derivation alone never establishes read coverage.
        output = self.root / 'inventories'
        script = Path(__file__).with_name('prepare_plan.py')
        scaffolded = self.root / 'scaffolded.json'
        run = subprocess.run([sys.executable, str(script), 'scaffold', str(source), '--page', '/records',
                              '--output', str(scaffolded)], capture_output=True, text=True)
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertEqual(json.loads(scaffolded.read_text())['pages'][1], sibling)
        run = subprocess.run([sys.executable, str(script), 'inventories', str(scaffolded), '--page', '/records',
                              '--reads', str(reads), '--output-dir', str(output)], capture_output=True, text=True)
        self.assertEqual(run.returncode, 0, run.stderr)
        for filename in ('forms-inventory.json', 'description-inventory.json', 'overlay-inventory.json'):
            self.assertEqual([p['path'] for p in json.loads((output / filename).read_text())['pages']], ['/records'])
        suite = json.loads((output / 'suite.json').read_text())
        self.assertEqual([p['path'] for p in suite['slots']['pages']], ['/records'])
        self.assertEqual((output / suite['structure']['inventory']).resolve(), scaffolded.resolve())
        self.assertEqual(json.loads(source.read_text()), self.plan)


if __name__ == '__main__':
    unittest.main()
