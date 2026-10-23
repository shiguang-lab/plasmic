import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from prepare_plan import rules
from read_reference import select
from verify_selection import RESOURCE_ROOT, plan_errors, read_coverage_errors, required_reads

TABLE = 'references/libraries/antd_v6/components/table.md'
COLUMN = 'plasmic-antd6-table-column'


def spec(name, component, role, rule=TABLE, **extra):
    return {'nodeName': name, 'component': component, 'role': role, 'purpose': 'Source-reviewed purpose',
            'source': 'requirement §Results', 'rule': rule, **extra}


def table_plan(table_props=None, name_props=None, status_props=None, action_props=None, name_role='widget'):
    owner = {'nodeName': 'Results', 'slot': 'children'}
    return {'feedback': [], 'components': [
        spec('Results', 'plasmic-antd6-table', 'data-table', props=table_props if table_props is not None else {'scroll': {'x': 568}}),
        spec('NameColumn', COLUMN, name_role, props=name_props or {'dataIndex': 'name', 'displayType': 'text'}, owner=owner),
        spec('StateColumn', COLUMN, 'status', props=status_props if status_props is not None else {'dataIndex': 'status', 'displayType': 'custom', 'width': 128}, owner=owner),
        spec('ActionColumn', COLUMN, 'widget', props=action_props if action_props is not None else {'fixed': 'right', 'width': 200}, owner=owner),
        spec('RowActions', 'plasmic-react-ui-action-group', 'row-actions', rule='references/libraries/react_ui/components/action-group.md',
             owner={'nodeName': 'ActionColumn', 'slot': 'render'})]}


def width_errors(plan):
    return [e for e in plan_errors(plan) if e['check'] == 'tableWidthPlan']


class TableWidthPlanTests(unittest.TestCase):
    def test_complete_width_decision_passes(self):
        self.assertEqual(width_errors(table_plan()), [])

    def test_missing_scroll_x_fails_before_markup(self):
        errors = width_errors(table_plan(table_props={}))
        self.assertTrue(any('scroll.x' in e['message'] for e in errors))

    def test_scroll_x_must_exceed_explicit_widths(self):
        self.assertTrue(width_errors(table_plan(table_props={'scroll': {'x': 328}})))

    def test_undecided_widths_fail_when_typed_columns_exist(self):
        errors = width_errors(table_plan(table_props={}, status_props={'dataIndex': 'status', 'displayType': 'custom'},
                                         action_props={'fixed': 'right'}))
        self.assertTrue(any('fixed:"right"' in e['message'] for e in errors))
        self.assertTrue(any('Decide Column widths' in e['message'] for e in errors))

    def test_main_column_cannot_be_status(self):
        plan = table_plan(name_props={'dataIndex': 'name', 'width': 240},
                          status_props={'dataIndex': 'status', 'displayType': 'custom'})
        self.assertTrue(any('main text Column' in e['message'] and e.get('column') == 'StateColumn'
                            for e in width_errors(plan)))

    def test_two_width_free_columns_fail(self):
        plan = table_plan(status_props={'dataIndex': 'status', 'displayType': 'custom'})
        self.assertTrue(any('Exactly one main text Column' in e['message'] for e in width_errors(plan)))

    def test_plain_text_table_without_widths_is_not_forced(self):
        plan = {'feedback': [], 'components': [
            spec('Results', 'plasmic-antd6-table', 'data-table'),
            spec('A', COLUMN, 'widget', props={'dataIndex': 'a'}, owner={'nodeName': 'Results', 'slot': 'children'}),
            spec('B', COLUMN, 'widget', props={'dataIndex': 'b'}, owner={'nodeName': 'Results', 'slot': 'children'})]}
        self.assertEqual(width_errors(plan), [])


