import copy
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from verify_templates import capture, check_page, OVERSEAS_TEMPLATE_ID, FULL_FIELDS


class SourceDesktop:
    def __init__(self, project='source'):
        self.calls = []
        self.state = {'ready': True, 'projectId': project, 'buildId': 'build', 'editorContext': {
            'branchId': None, 'sessionId': 'session', 'revision': 1, 'changeCounter': 0}}
        self.change_after = False

    def call(self, method, values):
        self.calls.append((method, values))
        if method == 'get_screenshot':
            return {'data': 'UklGRhoAAABXRUJQVlA4', 'mimeType': 'image/webp'}
        if method != 'get_app_state':
            raise AssertionError('Unexpected state-changing operation: ' + method)
        result = copy.deepcopy(self.state)
        if self.change_after and len(self.calls) > 1:
            result['editorContext']['revision'] += 1
        return result

    def execute(self, name, values):
        self.calls.append((name, values))
        if name == 'navigate':
            page = values['componentUuid']
            return {'componentUuid': page, 'frameUuid': 'frame-' + page}
        if name != 'read':
            raise AssertionError('Unexpected mutation: ' + name)
        project = values.get('fromProject', self.state['projectId'])
        if 'nameContains' in values:
            component = values['nameContains']
            return {'results': [{'id': project, 'components': [{
                'uuid': component + '-uuid', 'name': component, 'type': 'page', 'baseVariantTplTree': '<div>Native layout</div>',
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
        reviewed = [{'componentName': 'Mobile Feed', 'missing': 'Requires custom interactive canvas rather than feed cards'}]
        list_result = check_page({'templates': [], 'templatesNotApplicable': reviewed}, overseas=False)
        self.assertTrue(list_result['passed'], list_result)
        self.assertEqual(list_result['reviewedCandidates'], reviewed)
        self.assertFalse(check_page({'templates': [], 'templatesNotApplicable': []}, overseas=False)['passed'])

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

    def test_current_published_pages_supply_model_version_and_pixels(self):
        desktop = SourceDesktop(OVERSEAS_TEMPLATE_ID)
        self.item.update(sourceProjectId=OVERSEAS_TEMPLATE_ID)
        with self.assertRaisesRegex(ValueError, 'read-only publication'):
            capture(desktop, OVERSEAS_TEMPLATE_ID, ['Draft'])
        for version, name in [('1.0', 'Queue'), ('2.0', 'MarketWorkbench')]:
            desktop.state['editorContext'].update(publishedTemplateVersion=version, canEdit=False)
            self.item['componentName'] = name
            self.data = capture(desktop, OVERSEAS_TEMPLATE_ID, [name])
            result = check_page(self.plan(), overseas=True)
            self.assertTrue(result['passed'], result)
            self.assertEqual(result['sources'][0]['sourceVersion'], version)
            del self.data['screenshots'][name + '-uuid']
            self.assertFalse(check_page(self.plan(), overseas=True)['passed'])

    def test_any_published_template_center_canvas_supports_descriptions_and_screenshots(self):
        template_id = 'mobileTemplate123'
        desktop = SourceDesktop(template_id)
        desktop.state['editorContext'].update(publishedTemplateVersion='4.2', canEdit=False)
        pages = [{'uuid': 'p1', 'name': 'HomeFeed', 'type': 'page', 'pageMeta': {'path': '/', 'description': 'Feed cards'}},
                 {'uuid': 'c1', 'name': 'FilterBar', 'type': 'component', 'description': 'Reusable filter bar'}]
        with patch.object(desktop, 'execute', return_value={'results': [{'id': template_id, 'components': pages}], 'nextOffset': None}):
            inventory = capture(desktop, template_id)
        self.assertEqual(inventory['sourceVersion'], '4.2')
        self.assertEqual(inventory['pages'][0]['name'], 'HomeFeed')
        self.assertEqual(inventory['sections'][0]['name'], 'FilterBar')
        self.item.update(sourceProjectId=template_id, componentName='HomeFeed')
        self.data = capture(desktop, template_id, ['HomeFeed'])
        result = check_page(self.plan(), overseas=False)
        self.assertTrue(result['passed'], result)
        self.assertEqual(result['sources'][0]['sourceVersion'], '4.2')
        del self.data['screenshots']['HomeFeed-uuid']
        self.assertFalse(check_page(self.plan(), overseas=False)['passed'])

        # Non-Overseas section (type: 'component') template is also supported.
        execute = desktop.execute
        with patch.object(desktop, 'execute', side_effect=lambda n, v: (
            {'results': [{'id': template_id, 'components': [{
                'uuid': 'FilterBar-uuid', 'name': 'FilterBar', 'type': 'component', 'baseVariantTplTree': '<div>Filter</div>',
                **{key: [] for key in FULL_FIELDS - {'baseVariantTplTree'}}}]}],
             'read': {'itemFields': list(FULL_FIELDS), 'itemDepth': 'all'}}
            if n == 'read' and 'nameContains' in v else execute(n, v)
        )):
            self.item.update(sourceProjectId=template_id, componentName='FilterBar')
            self.data = capture(desktop, template_id, ['FilterBar'])
        section_result = check_page(self.plan(), overseas=False)
        self.assertTrue(section_result['passed'], section_result)

    def test_description_inventory_pages_without_screenshots_or_model_reads(self):
        desktop = SourceDesktop(OVERSEAS_TEMPLATE_ID)
        desktop.state['editorContext'].update(publishedTemplateVersion='1.0', canEdit=False)
        pages = [{'uuid': 'p1', 'name': 'First', 'type': 'page', 'pageMeta': {'path': '/a', 'description': 'Search records'}},
                 {'uuid': 'p2', 'name': 'Second', 'type': 'page', 'pageMeta': {'path': '/b'}}]

        def inventory(name, values):
            self.assertEqual(name, 'read')
            self.assertEqual(values['collection'], 'components')
            self.assertEqual(set(values['fields']), {'uuid', 'name', 'type', 'pageMeta', 'description'})
            offset = values['offset']
            items = [pages[0], {'type': 'code'}] if offset == 0 else [pages[1]]
            return {'results': [{'id': OVERSEAS_TEMPLATE_ID, 'components': items}],
                    'nextOffset': 2 if offset == 0 else None}

        with patch.object(desktop, 'execute', side_effect=inventory) as reads:
            result = capture(desktop, OVERSEAS_TEMPLATE_ID)
        self.assertEqual([call.args[1]['offset'] for call in reads.call_args_list], [0, 2])
        self.assertEqual(result['screenshotCount'], 0)
        self.assertEqual([p['description'] for p in result['pages']], ['Search records', None])
        self.assertEqual(result['sourceVersion'], '1.0')
        self.assertEqual([name for name, _ in desktop.calls], ['get_app_state', 'get_app_state'])

    def test_each_published_page_is_navigated_before_its_frame_is_captured(self):
        desktop = SourceDesktop(OVERSEAS_TEMPLATE_ID)
        desktop.state['editorContext'].update(publishedTemplateVersion='1.0', canEdit=False)
        data = capture(desktop, OVERSEAS_TEMPLATE_ID, ['First', 'Second'])
        steps = [call for call in desktop.calls if call[0] in ('navigate', 'get_screenshot')]
        self.assertEqual(steps, [
            ('navigate', {'componentUuid': 'First-uuid'}), ('get_screenshot', {'frameUuid': 'frame-First-uuid', 'liveCanvas': True}),
            ('navigate', {'componentUuid': 'Second-uuid'}), ('get_screenshot', {'frameUuid': 'frame-Second-uuid', 'liveCanvas': True}),
        ])
        for page, image in data['screenshots'].items():
            self.assertEqual(image['frameUuid'], 'frame-' + page)

    def test_unresolved_artboard_stops_before_screenshot(self):
        for target in ({'componentUuid': 'Page-uuid'}, {'componentUuid': 'Other-uuid', 'frameUuid': 'frame'}):
            desktop = SourceDesktop(OVERSEAS_TEMPLATE_ID)
            desktop.state['editorContext'].update(publishedTemplateVersion='1.0', canEdit=False)
            execute = desktop.execute
            with patch.object(desktop, 'execute', side_effect=lambda n, v: target if n == 'navigate' else execute(n, v)):
                with self.assertRaisesRegex(ValueError, 'artboard for Page'):
                    capture(desktop, OVERSEAS_TEMPLATE_ID, ['Page'])
            self.assertNotIn('get_screenshot', [name for name, _ in desktop.calls])

    def test_overseas_no_fit_records_each_candidate_and_its_gap(self):
        candidates = [{'componentName': 'Grouped form', 'missing': 'No per-rule feedback after editing the query'}]
        for value in ('No suitable template', [], ['Grouped form'], [{'missing': 'No feedback'}],
                      [{'componentName': 'Grouped form', 'missing': ' '}], candidates + [{}]):
            self.assertFalse(check_page({'templates': [], 'templatesNotApplicable': value}, overseas=True)['passed'])
        plan = {'templates': [], 'templatesNotApplicable': candidates}
        result = check_page(plan, overseas=True)
        self.assertTrue(result['passed'], result)
        self.assertEqual(result['reviewedCandidates'], candidates)
        self.assertEqual(result['status'], 'not_applicable')

        desktop = SourceDesktop(OVERSEAS_TEMPLATE_ID)
        desktop.state['editorContext'].update(publishedTemplateVersion='1.0', canEdit=False)
        self.data = capture(desktop, OVERSEAS_TEMPLATE_ID, ['TabbedList'])
        self.item['sourceProjectId'] = OVERSEAS_TEMPLATE_ID
        mixed = {**self.plan(), 'templatesNotApplicable': candidates}
        result = check_page(mixed, overseas=True)
        self.assertTrue(result['passed'], result)
        self.assertEqual(result['reviewedCandidates'], candidates)
        self.assertEqual(len(result['sources']), 1)

    def test_overseas_selection_requires_published_source(self):
        self.assertFalse(check_page(self.plan(), overseas=True)['passed'])

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
