import copy
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from verify_templates import capture, check_page, source_names, CATALOG, FULL_FIELDS


class SourceDesktop:
    def __init__(self, project='source'):
        self.calls = []
        self.state = {'ready': True, 'projectId': project, 'buildId': 'build', 'editorContext': {
            'branchId': None, 'sessionId': 'session', 'revision': 1, 'changeCounter': 0}}
        self.change_after = False

    def call(self, method, values):
        self.calls.append((method, values))
        if method != 'get_app_state':
            raise AssertionError('Unexpected state-changing operation: ' + method)
        result = copy.deepcopy(self.state)
        if self.change_after and len(self.calls) > 1:
            result['editorContext']['revision'] += 1
        return result

    def execute(self, name, values):
        self.calls.append((name, values))
        if name != 'read':
            raise AssertionError('Unexpected mutation: ' + name)
        project = values.get('fromProject', self.state['projectId'])
        if 'nameContains' in values:
            component = values['nameContains']
            return {'results': [{'id': project, 'components': [{
                'uuid': component + '-uuid', 'name': component, 'baseVariantTplTree': '<div>Native layout</div>',
                **{key: [] for key in FULL_FIELDS - {'baseVariantTplTree'}}}]}],
                'read': {'itemFields': list(FULL_FIELDS), 'itemDepth': 'all'}}
        if 'componentUuids' in values:
            return {'results': [{'uuid': uuid, 'name': uuid.removesuffix('-uuid'), 'props': []}
                                for uuid in values['componentUuids']], 'read': {'fields': ['uuid', 'name', 'props']}}
        imports = [{'id': 'source', 'version': '1.0.0'}] if project != 'source' else []
        return {'results': [{'__type': 'Project', 'id': project, 'importedProjects': imports}]}


class TemplateTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.file = Path(self.directory.name) / 'template.json'
        self.data = capture(SourceDesktop(), 'source', ['TabbedList'])
        self.item = {'sourceProjectId': 'source', 'componentName': 'TabbedList',
                     'mode': 'reference', 'adaptation': 'Preserve list hierarchy; replace fields from requirements'}

    def plan(self):
        raw = json.dumps(self.data).encode()
        self.file.write_bytes(raw)
        return {'templates': [{**self.item, 'evidence': {'path': str(self.file), 'sha256': hashlib.sha256(raw).hexdigest()}}]}

    def test_missing_selection_or_empty_reason_does_not_pass(self):
        for plan in ({}, {'templates': []}, {'templates': [], 'templatesNotApplicable': ' '}):
            self.assertFalse(check_page(plan)['passed'])
        result = check_page({'templates': [], 'templatesNotApplicable': 'Source is a freeform visualization outside the catalog scenarios'})
        self.assertTrue(result['passed'])
        self.assertEqual(result['status'], 'not_applicable')
        self.assertIn('correctness of the no-template-fit decision', result['notChecked'])

    def test_live_source_reference_passes_without_installing_a_template(self):
        result = check_page(self.plan())
        self.assertTrue(result['passed'], result)
        self.assertEqual(result['sources'][0]['models'], [{'name': 'TabbedList', 'uuid': 'TabbedList-uuid'}])
        self.assertEqual(result['sources'][0]['plannedMode'], 'reference')
        self.assertEqual(result['sources'][0]['actualReuse'], 'unverified')
        self.assertIsNone(result['sources'][0]['sourceVersion'])

    def test_capture_uses_only_public_reads_and_records_an_imported_version(self):
        desktop = SourceDesktop('consumer')
        result = capture(desktop, 'source', ['TabbedList'])
        self.assertEqual(result['sourceVersion'], '1.0.0')
        self.assertEqual({call[0] for call in desktop.calls}, {'get_app_state', 'read'})
        self.assertEqual(result['before'], result['after'])

    def test_catalog_or_contract_alone_is_not_a_live_model_read(self):
        for key in ('fullReads', 'contracts', 'source'):
            with self.subTest(key=key):
                original = self.data
                self.data = {**original, key: {}}
                self.assertFalse(check_page(self.plan())['passed'])
                self.data = original

    def test_wrong_project_identity_or_contract_cannot_pass(self):
        for mutate in (
            lambda data: data.update(sourceProjectId='different'),
            lambda data: data['source']['results'][0].update(id='different'),
            lambda data: data['fullReads']['TabbedList']['results'][0].update(id='different'),
            lambda data: data['contracts'][0]['results'][0].update(uuid='different'),
            lambda data: data['contracts'][0]['results'][0].update(name='different'),
            lambda data: data['after'].update(sessionId='new-session'),
        ):
            original = self.data
            self.data = copy.deepcopy(original)
            mutate(self.data)
            self.assertFalse(check_page(self.plan())['passed'])
            self.data = original

    def test_partial_or_summary_model_is_rejected(self):
        for mutate in (
            lambda data: data['fullReads']['TabbedList']['read'].update(itemDepth=0),
            lambda data: data['fullReads']['TabbedList']['read'].update(itemFields=['uuid', 'name']),
            lambda data: data['fullReads']['TabbedList']['results'][0]['components'][0].update(baseVariantTplTree='<plasmic-node-ref/>'),
        ):
            original = self.data
            self.data = copy.deepcopy(original)
            mutate(self.data)
            self.assertFalse(check_page(self.plan())['passed'])
            self.data = original

    def test_changed_capture_and_duplicate_or_invalid_selections_fail(self):
        plan = self.plan()
        self.file.write_text('{}', encoding="utf-8")
        self.assertFalse(check_page(plan)['passed'])
        plan = self.plan()
        plan['templates'].append(copy.deepcopy(plan['templates'][0]))
        self.assertFalse(check_page(plan)['passed'])
        plan = self.plan()
        plan['templates'][0]['mode'] = 'directory-only'
        self.assertFalse(check_page(plan)['passed'])

    def test_import_claim_is_kept_separate_from_source_read_proof(self):
        self.item['mode'] = 'import'
        result = check_page(self.plan())
        self.assertTrue(result['passed'])
        self.assertEqual(result['sources'][0]['actualReuse'], 'unverified')
        self.assertIn('actual template insertion/detachment', result['notChecked'])

    def test_catalog_nested_templates_are_captured_and_required(self):
        catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
        project = catalog['projectId']
        self.assertEqual(source_names(project, ['StandardListPage']), ['StandardListPage', 'SearchTableSection'])
        self.data = capture(SourceDesktop(project), project, ['StandardListPage'])
        self.item.update(sourceProjectId=project, componentName='StandardListPage')
        self.assertTrue(check_page(self.plan())['passed'])
        del self.data['fullReads']['SearchTableSection']
        self.assertFalse(check_page(self.plan())['passed'])

    def test_identity_change_or_missing_source_fails_without_navigation(self):
        desktop = SourceDesktop()
        desktop.change_after = True
        with self.assertRaisesRegex(ValueError, 'identity changed'):
            capture(desktop, 'source', ['TabbedList'])
        self.assertEqual({call[0] for call in desktop.calls}, {'get_app_state', 'read'})
        desktop = SourceDesktop()

        def missing_source(name, values):
            desktop.calls.append((name, values))
            raise ValueError('Imported project not found')

        desktop.execute = missing_source
        with self.assertRaisesRegex(ValueError, 'Imported project not found'):
            capture(desktop, 'unavailable', ['TabbedList'])
        self.assertEqual({call[0] for call in desktop.calls}, {'get_app_state', 'read'})


if __name__ == '__main__':
    unittest.main()