class ReadCoverageTests(unittest.TestCase):
    def ledger(self, directory, *selections):
        log = Path(directory) / 'reads.jsonl'
        for selection in selections:
            args = [sys.executable, str(RESOURCE_ROOT / 'scripts/read_reference.py'), str(RESOURCE_ROOT / TABLE), '--log', str(log)]
            for anchor in selection:
                args += ['--section', anchor]
            subprocess.run(args, check=True, capture_output=True)
        return [json.loads(line) for line in log.read_text().splitlines()]

    def test_required_reads_follow_stage_template(self):
        needed = required_reads(table_plan())
        self.assertEqual(needed[TABLE], {'plan-decisions', 'generation-rules'})
        self.assertEqual(needed['references/libraries/react_ui/components/action-group.md'], {'plan-decisions', 'generation-rules'})
        self.assertIsNone(required_reads(table_plan(), 'accept')[TABLE])
        anchored = {'components': [spec('Results', 'plasmic-antd6-table', 'data-table', rule=TABLE + '#loading-empty-and-failure-acceptance')]}
        self.assertIn('loading-empty-and-failure-acceptance', required_reads(anchored)[TABLE])

    def test_missing_width_section_is_reported(self):
        plan = {'components': [spec('Results', 'plasmic-antd6-table', 'data-table', rule=TABLE + '#columns')]}
        with tempfile.TemporaryDirectory() as directory:
            errors = read_coverage_errors(plan, self.ledger(directory, ['columns']))
        self.assertEqual(len(errors), 1)
        self.assertEqual(errors[0]['missingSections'], ['generation-rules', 'plan-decisions'])

    def test_parent_section_covers_descendants_and_full_read_covers_all(self):
        plan = {'components': [spec('Results', 'plasmic-antd6-table', 'data-table', rule=TABLE + '#operation-column-sizing')]}
        sections = ['plan-decisions', 'generation-rules']
        with tempfile.TemporaryDirectory() as directory:
            self.assertEqual(read_coverage_errors(plan, self.ledger(directory, sections)), [])
        with tempfile.TemporaryDirectory() as directory:
            self.assertEqual(read_coverage_errors(plan, self.ledger(directory, [])), [])

    def test_stale_hash_and_outline_do_not_count(self):
        plan = {'components': [spec('Results', 'plasmic-antd6-table', 'data-table')]}
        with tempfile.TemporaryDirectory() as directory:
            records = self.ledger(directory, [])
        stale = [{**records[0], 'sha256': '0' * 64}]
        outline = [{**records[0], 'outline': True}]
        self.assertTrue(read_coverage_errors(plan, stale))
        self.assertTrue(read_coverage_errors(plan, outline))

    def test_preamble_hard_constraints_survive_section_reads(self):
        text = (RESOURCE_ROOT / TABLE).read_text(encoding='utf-8')
        self.assertIn('**Hard constraints**', select(text, ['selection']))

    def test_rules_card_commands_satisfy_preflight(self):
        plan = {'pages': [{'path': '/records', **table_plan()}]}
        with tempfile.TemporaryDirectory() as directory:
            log = Path(directory) / 'reads.jsonl'
            card = rules(plan, '/records', log)
            for read in card['reads']:
                subprocess.run(read['args'], check=True, capture_output=True)
            ledger = [json.loads(line) for line in log.read_text().splitlines()]
            self.assertEqual(read_coverage_errors(plan['pages'][0], ledger), [])


if __name__ == '__main__':
    unittest.main()


