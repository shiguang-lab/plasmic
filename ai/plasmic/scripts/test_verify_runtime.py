import copy
import hashlib
from pathlib import Path
import tempfile
import unittest
from verify_runtime import check, make_manifest


class RuntimeTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        path = Path(temp.name) / 'requirement.md'
        path.write_text('停用后启用进入重新启用圈选中；需二次确认。', encoding="utf-8")
        evidence = {'path': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'quote': path.read_text(encoding="utf-8")}
        self.checks = [{'kind': 'text', 'text': '重新启用圈选中', 'present': True}]
        self.plan = {'pages': [{'path': '/groups', 'components': [], 'runtimeCases': [
            {'id': 're-enable', 'kind': 'state-transition', 'nodeName': 'Actions', 'evidence': evidence,
             'given': {'status': 'INACTIVE', 'role': 'admin'}, 'checks': self.checks}]}]}
        identity = {'projectId': 'project', 'branchId': None, 'sessionId': 'session', 'revision': 9, 'changeCounter': 0}
        self.capture = {'before': identity, 'after': identity, 'files': {'pages.json': 'b' * 64}}
        self.trace = [{'input': {'action': 'assert', 'checks': self.checks}, 'result': {
            'passed': True, 'checks': [{'check': c, 'passed': True, 'actual': True} for c in self.checks],
            'context': {**identity, 'mode': 'preview', 'previewContext': {'path': '/groups'}}}}]
        self.manifest = {'planSha256': 'a' * 64, 'pagesSha256': 'b' * 64,
                         'cases': [{'path': '/groups', 'id': 're-enable', 'assertLine': 1}]}

    def result(self):
        return check(self.plan, self.manifest, self.trace, self.capture, 'a' * 64, 'b' * 64)

    def test_matches_real_native_check_shapes_for_the_exact_model_and_plan(self):
        self.assertTrue(self.result()['passed'])
        self.assertIn('fixture/precondition authenticity', self.result()['notChecked'])

    def test_failed_native_result_cannot_be_relabelled_by_the_case_manifest(self):
        self.manifest['cases'][0]['passed'] = True
        self.trace[0]['result']['checks'][0]['passed'] = False
        self.assertFalse(self.result()['passed'])

    def test_mismatched_expected_text_fails_even_if_the_native_call_passed(self):
        self.trace[0]['input'] = {'action': 'assert', 'checks': [{'kind': 'text', 'text': '圈选中', 'present': True}]}
        self.assertFalse(self.result()['passed'])

    def test_missing_or_duplicate_case_execution_fails(self):
        valid = copy.deepcopy(self.manifest['cases'][0])
        self.manifest['cases'] = []
        self.assertFalse(self.result()['passed'])
        self.manifest['cases'] = [valid, valid]
        self.assertFalse(self.result()['passed'])

    def test_different_session_revision_page_or_mode_fails(self):
        context = self.trace[0]['result']['context']
        for key, value in [('sessionId', 'old-session'), ('revision', 8), ('mode', 'edit')]:
            before = context[key]; context[key] = value
            self.assertFalse(self.result()['passed'], key)
            context[key] = before
        context['previewContext']['path'] = '/other'
        self.assertFalse(self.result()['passed'])

    def test_changed_inventory_or_saved_model_cannot_reuse_old_runtime_pass(self):
        self.manifest['planSha256'] = 'c' * 64
        self.assertFalse(self.result()['passed'])
        self.manifest['planSha256'] = 'a' * 64
        self.capture['files']['pages.json'] = 'd' * 64
        self.assertFalse(self.result()['passed'])

    def test_one_assertion_cannot_claim_two_distinct_business_scenarios(self):
        second = {**self.plan['pages'][0]['runtimeCases'][0], 'id': 'another-state'}
        self.plan['pages'][0]['runtimeCases'].append(second)
        self.manifest['cases'].append({'path': '/groups', 'id': second['id'], 'assertLine': 1})
        self.assertFalse(self.result()['passed'])

    def test_report_distinguishes_failed_missing_and_invalid_evidence(self):
        original = self.plan['pages'][0]['runtimeCases'][0]
        self.plan['pages'][0]['runtimeCases'].extend([
            {**original, 'id': 'failed'}, {**original, 'id': 'missing'}, {**original, 'id': 'invalid'}])
        failure = copy.deepcopy(self.trace[0])
        failure['result']['passed'] = False
        failure['result']['checks'][0].update(passed=False, actual=False)
        self.trace.append(failure)
        self.manifest['cases'].extend([
            {'path': '/groups', 'id': 'failed', 'assertLine': 2},
            {'path': '/groups', 'id': 'missing', 'assertLine': None},
            {'path': '/groups', 'id': 'invalid', 'assertLine': 99}])
        result = self.result()
        self.assertFalse(result['passed'])
        self.assertEqual(result['counts'], {'passed': 1, 'failed': 1, 'unexecuted': 1, 'invalid_evidence': 1})
        self.assertEqual(result['executedCaseCount'], 2)
        failure = next(e for e in result['errors'] if e['message'] == 'Actual native Preview assertion failed')
        self.assertFalse(failure['checks'][0]['actual'])

    def test_manifest_preparation_includes_all_cases_without_claiming_execution(self):
        manifest = make_manifest(self.plan, self.capture, 'a' * 64, 'b' * 64)
        self.assertEqual(manifest['cases'], [{'path': '/groups', 'id': 're-enable', 'assertLine': None}])
        self.manifest = manifest
        self.assertEqual(self.result()['counts']['unexecuted'], 1)
        self.assertEqual(self.result()['executedCaseCount'], 0)
        with self.assertRaises(ValueError):
            make_manifest(self.plan, self.capture, 'a' * 64, 'c' * 64)
        self.capture['before'] = {**self.capture['before'], 'revision': 8}
        with self.assertRaises(ValueError):
            make_manifest(self.plan, self.capture, 'a' * 64, 'b' * 64)

    def test_cross_page_assertion_keeps_its_origin_and_checks_planned_destination(self):
        self.plan['pages'][0]['runtimeCases'][0]['assertPath'] = '/groups/record-001'
        self.assertFalse(self.result()['passed'])
        self.trace[0]['result']['context']['previewContext']['path'] = '/groups/record-001'
        result = self.result()
        self.assertTrue(result['passed'], result)
        self.assertEqual(result['cases'][0]['path'], '/groups')
        self.assertEqual(result['cases'][0]['assertPath'], '/groups/record-001')
        # The execution manifest cannot redirect a source-planned expectation.
        self.manifest['cases'][0]['assertPath'] = '/other'
        self.trace[0]['result']['context']['previewContext']['path'] = '/other'
        self.assertFalse(self.result()['passed'])

    def test_invalid_destination_is_rejected_before_execution(self):
        case = self.plan['pages'][0]['runtimeCases'][0]
        for path in ('https://example.com', '//example.com', '', '/bad path', None, 1):
            case['assertPath'] = path
            with self.subTest(path=path), self.assertRaises(ValueError):
                make_manifest(self.plan, self.capture, 'a' * 64, 'b' * 64)

    def test_manifest_cannot_bypass_source_validation_by_omitting_page_path(self):
        del self.plan['pages'][0]['path']
        with self.assertRaisesRegex(ValueError, 'local route'):
            make_manifest(self.plan, self.capture, 'a' * 64, 'b' * 64)

    def test_manifest_rejects_duplicate_pages_and_changed_source(self):
        self.plan['pages'].append(copy.deepcopy(self.plan['pages'][0]))
        with self.assertRaisesRegex(ValueError, 'Duplicate runtime Page'):
            make_manifest(self.plan, self.capture, 'a' * 64, 'b' * 64)
        self.plan['pages'].pop()
        evidence = self.plan['pages'][0]['runtimeCases'][0]['evidence']
        Path(evidence['path']).write_text('New requirement', encoding='utf-8')
        with self.assertRaisesRegex(ValueError, 'Source changed'):
            make_manifest(self.plan, self.capture, 'a' * 64, 'b' * 64)

    def test_stale_hashes_or_context_never_count_as_executed(self):
        self.manifest['planSha256'] = 'c' * 64
        self.assertEqual(self.result()['executedCaseCount'], 0)
        self.assertEqual(self.result()['counts']['invalid_evidence'], 1)
        self.manifest['planSha256'] = 'a' * 64
        self.trace[0]['result']['context']['sessionId'] = 'stale'
        self.assertEqual(self.result()['executedCaseCount'], 0)

    def test_reused_lines_invalidate_both_cases_and_duplicates_cannot_pass(self):
        original = self.plan['pages'][0]['runtimeCases'][0]
        self.plan['pages'][0]['runtimeCases'].append({**original, 'id': 'other'})
        self.manifest['cases'].append({'path': '/groups', 'id': 'other', 'assertLine': 1})
        self.assertEqual(self.result()['counts']['invalid_evidence'], 2)
        self.assertEqual(self.result()['executedCaseCount'], 0)
        self.manifest['cases'] = [self.manifest['cases'][0]] * 2
        self.assertEqual(self.result()['counts']['invalid_evidence'], 1)
        self.assertEqual(self.result()['counts']['unexecuted'], 1)


if __name__ == '__main__':
    unittest.main()
