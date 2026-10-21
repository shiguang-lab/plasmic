import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from prepare_plan import example
from verify_selection import check


SCRIPT = Path(__file__).resolve().parent / 'verify_selection.py'


class SelectionDiagnosticTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.path = example(self.root / 'fixture')
        self.plan = json.loads(self.path.read_text())
        self.page = self.plan['pages'][0]

    def cli(self, *args):
        return subprocess.run([sys.executable, '-B', str(SCRIPT), str(self.path), *map(str, args)],
                              capture_output=True, text=True)

    def test_action_errors_keep_owner_key_and_missing_case_location(self):
        action = self.page['actionContracts'][0]
        action['cases'] = [case for case in action['cases'] if case['kind'] != 'permission-denied']
        errors = check(self.plan)['errors']
        error = next(e for e in errors if e['check'] == 'actionContract')
        self.assertEqual(error['pointer'], '/pages/0/actionContracts/0/cases')
        self.assertEqual((error['node'], error['key']), ('RowActions', 'disable'))
        self.assertEqual(error['requiredKinds'], ['permission-denied'])
        self.page['actionContracts'][0]['confirm'] = 'yes'
        error = next(e for e in check(self.plan)['errors'] if 'requiredTypes' in e)
        self.assertEqual(error['requiredTypes'], {'confirm': 'boolean', 'transitions': 'array'})

    def test_duplicate_ids_point_to_native_arrays_without_flattening_locations(self):
        duplicate = self.page['runtimeCases'][0]['id']
        self.page['actionContracts'][0]['cases'][0]['id'] = duplicate
        error = next(e for e in check(self.plan)['errors'] if e.get('case') == duplicate and 'relatedPointers' in e)
        self.assertEqual(error['pointer'], '/pages/0/runtimeCases/0/id')
        self.assertEqual(error['relatedPointers'], ['/pages/0/actionContracts/0/cases/0/id'])

    def test_case_check_allowed_kinds_and_inherited_evidence_location(self):
        self.page['actionContracts'][0]['cases'][0]['checks'][0]['kind'] = 'pagination'
        self.page['actionContracts'][0]['evidence']['sha256'] = 'old'
        errors = check(self.plan)['errors']
        error = next(e for e in errors if 'allowedKinds' in e)
        self.assertEqual(error['pointer'], '/pages/0/actionContracts/0/cases/0/checks/0/kind')
        self.assertEqual((error['node'], error['key']), ('RowActions', 'disable'))
        self.assertEqual(error['allowedKinds'], ['text', 'visible', 'count', 'value'])
        self.assertTrue(any(e.get('pointer') == '/pages/0/actionContracts/0/evidence' for e in errors))

    def test_malformed_kinds_and_case_arrays_return_locations_instead_of_crashing(self):
        case = self.page['actionContracts'][0]['cases'][0]
        case['kind'] = {'wrong': 'shape'}
        case['checks'][0]['kind'] = ['text']
        errors = check(self.plan)['errors']
        self.assertTrue(any(e.get('pointer') == '/pages/0/actionContracts/0/cases/0/kind' for e in errors))
        self.assertTrue(any(e.get('pointer') == '/pages/0/actionContracts/0/cases/0/checks/0/kind' for e in errors))
        self.page['actionContracts'][0]['cases'] = {'wrong': 'array required'}
        errors = check(self.plan)['errors']
        self.assertTrue(any(e.get('pointer') == '/pages/0/actionContracts/0/cases' for e in errors))

    def test_selected_second_page_keeps_original_page_index(self):
        self.plan['pages'].insert(0, copy.deepcopy(self.page))
        self.plan['pages'][0]['path'] = '/other'
        self.page['components'][7]['component'] = 'plasmic-antd6-tag'
        error = next(e for e in check(self.plan, page_path='/records')['errors'] if 'allowedComponents' in e)
        self.assertEqual(error['pointer'], '/pages/1/components/7/component')
        self.assertIn('plasmic-antd6-badge', error['allowedComponents'])

    def test_batched_errors_are_saved_in_full_with_bounded_console_output(self):
        for _ in range(30):
            self.page['feedback'].append({'kind': 'unknown'})
        self.path.write_text(json.dumps(self.plan))
        report_path = self.root / 'report.json'
        process = self.cli('--report', report_path)
        self.assertEqual(process.returncode, 1, process.stderr)
        summary = json.loads(process.stdout)
        report = json.loads(report_path.read_text())
        self.assertEqual(summary['errorCount'], len(report['errors']))
        self.assertEqual(len(summary['examples']), 8)
        self.assertEqual(summary['omittedErrorCount'], 52)
        self.assertGreater(len(report_path.read_bytes()), len(process.stdout.encode()) * 3)
        for sample in summary['examples']:
            self.assertEqual({k: v for k, v in sample.items() if k != 'reportPointer'},
                             report['errors'][int(sample['reportPointer'].split('/')[-1])])
        full = self.cli('--report', report_path, '--full')
        self.assertEqual(json.loads(full.stdout), report)
        self.assertEqual(json.loads(self.cli().stdout), report)

    def test_invalid_json_returns_filename_line_column_instead_of_traceback(self):
        self.path.write_text('{\n "pages": [}\n')
        process = self.cli('--report', self.root / 'report.json')
        self.assertEqual(process.returncode, 1)
        error = json.loads(process.stdout)['examples'][0]
        self.assertEqual(error['file'], str(self.path))
        self.assertEqual((error['line'], error['column']), (2, 12))
        self.assertNotIn('Traceback', process.stderr)

    def test_policy_property_diagnostic_survives_selection_preflight(self):
        self.page['components'][1]['props']['colSpan'] = 4
        error = next(e for e in check(self.plan)['errors'] if e['check'] == 'componentPolicy')
        self.assertEqual(error['pointer'], '/pages/0/components/1/props/colSpan')
        self.assertEqual((error['node'], error['property'], error['expectedColSpan']), ('Filters', 'colSpan', 6))


if __name__ == '__main__':
    unittest.main()
