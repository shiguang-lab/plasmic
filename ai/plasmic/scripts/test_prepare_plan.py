import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from prepare_plan import assign_ids, cases, clone_actions, evidence, example, fragment
from verify_selection import check


SCRIPTS = Path(__file__).resolve().parent


class PlanPreparationTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.path = example(self.root / 'example')
        self.plan = json.loads(self.path.read_text(encoding="utf-8"))

    def cli(self, script, *args):
        return subprocess.run([sys.executable, '-B', str(SCRIPTS / script), *map(str, args)],
                              capture_output=True, text=True)

    def test_complete_example_uses_the_public_full_page_preflight(self):
        report_path = self.root / 'report.json'
        process = self.cli('verify_selection.py', self.path, '--report', report_path)
        self.assertEqual(process.returncode, 0, process.stderr + process.stdout)
        self.assertTrue(json.loads(process.stdout)['passed'])
        report = json.loads(report_path.read_text(encoding="utf-8"))
        self.assertEqual(report['errors'], [])
        self.assertEqual(report['templates'][0]['status'], 'not_applicable')
        self.assertIn('visual and runtime acceptance', report['notChecked'])
        page = self.plan['pages'][0]
        self.assertIn('Local input-format fixture only', page['templatesNotApplicable'])
        self.assertEqual({c['key'] for c in page['actionContracts']}, {'view', 'disable'})
        # Real source provenance is checked; deleting or changing it cannot pass.
        source = self.path.parent / 'source.md'
        source.write_text('changed source', encoding="utf-8")
        self.assertFalse(check(self.plan)['passed'])

    def test_permission_example_preserves_allowed_roles_and_independent_scope_boundary(self):
        page = self.plan['pages'][0]
        contracts = {c['key']: c for c in page['actionContracts']}
        view = contracts['view']['cases']
        self.assertEqual({c['given']['viewer']['role'] for c in view if c['kind'] == 'permission-allowed'},
                         {'administrator', 'operator', 'reader'})
        denied_view = [c for c in view if c['kind'] == 'permission-denied']
        self.assertEqual(len(denied_view), 1)
        self.assertEqual(denied_view[0]['given']['viewer']['role'], 'administrator')
        self.assertNotIn(denied_view[0]['given']['records'][0]['market'],
                         denied_view[0]['given']['viewer']['authorizedMarkets'])
        denied_disable = [c for c in contracts['disable']['cases'] if c['kind'] == 'permission-denied'
                          and c['given']['records'][0]['market'] == 'MX']
        self.assertEqual({c['given']['viewer']['role'] for c in denied_disable}, {'operator', 'reader'})
        for case in denied_disable:
            self.assertIn({'kind': 'count', 'role': 'cell', 'name': '启用', 'count': 1}, case['checks'])
        for binding in page['bindings']:
            if binding['nodeName'] in ('Results', 'RowActions'):
                self.assertIn('viewer', next(iter(binding['propStateDependencies'].values())))

    def test_example_cli_refuses_overwriting_old_evidence(self):
        before = self.path.read_bytes()
        process = self.cli('prepare_plan.py', 'example', self.path.parent)
        self.assertNotEqual(process.returncode, 0)
        self.assertEqual(self.path.read_bytes(), before)

    def test_evidence_keeps_exact_quotes_and_checks_the_real_file(self):
        source = self.path.parent / 'source.md'
        quote = '默认每页20条，可切换50条。'
        value = evidence(source, quote)
        self.assertEqual(value['quote'], quote)
        self.assertEqual(value['sha256'], hashlib.sha256(source.read_bytes()).hexdigest())
        self.assertTrue(Path(value['path']).is_absolute())
        with self.assertRaisesRegex(ValueError, 'verbatim'):
            evidence(source, 'Default size is 100')
        with self.assertRaises(ValueError):
            evidence(source, '')

    def test_ids_preserve_unique_values_and_business_data_across_all_native_arrays(self):
        page = self.plan['pages'][0]
        page['appContext']['cases'] = [copy.deepcopy(page['runtimeCases'][0])]
        page['runtimeCases'][1]['id'] = page['runtimeCases'][0]['id']
        del page['actionContracts'][0]['cases'][0]['id']
        original = copy.deepcopy(self.plan)
        prepared, changed = assign_ids(self.plan)
        self.assertEqual(self.plan, original)
        self.assertEqual(changed, 3)
        values = cases(prepared['pages'][0])
        self.assertEqual(len(values), len({case['id'] for case in values}))
        originals = cases(page)
        for before, after in zip(originals, values):
            self.assertEqual({k: v for k, v in before.items() if k != 'id'}, {k: v for k, v in after.items() if k != 'id'})
            if sum(c.get('id') == before.get('id') for c in originals) == 1 and before.get('id'):
                self.assertEqual(before['id'], after['id'])
        again, count = assign_ids(prepared)
        self.assertEqual((again, count), (prepared, 0))
        self.assertEqual(assign_ids(original), (prepared, changed))

    def add_target(self):
        self.plan['pages'][0]['components'].append({'nodeName': 'MyActions', 'role': 'row-actions'})

    def test_clone_changes_only_native_owner_and_new_case_ids(self):
        self.add_target()
        source = self.plan['pages'][0]['actionContracts'][0]
        source['cases'][0]['given']['text'] = 'RowActions must stay literal here'
        source['cases'][0]['checks'][0]['selector'] = '[data-owner="RowActions"]'
        original = copy.deepcopy(self.plan)
        prepared, count = clone_actions(self.plan, '/records', 'RowActions', 'MyActions')
        self.assertEqual(count, 2)
        self.assertEqual(original, self.plan)
        self.assertEqual(prepared['pages'][0]['actionContracts'][0], source)
        target = prepared['pages'][0]['actionContracts'][2]
        self.assertEqual(target['evidence'], source['evidence'])
        self.assertEqual(target['nodeName'], 'MyActions')
        for before, after in zip(source['cases'], target['cases']):
            self.assertNotEqual(before['id'], after['id'])
            self.assertEqual(after['nodeName'], 'MyActions')
            self.assertEqual({k: v for k, v in before.items() if k not in ('id', 'nodeName')},
                             {k: v for k, v in after.items() if k not in ('id', 'nodeName')})
        ids = [case['id'] for case in cases(prepared['pages'][0])]
        self.assertEqual(len(ids), len(set(ids)))

    def test_clone_rejects_conflicts_and_unknown_or_nonaction_owners(self):
        for source, target in [('RowActions', 'Results'), ('RowActions', 'Missing'), ('RowActions', 'RowActions')]:
            with self.assertRaisesRegex(ValueError, 'owners'):
                clone_actions(self.plan, '/records', source, target)
        self.add_target()
        prepared, _ = clone_actions(self.plan, '/records', 'RowActions', 'MyActions')
        with self.assertRaisesRegex(ValueError, 'conflicting'):
            clone_actions(prepared, '/records', 'RowActions', 'MyActions')
        with self.assertRaisesRegex(ValueError, 'Page'):
            clone_actions(self.plan, '/missing', 'RowActions', 'MyActions')
        self.plan['pages'][0]['actionContracts'][0]['cases'][0]['nodeName'] = 'Results'
        with self.assertRaisesRegex(ValueError, 'native action owner'):
            clone_actions(self.plan, '/records', 'RowActions', 'MyActions')

    def test_ids_cli_writes_new_output_and_never_overwrites_input(self):
        before = self.path.read_bytes()
        output = self.root / 'prepared.json'
        process = self.cli('prepare_plan.py', 'ids', self.path, '--output', output)
        self.assertEqual(process.returncode, 0, process.stderr)
        self.assertEqual(json.loads(output.read_text(encoding="utf-8")), self.plan)
        process = self.cli('prepare_plan.py', 'ids', self.path, '--output', self.path)
        self.assertNotEqual(process.returncode, 0)
        self.assertEqual(self.path.read_bytes(), before)

    def test_fragment_reads_only_requested_fields_including_escaped_keys(self):
        self.assertEqual(fragment({'a/b': {'~key': [42]}}, '/a~1b/~0key/0'), 42)
        self.assertEqual(fragment(self.plan, '/pages/0/path'), '/records')
        for pointer in ('pages/0', '/pages/-1', '/pages/00', '/bad~2escape'):
            with self.assertRaises(ValueError):
                fragment(self.plan, pointer)
        process = self.cli('prepare_plan.py', 'show', self.path, '--pointer', '/pages/0/path')
        self.assertEqual(process.returncode, 0, process.stderr)
        self.assertEqual(json.loads(process.stdout), '/records')


if __name__ == '__main__':
    unittest.main()