class ManifestAndScaffoldTests(unittest.TestCase):
    def test_every_catalog_document_follows_stage_template(self):
        import re
        from rules_manifest import manifest, stage_sections
        documents = {entry['document'] for entry in manifest()['registrations'].values()}
        self.assertGreater(len(documents), 100)
        for document in documents:
            with self.subTest(document=document):
                self.assertIn('generation-rules', stage_sections(document))
                text = (RESOURCE_ROOT / document).read_text(encoding='utf-8')
                self.assertTrue(re.search(r'^\| [^|]+ \| `plasmic-[^`]+` \|$', text.split('\n\n## ')[0], re.M))

    def test_decision_rules_resolve_and_are_listed(self):
        from read_reference import sections
        from rules_manifest import decision_rule, manifest
        for entry in manifest()['registrations'].values():
            for item in entry['decisions']:
                with self.subTest(key=entry['key'], prop=item['prop']):
                    path, anchor = decision_rule(entry['key'], item).split('#')
                    text = (RESOURCE_ROOT / path).read_text(encoding='utf-8')
                    self.assertIn(anchor, {h['anchor'] for h in sections(text)[1]})
                    self.assertIn(f"| `{entry['key']}` | `{item['prop']}`", text)

    def test_shared_rule_map_targets_exist(self):
        from read_reference import sections
        from rules_manifest import manifest
        data = manifest()
        for target in [*data['gates'].values(), *data['checks'].values(), *data['libraryChecks'].values(), *data['pageDecisions'].values()]:
            with self.subTest(target=target):
                path, _, anchor = target.partition('#')
                text = (RESOURCE_ROOT / path).read_text(encoding='utf-8')
                if anchor:
                    self.assertIn(anchor, {h['anchor'] for h in sections(text)[1]})

    def minimal(self):
        owner = {'nodeName': 'Results', 'slot': 'children'}
        return {'pages': [{'path': '/records', 'name': '记录', 'components': [
            {'nodeName': 'Results', 'component': 'plasmic-antd6-table', 'role': 'pagination', 'purpose': 'p', 'source': 's'},
            {'nodeName': 'NameColumn', 'component': COLUMN, 'role': 'widget', 'purpose': 'p', 'source': 's', 'owner': owner},
            {'nodeName': 'ActionColumn', 'component': COLUMN, 'role': 'widget', 'purpose': 'p', 'source': 's', 'owner': owner,
             'props': {'fixed': 'right'}},
            {'nodeName': 'RowActions', 'component': 'plasmic-react-ui-action-group', 'role': 'row-actions', 'purpose': 'p', 'source': 's',
             'owner': {'nodeName': 'ActionColumn', 'slot': 'render'}},
            {'nodeName': 'ListCard', 'component': 'plasmic-antd6-card', 'role': 'surface', 'purpose': 'p', 'source': 's'}]}]}

    def test_scaffold_adds_owners_baselines_and_pending_slots_only(self):
        from prepare_plan import scaffold
        plan, pending = scaffold(self.minimal())
        page = plan['pages'][0]
        components = {c['nodeName']: c for c in page['components']}
        self.assertEqual(components['Results']['rule'], TABLE)
        self.assertEqual(components['Results']['props'], {'scroll': '__DECIDE__', 'pagination': '__DECIDE__'})
        self.assertEqual(components['ActionColumn']['props'], {'fixed': 'right', 'width': '__DECIDE__', 'displayType': '__DECIDE__'})
        self.assertEqual(components['RowActions']['props'], {'max': 3})
        self.assertEqual(components['ListCard']['props'], {'size': 'medium', 'variant': 'outlined', 'styles': {'body': {'padding': '__DECIDE__'}}})
        self.assertEqual(components['ListCard']['condition'], '__DECIDE__')
        self.assertEqual(page['actionContracts'], '__DECIDE__')
        self.assertNotIn('appContext', page)
        self.assertEqual(pending, sum(1 for _ in __import__('verify_selection').pending_pointers(plan)))

    def test_pending_decisions_are_reported_once_with_rules(self):
        from prepare_plan import scaffold
        from verify_selection import check
        plan, pending = scaffold(self.minimal())
        report = check(plan, page_path='/records')
        pending_errors = [e for e in report['errors'] if e['check'] == 'decisionPending']
        self.assertEqual(len(pending_errors), pending)
        self.assertTrue(all(e.get('rule') for e in report['errors']))
        width = next(e for e in pending_errors if e['pointer'] == '/pages/0/components/1/props/width')
        self.assertEqual(width['rule'], TABLE + '#content-and-scroll-width')
        self.assertFalse(any('__DECIDE__' in json.dumps(e, ensure_ascii=False) for e in report['errors'] if e['check'] != 'decisionPending'))

    def test_null_decision_means_absent_in_saved_model(self):
        from verify_structure import matches_props
        self.assertTrue(matches_props({'width': None, 'dataIndex': 'name'}, {'dataIndex': 'name'}))
        self.assertFalse(matches_props({'width': None}, {'width': 120}))
        errors = plan_errors({'feedback': [], 'components': [
            spec('Results', 'plasmic-antd6-table', 'data-table', props={'scroll': None, 'pagination': None})]})
        self.assertEqual([(e['check'], e['prop']) for e in errors if e['check'] == 'planDecision'], [('planDecision', 'pagination')])

    def test_rules_card_reports_bytes_and_stage(self):
        plan = {'pages': [{'path': '/records', **table_plan()}]}
        with tempfile.TemporaryDirectory() as directory:
            compose = rules(plan, '/records', Path(directory) / 'l.jsonl')
            accept = rules(plan, '/records', Path(directory) / 'l.jsonl', 'accept')
        self.assertLess(compose['totalBytes'], accept['totalBytes'])
        self.assertTrue(all(r['sections'] == 'full' for r in accept['reads']))


class GateAnnotationTests(unittest.TestCase):
    def test_annotation_prefers_library_check_then_registration_then_gate(self):
        from rules_manifest import annotate
        report = {'pages': [{'errors': [
            {'check': 'tableWidth', 'node': 'Results'},
            {'check': 'componentUse', 'registration': 'plasmic-overseas-search-form'},
            {'check': 'component', 'node': 'Results'},
            {'check': 'naming'},
            {'message': 'unclassified'},
            'plain string']}]}
        annotate(report, 'structure', [{'nodeName': 'Results', 'component': 'plasmic-antd6-table'}])
        rules_seen = [e.get('rule') for e in report['pages'][0]['errors'][:5]]
        self.assertEqual(rules_seen, [TABLE + '#content-and-scroll-width',
                                      'references/libraries/overseas/components/search-form.md', TABLE,
                                      'references/design/naming.md#editor-node-naming',
                                      'references/requirement-alignment.md#structural-gate'])
