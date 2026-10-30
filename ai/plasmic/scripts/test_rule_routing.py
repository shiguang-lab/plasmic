import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

import rules_manifest
from read_reference import select
from verify_selection import check, coverage_errors, plan_errors, project_reads, required_reads


V6 = 'references/libraries/antd_v6/'


def component(name, key, **extra):
    return {'nodeName': name, 'component': key, 'rule': rules_manifest.document_for(key), **extra}


class RuleRoutingTests(unittest.TestCase):
    def test_library_discovery_and_selection_are_required_before_composition(self):
        self.assertIn('references/libraries/index.md', project_reads())
        page = {'components': [component('Form', 'plasmic-antd6-form')]}
        reads = project_reads(root={'pages': [page]})
        self.assertIn(V6 + 'index.md', reads)
        self.assertIn(V6 + 'selection.md', reads)

    def test_v5_page_does_not_receive_v6_recipes_or_scale(self):
        page = {'pageType': 'basic-form', 'components': [component('Form', 'plasmic-antd5-form')]}
        for stage in ('compose', 'accept'):
            with self.subTest(stage=stage):
                reads = required_reads(page, stage)
                project = project_reads(stage, {'pages': [page]})
                self.assertIn('references/libraries/antd_v5/index.md', project)
                self.assertFalse(any(path.startswith(V6) for path in project))
                self.assertIn('references/libraries/antd_v5/components/form.md', reads)
                self.assertFalse(any(path.startswith(V6) for path in reads))
                self.assertNotIn('references/design/scale.md', reads)
                self.assertNotIn('references/design/page-types.md', reads)

    def test_foreign_components_keep_source_roles_without_v6_identity_requirements(self):
        for key, rule in (('plasmic-antd5-form', 'references/libraries/antd_v5/components/form.md'),
                          ('custom-form', 'references/libraries/index.md')):
            with self.subTest(component=key):
                page = {'path': '/edit', 'components': [component('RecordForm', key, rule=rule,
                    role='submitted-form', source='Requirement', purpose='Submit record fields')], 'feedback': []}
                self.assertEqual(plan_errors(page), [])
                report = check({'pages': [page]})
                self.assertTrue(any('coverage outside the supported admin suite' in item
                                    for item in report['notChecked']))
        wrong = component('RecordForm', 'plasmic-antd6-descriptions', role='submitted-form',
                          source='Requirement', purpose='Submit record fields', props={'column': 3})
        errors = plan_errors({'components': [wrong], 'feedback': []})
        self.assertTrue(any(e.get('pointer') == '/components/0/component' for e in errors))

    def test_category_column_delivers_text_or_tag_rules_without_a_tag_instance(self):
        from prepare_plan import scaffold
        raw = {'pages': [{'path': '/records', 'components': [{
            'nodeName': 'TypeColumn', 'component': 'plasmic-antd6-table-column', 'role': 'category',
            'presentation': 'text', 'props': {'dataIndex': 'type', 'width': 128}}]}]}
        page = scaffold(raw)[0]['pages'][0]
        for stage in ('compose', 'accept'):
            with self.subTest(stage=stage):
                self.assertIn(V6 + 'components/tag.md', required_reads(page, stage))
        page['components'][0]['role'] = 'widget'
        self.assertNotIn(V6 + 'components/tag.md', required_reads(page))

    def test_only_explicit_supported_page_headers_receive_the_header_recipe(self):
        page = {'pageType': 'basic-detail', 'components': [component('Back', 'plasmic-antd6-button')],
                'pageHeader': {'nodeName': 'EntityHeader', 'source': 'User requests the entity heading'}}
        recipe = V6 + 'compositions/detail-header.md'
        for stage in ('compose', 'accept'):
            with self.subTest(stage=stage):
                self.assertIn(recipe, required_reads(page, stage))
        page['pageHeader'] = None
        self.assertNotIn(recipe, required_reads(page))
        page['pageHeader'] = {'nodeName': 'EntityHeader', 'source': 'User requests the entity heading'}
        for page_type in ('list', 'overview'):
            page['pageType'] = page_type
            self.assertNotIn(recipe, required_reads(page))
        page['pageType'] = 'tabbed-detail'
        self.assertIn(recipe, required_reads(page))
        page['components'] = [component('Back', 'plasmic-antd5-button')]
        self.assertNotIn(recipe, required_reads(page))

    def test_mixed_page_does_not_assign_a_v6_form_recipe_to_a_v5_form(self):
        page = {'pageType': 'basic-form', 'components': [component('Form', 'plasmic-antd5-form'),
                                                       component('Save', 'plasmic-antd6-button')]}
        reads = required_reads(page)
        self.assertNotIn(V6 + 'compositions/form-layout.md', reads)
        self.assertIn('references/libraries/antd_v5/index.md', project_reads(root={'pages': [page]}))
        self.assertIn(V6 + 'components/button.md', reads)

    def test_foreign_explicit_rule_cannot_reintroduce_the_wrong_api_family(self):
        wrong = component('Form', 'plasmic-antd5-form', role='submitted-form', source='Requirement',
                          purpose='Edit record')
        for rule in (V6 + 'components/form.md', 'references/design/scale.md'):
            with self.subTest(rule=rule):
                wrong['rule'] = rule
                page = {'components': [wrong], 'feedback': []}
                self.assertNotIn(wrong['rule'], required_reads(page))
                self.assertTrue(any(e.get('pointer') == '/components/0/rule' for e in plan_errors(page)))

    def test_unknown_library_does_not_acquire_page_wide_v6_baselines(self):
        page = {'pageType': 'basic-form', 'components': [component('Save', 'plasmic-antd6-button'),
                 {'nodeName': 'Form', 'component': 'custom-form', 'rule': 'references/libraries/index.md'}]}
        self.assertNotIn('references/design/page-types.md', required_reads(page))
        report = check({'pages': [{'path': '/mixed', **page}]})
        self.assertTrue(any('custom-form' in message for message in report['notChecked']))

    def test_selection_and_content_states_reach_both_design_and_review(self):
        page = {'pageType': 'list', 'components': [component('Records', 'plasmic-antd6-table',
                                                         props={'selectionMode': 'multiple'})]}
        for stage in ('compose', 'accept'):
            with self.subTest(stage=stage):
                reads = required_reads(page, stage)
                self.assertIn(V6 + 'compositions/bulk-actions.md', reads)
                self.assertIn(V6 + 'compositions/content-states.md', reads)
        page['components'][0]['props'] = {'selectionMode': 'none'}
        self.assertNotIn(V6 + 'compositions/bulk-actions.md', required_reads(page))
        page['components'][0]['dynamicProps'] = ['selectionMode']
        self.assertIn(V6 + 'compositions/bulk-actions.md', required_reads(page))

    def test_state_components_do_not_depend_on_feedback_events(self):
        for key in ('alert', 'empty', 'spin', 'skeleton', 'result'):
            page = {'components': [component('State', 'plasmic-antd6-' + key)], 'feedback': []}
            with self.subTest(component=key):
                self.assertIn(V6 + 'compositions/content-states.md', required_reads(page))

    def test_steps_in_a_list_overlay_receive_form_workflow_rules(self):
        page = {'pageType': 'list', 'components': [component('Drawer', 'plasmic-antd6-drawer'),
            component('Steps', 'plasmic-antd6-steps', owner={'nodeName': 'Drawer', 'slot': 'children'}),
            component('Form', 'plasmic-antd6-form', owner={'nodeName': 'Drawer', 'slot': 'children'})]}
        for stage in ('compose', 'accept'):
            with self.subTest(stage=stage):
                self.assertIn(V6 + 'compositions/step-form.md', required_reads(page, stage))
        page['components'][1] = component('Steps', 'plasmic-antd5-steps')
        self.assertNotIn(V6 + 'compositions/step-form.md', required_reads(page))

    def test_v5_feedback_owner_does_not_acquire_v6_global_actions(self):
        page = {'components': [component('LegacySave', 'plasmic-antd5-button'),
                               component('NewSave', 'plasmic-antd6-button')],
                'feedback': [{'nodeName': 'LegacySave', 'kind': 'asynchronous'}]}
        self.assertNotIn(V6 + 'compositions/action-bars.md', required_reads(page))
        self.assertNotIn(V6 + 'compositions/content-states.md', required_reads(page))
        self.assertNotIn(V6 + 'components/config-provider.md', required_reads(page))

    def test_nested_summary_regions_receive_composition_rules_on_a_list_page(self):
        for key in ('descriptions', 'statistic', 'statistic-timer'):
            page = {'pageType': 'list', 'components': [component('Details', 'plasmic-antd6-drawer'),
                component('Summary', 'plasmic-antd6-' + key, owner={'nodeName': 'Details', 'slot': 'children'})]}
            for stage in ('compose', 'accept'):
                with self.subTest(component=key, stage=stage):
                    self.assertIn(V6 + 'compositions/summary-metrics.md', required_reads(page, stage))

    def test_nested_query_table_receives_list_composition_on_a_detail_page(self):
        page = {'pageType': 'basic-detail', 'components': [component('Details', 'plasmic-antd6-tabs'),
            component('Filters', 'plasmic-overseas-search-form', owner={'nodeName': 'Details', 'slot': 'children'}),
            component('Records', 'plasmic-antd6-table', owner={'nodeName': 'Details', 'slot': 'children'})]}
        recipe = 'references/libraries/overseas/compositions/search-table.md'
        for stage in ('compose', 'accept'):
            with self.subTest(stage=stage):
                self.assertIn(recipe, required_reads(page, stage))
        page['components'][-1] = component('Records', 'plasmic-antd5-table')
        self.assertNotIn(recipe, required_reads(page))

    def test_feedback_requires_global_context_rules_without_a_provider_widget(self):
        for kind in ('transient', 'asynchronous'):
            page = {'pageType': 'basic-detail', 'components': [component('Save', 'plasmic-antd6-button')],
                    'feedback': [{'nodeName': 'Save', 'event': 'onClick', 'kind': kind}]}
            for stage in ('compose', 'accept'):
                with self.subTest(kind=kind, stage=stage):
                    self.assertIn(V6 + 'components/config-provider.md', required_reads(page, stage))
            page['feedback'][0]['notApplicable'] = 'This action has no operation feedback.'
            self.assertNotIn(V6 + 'components/config-provider.md', required_reads(page))

    def test_source_wireframes_route_in_both_stages_independently_of_library(self):
        rule = 'references/design/text-wireframes.md'
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'requirement.md'
            quote = '[保存]'
            source.write_text(quote, encoding='utf-8')
            wireframe = {'source': {'path': str(source), 'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                                    'quote': quote}, 'items': [{'text': quote, 'node': 'Save'}]}
            for library in ('antd5', 'antd6'):
                page = {'components': [component('Save', 'plasmic-' + library + '-button')], 'wireframe': wireframe}
                for stage in ('compose', 'accept'):
                    with self.subTest(library=library, stage=stage):
                        self.assertIsNone(required_reads(page, stage)[rule])
                        without = {**page, 'wireframe': {'notApplicable': 'The requirement contains prose only.'}}
                        self.assertNotIn(rule, required_reads(without, stage))


class DeliveredReadCoverageTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.path = 'references/rules.md'
        self.file = self.root / self.path
        self.file.parent.mkdir()
        self.text = '# Rules\nPreamble\n## Generation\nContract\n### First\nOne\n### Second\nTwo\n## Acceptance\nVerify\n'
        self.file.write_text(self.text, encoding='utf-8')
        self.patch = patch('verify_selection.RESOURCE_ROOT', self.root)
        self.patch.start()
        self.addCleanup(self.patch.stop)

    def ledger(self, anchors):
        return {'path': self.file.as_posix(), 'sha256': hashlib.sha256(self.text.encode()).hexdigest(),
                'sections': anchors, 'outline': False, 'bytes': len(select(self.text, anchors).encode())}

    def test_separate_reads_cover_actual_preamble_ancestors_and_entire_document(self):
        ledger = [self.ledger(['first']), self.ledger(['second']), self.ledger(['acceptance'])]
        self.assertEqual(coverage_errors({self.path: None}, ledger), [])
        self.assertEqual(coverage_errors({self.path: {'generation'}}, ledger[:2]), [])

    def test_ancestor_introduction_does_not_cover_an_unread_sibling(self):
        result = coverage_errors({self.path: {'generation'}}, [self.ledger(['first'])])
        self.assertEqual(result[0]['missingSections'], ['generation'])
        result = coverage_errors({self.path: None}, [self.ledger(['first']), self.ledger(['acceptance'])])
        self.assertEqual(result[0]['missingSections'], ['second'])

    def test_headingless_document_still_needs_a_read(self):
        self.text = 'Required contract without headings.\n'
        self.file.write_text(self.text, encoding='utf-8')
        self.assertTrue(coverage_errors({self.path: None}, []))
        self.assertEqual(coverage_errors({self.path: None}, [self.ledger([])]), [])

    def test_unknown_sections_outline_and_stale_records_do_not_cover_rules(self):
        record = self.ledger(['first'])
        for wrong in ({**record, 'sections': ['missing']}, {**record, 'outline': True},
                      {**record, 'sha256': 'old'}, {**record, 'sections': 'first'}):
            with self.subTest(record=wrong):
                self.assertTrue(coverage_errors({self.path: {'first'}}, [wrong]))


class SelectionCliModeTests(unittest.TestCase):
    def test_complete_page_cannot_omit_type_or_wireframe_with_a_real_read_ledger(self):
        from prepare_plan import example, project_rules, rules
        from verify_selection import load_ledger
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = example(root / 'fixture')
            expected = json.loads(source.read_text(encoding='utf-8'))
            ledger = root / 'reads.jsonl'
            for card in (project_rules(ledger, plan=expected), rules(expected, '/records', ledger)):
                for read in card['reads']:
                    subprocess.run(read['args'], check=True, capture_output=True)
            # Removing pageType selects the chooser; read the full source so the
            # negative case fails on the missing decision, not an unrelated read.
            subprocess.run([sys.executable, str(Path(__file__).with_name('read_reference.py')),
                            str(rules_manifest.RESOURCE_ROOT / 'references/design/page-types.md'), '--log', str(ledger)],
                           check=True, capture_output=True)
            records = load_ledger(ledger)
            self.assertTrue(check(expected, page_path='/records', reads=records)['passed'])
            for fields in (('pageType',), ('wireframe',), ('pageStructure',), ('pageType', 'wireframe', 'pageStructure')):
                with self.subTest(missing=fields):
                    incomplete = copy.deepcopy(expected)
                    for field in fields:
                        del incomplete['pages'][0][field]
                    report = check(incomplete, page_path='/records', reads=records)
                    self.assertFalse(report['passed'])
                    self.assertFalse(any(e['check'] == 'referenceReads' for e in report['errors']))
                    for field in fields:
                        self.assertTrue(any(e.get('pointer') == '/pages/0/' + field for e in report['errors']), report)
                    source.write_text(json.dumps(incomplete, ensure_ascii=False), encoding='utf-8')
                    run = subprocess.run([sys.executable, '-B', str(Path(__file__).with_name('verify_selection.py')),
                                          str(source), '--page', '/records', '--reads', str(ledger)],
                                         capture_output=True, text=True)
                    self.assertEqual(run.returncode, 1, run.stderr)
                    self.assertFalse(json.loads(run.stdout)['passed'])

    def test_component_snippets_keep_their_partial_plan_contract(self):
        self.assertEqual(plan_errors({'components': [], 'feedback': []}), [])

    def test_cli_requires_ledger_or_explicit_declarations_only_mode(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'plan.json'
            source.write_text(json.dumps({'pages': []}), encoding='utf-8')
            command = [sys.executable, '-B', str(Path(__file__).with_name('verify_selection.py')), str(source)]
            missing = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(missing.returncode, 2)
            self.assertIn('--reads', missing.stderr)
            plan_only = subprocess.run(command + ['--plan-only'], capture_output=True, text=True)
            report = json.loads(plan_only.stdout)
            self.assertIn('reference reading coverage (no read ledger supplied)', report['notChecked'])
            self.assertFalse(any(e['check'] == 'referenceReads' for e in report['errors']))
            readback = subprocess.run(command + [str(source), '--plan-only'], capture_output=True, text=True)
            self.assertEqual(readback.returncode, 2)
            ledger = Path(directory) / 'reads.jsonl'
            ledger.write_text('', encoding='utf-8')
            checked = subprocess.run(command + ['--reads', str(ledger)], capture_output=True, text=True)
            self.assertTrue(any(e['check'] == 'referenceReads' for e in json.loads(checked.stdout)['errors']))

    def test_internal_check_reports_omitted_read_coverage(self):
        report = check({'pages': []})
        self.assertIn('reference reading coverage (no read ledger supplied)', report['notChecked'])
        self.assertNotIn('reference reading coverage (no read ledger supplied)', check({'pages': []}, reads=[])['notChecked'])


if __name__ == '__main__':
    unittest.main()
