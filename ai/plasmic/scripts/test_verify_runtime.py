import copy
import hashlib
from pathlib import Path
import tempfile
import unittest
from verify_runtime import check


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


if __name__ == '__main__':
    unittest.main()
