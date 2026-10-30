import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

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
        spec('NameColumn', COLUMN, name_role, props=name_props or {'dataIndex': 'name'}, owner=owner),
        spec('StateColumn', COLUMN, 'status', props=status_props if status_props is not None else {'dataIndex': 'status', 'width': 128}, owner=owner),
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
        errors = width_errors(table_plan(table_props={}, status_props={'dataIndex': 'status'},
                                         action_props={'fixed': 'right'}))
        self.assertTrue(any('fixed:"right"' in e['message'] for e in errors))
        self.assertTrue(any('Decide Column widths' in e['message'] for e in errors))

    def test_main_column_cannot_be_status(self):
        plan = table_plan(name_props={'dataIndex': 'name', 'width': 240},
                          status_props={'dataIndex': 'status'})
        self.assertTrue(any('main text Column' in e['message'] and e.get('column') == 'StateColumn'
                            for e in width_errors(plan)))

    def test_two_width_free_columns_fail(self):
        plan = table_plan(status_props={'dataIndex': 'status'})
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
            errors = [e for e in read_coverage_errors(plan, self.ledger(directory, ['columns'])) if e['rule'] == TABLE]
        self.assertEqual(len(errors), 1)
        self.assertEqual(errors[0]['missingSections'], ['generation-rules', 'plan-decisions'])

    def test_parent_section_covers_descendants_and_full_read_covers_all(self):
        plan = {'components': [spec('Results', 'plasmic-antd6-table', 'data-table', rule=TABLE + '#operation-column-sizing')]}
        sections = ['plan-decisions', 'generation-rules']
        with tempfile.TemporaryDirectory() as directory:
            self.assertEqual([e for e in read_coverage_errors(plan, self.ledger(directory, sections)) if e['rule'] == TABLE], [])
        with tempfile.TemporaryDirectory() as directory:
            self.assertEqual([e for e in read_coverage_errors(plan, self.ledger(directory, [])) if e['rule'] == TABLE], [])

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
        # Native size defaults remain unset; other Table decisions stay pending.
        self.assertEqual(components['Results']['props'], {'scroll': '__DECIDE__', 'pagination': '__DECIDE__'})
        self.assertEqual(components['ActionColumn']['props'], {'fixed': 'right', 'width': '__DECIDE__'})
        self.assertEqual(components['ActionColumn']['presentation'], '__DECIDE__')
        self.assertEqual(components['RowActions']['props'], {'max': 3})
        self.assertEqual(components['ListCard']['props'], {'variant': 'outlined', 'styles': {'body': {'padding': '__DECIDE__'}}})
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

    def test_scaffold_preserves_size_inheritance_and_explicit_overrides(self):
        from prepare_plan import scaffold
        from verify_selection import decision_errors
        for suffix in ('button', 'input', 'input-number', 'select', 'date-range-picker',
                       'segmented', 'tabs', 'table', 'card'):
            for props in ({}, {'size': 'small'}):
                with self.subTest(component=suffix, props=props):
                    plan, _ = scaffold({'pages': [{'path': '/records', 'components': [
                        spec('Target', 'plasmic-antd6-' + suffix, 'widget', props=props.copy())]}]})
                    page = plan['pages'][0]
                    actual = page['components'][0].get('props', {})
                    if 'size' in props:
                        self.assertEqual(actual['size'], props['size'])
                    else:
                        self.assertNotIn('size', actual)
                    self.assertFalse([e for e in decision_errors(page) if e.get('prop') == 'size'])

    def test_null_decision_means_absent_in_saved_model(self):
        from verify_structure import matches_props
        self.assertTrue(matches_props({'width': None, 'dataIndex': 'name'}, {'dataIndex': 'name'}))
        self.assertFalse(matches_props({'width': None}, {'width': 120}))
        errors = plan_errors({'feedback': [], 'components': [
            spec('Results', 'plasmic-antd6-table', 'data-table', props={'size': 'large', 'scroll': None, 'pagination': None})]})
        self.assertEqual([(e['check'], e['prop']) for e in errors if e['check'] == 'planDecision'], [('planDecision', 'pagination')])

    def test_page_type_and_conditions_add_composition_documents(self):
        from verify_selection import required_reads
        page = {'pageType': 'list', 'feedback': [], 'components': [
            spec('Results', 'plasmic-antd6-table', 'data-table', props={'size': 'large'})]}
        needed = required_reads(page)
        self.assertIn('references/libraries/overseas/compositions/search-table.md', needed)
        self.assertNotIn('references/libraries/antd_v6/compositions/modal-drawer.md', needed)
        page['components'].append(spec('EditDrawer', 'plasmic-antd6-drawer', 'overlay-form'))
        page.update(recordPage=True, actionContracts=[{'nodeName': 'RowActions', 'key': 'edit'}],
                    feedback=[{'nodeName': 'Save', 'event': 'onClick', 'kind': 'asynchronous'}])
        needed = required_reads(page)
        for path in ('references/libraries/antd_v6/compositions/modal-drawer.md',
                     'references/libraries/antd_v6/compositions/content-states.md'):
            self.assertIn(path, needed)
        # Task-wide rules join the project card once any Page needs them, not every Page card.
        from verify_selection import project_reads
        self.assertNotIn('references/design/record-context.md', needed)
        project = project_reads('compose', {'pages': [page]})
        self.assertIn('references/design/record-context.md', project)
        self.assertIn('references/design/permissions.md', project)
        self.assertNotIn('references/design/permissions.md', project_reads('compose', {'pages': [{'actionContracts': '__DECIDE__'}]}))

    def test_dynamic_navigation_delivers_the_appshell_conditional_section(self):
        from verify_selection import required_reads
        page = {'components': [spec('Shell', 'plasmic-overseas-app-shell', 'shell')]}
        shell = 'references/libraries/overseas/components/app-shell.md'
        self.assertNotIn('cross-page-context-and-dynamic-menus', required_reads(page)[shell])
        root = {'navigation': {'items': [], 'roleQuery': {'state': 'viewer', 'query': 'role', 'default': 'admin'}}}
        self.assertIn('cross-page-context-and-dynamic-menus', required_reads(page, 'compose', root)[shell])
        page['components'][0]['dynamicProps'] = ['menuItems']
        self.assertIn('cross-page-context-and-dynamic-menus', required_reads(page)[shell])

    def test_project_card_is_read_once_and_checked_with_every_page(self):
        from prepare_plan import project_rules
        from verify_selection import check, load_ledger
        with tempfile.TemporaryDirectory() as tmp:
            ledger = Path(tmp) / 'reads.jsonl'
            card = project_rules(ledger)
            self.assertEqual([r['rule'] for r in card['reads']], sorted(['references/libraries/index.md', 'references/design/page-structure.md', 'references/design/layout.md', 'references/design/naming.md',
                                                                         'references/design/content-review.md', 'references/design/accessibility.md']))
            ledger.write_text('')
            report = check({'pages': [{'path': '/records', 'components': []}]}, page_path='/records', reads=load_ledger(ledger))
            self.assertIn('--project', json.dumps(report['errors']))
            for read in card['reads']:
                subprocess.run(read['args'], check=True, capture_output=True)
            report = check({'pages': [{'path': '/records', 'components': []}]}, page_path='/records', reads=load_ledger(ledger))
            self.assertNotIn('--project', json.dumps(report['errors']))

    def test_bundled_list_page_routes_context_and_reports_reading_load(self):
        from prepare_plan import example
        with tempfile.TemporaryDirectory() as tmp:
            plan = json.loads(example(Path(tmp) / 'fixture').read_text(encoding='utf-8'))
            card = rules(plan, '/records', Path(tmp) / 'reads.jsonl')
        self.assertGreater(card['totalBytes'], 0)
        self.assertIsInstance(card['readingBudgetExceeded'], bool)
        shell = next(r for r in card['reads'] if r['rule'].endswith('app-shell.md'))
        # App context and dynamic-menu sections reach only Pages that need them.
        self.assertEqual(shell['sections'], ['generation-rules'])
        plan['pages'][0]['appContext'] = {'required': True}
        with tempfile.TemporaryDirectory() as tmp:
            card = rules(plan, '/records', Path(tmp) / 'reads.jsonl')
        shell = next(r for r in card['reads'] if r['rule'].endswith('app-shell.md'))
        self.assertEqual(shell['sections'], ['app-context', 'generation-rules'])

    def test_rules_card_reports_bytes_and_stage(self):
        plan = {'pages': [{'path': '/records', **table_plan()}]}
        with tempfile.TemporaryDirectory() as directory:
            compose = rules(plan, '/records', Path(directory) / 'l.jsonl')
            accept = rules(plan, '/records', Path(directory) / 'l.jsonl', 'accept')
        self.assertLess(compose['totalBytes'], accept['totalBytes'])
        self.assertTrue(all(r['sections'] == 'full' for r in accept['reads']))

    def test_large_cards_keep_all_reads_and_provide_a_capability_fallback(self):
        plan = {'pages': [{'path': '/records', **table_plan()}]}
        with tempfile.TemporaryDirectory() as directory:
            for stage in ('compose', 'accept'):
                with self.subTest(stage=stage):
                    ledger = Path(directory) / 'reads.jsonl'
                    original = rules(plan, '/records', ledger, stage)
                    with patch('prepare_plan.READING_BUDGET_BYTES', 1):
                        card = rules(plan, '/records', ledger, stage)
                    self.assertTrue(card['readingBudgetExceeded'])
                    self.assertEqual(card['reads'], original['reads'])
                    self.assertEqual(card['hardConstraints'], original['hardConstraints'])
                    self.assertIn('client-supported compaction when available', card['next'])
                    self.assertIn('Otherwise read sections sequentially with disk checkpoints', card['next'])
                    self.assertIn('If actual context capacity is insufficient', card['next'])


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


class HeaderAndWireframePlanTests(unittest.TestCase):
    def test_scaffold_puts_plan_fields_outside_native_props(self):
        from prepare_plan import scaffold
        minimal = {'pages': [{'path': '/selector', 'components': [
            {'nodeName': 'SqlCard', 'component': 'plasmic-antd6-card', 'role': 'surface'},
            {'nodeName': 'Checks', 'component': 'plasmic-antd6-descriptions', 'role': 'read-only-group'},
            {'nodeName': 'BasicForm', 'component': 'plasmic-antd6-form', 'role': 'submitted-form'}]}]}
        plan, _ = scaffold(minimal)
        card, checks, form = plan['pages'][0]['components']
        self.assertEqual(card['header'], '__DECIDE__')
        self.assertNotIn('header', card['props'])
        self.assertEqual(checks['props']['column'], '__DECIDE__')
        self.assertEqual({form['props'][k] for k in ('layout', 'labelAlign', 'labelCol')}, {'__DECIDE__'})
        self.assertEqual(plan['pages'][0]['wireframe'], '__DECIDE__')
        pointers = {e['pointer'] for e in plan_errors(plan['pages'][0]) if e['check'] == 'decisionPending'}
        self.assertIn('/components/0/header', pointers)
        self.assertIn('/wireframe', pointers)

    def card(self, **fields):
        return {'components': [spec('SqlCard', 'plasmic-antd6-card', 'surface', rule='references/libraries/antd_v6/components/card.md',
                                    condition='SQL editing surface', props={'size': 'medium', 'variant': 'outlined',
                                                                            'styles': {'body': {'padding': '16px 20px'}}}, **fields)],
                'feedback': []}

    def header_errors(self, **fields):
        return [e for e in plan_errors(self.card(**fields)) if e['check'] == 'planDecision']

    def test_card_header_decision_order(self):
        for fields in ({'header': 'none'}, {'header': 'title', 'headerReason': 'distinguish'},
                       {'header': 'title+extra', 'headerReason': 'actions'}, {'header': 'title', 'headerReason': 'count'}):
            with self.subTest(fields=fields):
                self.assertEqual(self.header_errors(**fields), [])
        for fields in ({}, {'header': 'extra'}, {'header': 'title'}, {'header': 'none', 'headerReason': 'actions'},
                       {'header': 'title+extra', 'headerReason': 'distinguish'}):
            with self.subTest(fields=fields):
                errors = self.header_errors(**fields)
                self.assertTrue(errors)
                self.assertTrue(all('card' in e['rule'] for e in errors))

    def wireframe_plan(self, directory, items, quote=None):
        source = Path(directory) / 'prd.md'
        block = '│ 名称[____] 描述[____] 类型▾ │\n│ ── SQL 编辑卡 ── │\n│ 卡头: [格式化] [校验] │'
        source.write_text('# 圈选器\n' + block + '\n', encoding='utf-8')
        import hashlib
        evidence = {'path': str(source), 'sha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'quote': quote or block}
        names = ['NameItem', 'DescItem', 'TypeItem', 'SqlCard', 'FormatButton', 'ValidateButton']
        return {'feedback': [], 'components': [spec(n, 'plasmic-antd6-button', 'widget', rule='references/libraries/antd_v6/components/button.md') for n in names],
                'wireframe': {'source': evidence, 'items': items}}

    def wireframe_errors(self, plan):
        return [e for e in plan_errors(plan) if e['check'] == 'wireframe']

    def test_wireframe_inventory_must_cover_every_bracket_and_dropdown(self):
        complete = [{'text': '名称[____]', 'node': 'NameItem'}, {'text': '描述[____]', 'node': 'DescItem'},
                    {'text': '类型▾', 'node': 'TypeItem'}, {'text': '── SQL 编辑卡 ──', 'node': 'SqlCard'},
                    {'text': '卡头: [格式化] [校验]', 'node': ['FormatButton', 'ValidateButton']}]
        with tempfile.TemporaryDirectory() as directory:
            self.assertEqual(self.wireframe_errors(self.wireframe_plan(directory, complete)), [])
            dropped = [item for item in complete if item['node'] != 'DescItem']
            missing = self.wireframe_errors(self.wireframe_plan(directory, dropped))
            self.assertEqual([e.get('token') for e in missing], ['描述[____]'])
            excluded = dropped + [{'text': '描述[____]', 'excluded': 'Removed by the current user decision of 2026-10-25'}]
            self.assertEqual(self.wireframe_errors(self.wireframe_plan(directory, excluded)), [])
            for bad in ({'text': '备注[____]', 'node': 'DescItem'}, {'text': '描述[____]', 'node': 'Unknown'},
                        {'text': '描述[____]', 'node': 'DescItem', 'excluded': 'both'}, {'text': '描述[____]', 'excluded': ' '}):
                with self.subTest(bad=bad):
                    self.assertTrue(self.wireframe_errors(self.wireframe_plan(directory, dropped + [bad])))
        self.assertEqual(self.wireframe_errors({'feedback': [], 'components': [], 'wireframe': {'notApplicable': 'Prose-only requirement'}}), [])
        self.assertTrue(self.wireframe_errors({'feedback': [], 'components': [], 'wireframe': {'notApplicable': ''}}))


class FormSkeletonTests(unittest.TestCase):
    def plan_and_inventory(self):
        fields = [('Name', 'name', '客群名称', 'plasmic-antd6-input'), ('Desc', 'description', '描述', 'plasmic-antd6-input'),
                  ('Type', 'groupType', '客群类型', 'plasmic-antd6-select'), ('Mode', 'refreshMode', '刷新模式', 'plasmic-antd6-select'),
                  ('Retention', 'retentionDays', '数据保存天数', 'plasmic-antd6-select'), ('Deadline', 'produceDeadline', '产出截止时间', 'plasmic-antd6-time-picker')]
        components = [spec('BasicForm', 'plasmic-antd6-form', 'submitted-form', rule='references/libraries/antd_v6/components/form.md',
                           props={'mode': 'advanced', 'layout': 'horizontal', 'labelAlign': 'right', 'labelCol': {'flex': '110px'}})]
        inventory_fields = []
        for stem, key, label, registration in fields:
            components.append(spec(stem + 'Item', 'plasmic-antd6-form-item', 'widget', rule='references/libraries/antd_v6/components/form.md',
                                   props={'name': key, 'rules': [{'ruleType': 'required', 'message': '请填写' + label}]}))
            components.append(spec(stem + 'Control', registration, 'widget', rule='references/libraries/antd_v6/components/input.md', props={}))
            inventory_fields.append({'nodeName': stem + 'Item', 'name': key, 'label': label, 'control': stem + 'Control',
                                     'rules': [{'ruleType': 'required'}], 'span': 1})
        form = {'name': 'BasicForm', 'formLayout': 'horizontal', 'fields': inventory_fields,
                'layout': {'container': 'BasicFields', 'columns': 3, 'gutter': 16},
                'labelWidth': {'longestLabel': '产出截止时间', 'labelTextPx': 84, 'requiredMarkPx': 11, 'helpIconPx': 0, 'paddingPx': 15, 'measuredPx': 110,
                               'measuredFrom': __import__('test_verify_forms').measured_from()}}
        plan = {'pages': [{'path': '/selector', 'components': components}]}
        return plan, {'pages': [{'path': '/selector', 'forms': [form], 'standaloneControls': []}]}

    def test_skeleton_passes_the_forms_gate_by_construction(self):
        from prepare_plan import form_skeleton
        import verify_forms
        plan, inventory = self.plan_and_inventory()
        markup = form_skeleton(plan, inventory, '/selector', 'BasicForm')
        self.assertEqual(markup.count('plasmic-antd6-col'), 6)
        self.assertEqual(markup.count('&quot;span&quot;:8'), 6)
        self.assertIn('DeadlineControl" data-plasmic-component="plasmic-antd6-time-picker" data-props="{}" style="width:100%"', markup)
        overview = {'results': [{'__type': 'Project', 'components': [{'uuid': 'page', 'type': 'page', 'pageMeta': {'path': '/selector'}}]}]}
        readback = {'results': [{'uuid': 'page', 'type': 'page', 'baseVariantTplTree': '<div>' + markup + '</div>'}]}
        result = verify_forms.check(inventory, overview, readback)
        self.assertTrue(result['passed'], result)
        inventory['pages'][0]['forms'][0]['fields'][1]['span'] = 3
        full_row = form_skeleton(plan, inventory, '/selector', 'BasicForm')
        self.assertEqual(full_row.count('&quot;span&quot;:24'), 1)
        self.assertTrue(verify_forms.check(inventory, overview, {'results': [{**readback['results'][0], 'baseVariantTplTree': full_row}]})['passed'])

    def test_skeleton_accepts_one_container_array_without_mutating_inventory(self):
        from prepare_plan import form_skeleton
        plan, inventory = self.plan_and_inventory()
        expected = form_skeleton(plan, inventory, '/selector', 'BasicForm')
        layout = inventory['pages'][0]['forms'][0]['layout']
        layout['container'] = [layout['container']]
        self.assertEqual(form_skeleton(plan, inventory, '/selector', 'BasicForm'), expected)
        self.assertEqual(layout['container'], ['BasicFields'])

    def test_skeleton_refuses_undecided_or_inconsistent_inputs(self):
        from prepare_plan import form_skeleton
        for change in ('layout', 'labelCol', 'pending'):
            with self.subTest(change=change):
                plan, inventory = self.plan_and_inventory()
                form = inventory['pages'][0]['forms'][0]
                if change == 'layout':
                    form.pop('layout')
                elif change == 'labelCol':
                    plan['pages'][0]['components'][0]['props']['labelCol'] = {'flex': '120px'}
                else:
                    plan['pages'][0]['components'][0]['props']['labelAlign'] = '__DECIDE__'
                with self.assertRaises(ValueError):
                    form_skeleton(plan, inventory, '/selector', 'BasicForm')


class PageTypeTests(unittest.TestCase):
    def test_page_types_match_the_document_and_reach_the_card(self):
        from read_reference import sections
        from verify_selection import PAGE_TYPES, SCALE
        text = (RESOURCE_ROOT / 'references/design/page-types.md').read_text(encoding='utf-8')
        documented = [h['anchor'] for h in sections(text)[1] if h['level'] == 3]
        self.assertEqual(list(PAGE_TYPES), documented)
        for value in PAGE_TYPES:
            self.assertIn(f'`{value}`', text.split('## Page types', 1)[0], f'{value} missing from the chooser table')
        plan = {**table_plan(), 'pageType': 'list'}
        needed = required_reads(plan)
        self.assertIsNone(needed[SCALE])
        self.assertEqual(needed['references/design/page-types.md'], {'list', 'regions-inside-any-type'})
        self.assertEqual(required_reads({**table_plan(), 'pageType': '__DECIDE__'})['references/design/page-types.md'], {'choosing-the-type'})

    def test_page_type_must_be_a_known_type(self):
        errors = [e for e in plan_errors({**table_plan(), 'pageType': 'dashboard'}) if e['check'] == 'pageType']
        self.assertEqual(len(errors), 1)
        self.assertFalse([e for e in plan_errors({**table_plan(), 'pageType': 'tabbed-list'}) if e['check'] == 'pageType'])


class DesignDefaultsTests(unittest.TestCase):
    CORE = ['button', 'input', 'select', 'input-number', 'date-picker', 'time-picker', 'radio', 'checkbox', 'switch',
            'tree-select', 'cascader', 'upload', 'table', 'pagination', 'tabs', 'modal', 'drawer', 'alert', 'badge', 'tag',
            'typography', 'statistic', 'steps', 'dropdown', 'tooltip', 'popconfirm', 'space', 'flex', 'grid', 'empty',
            'result', 'list', 'collapse', 'segmented', 'spin', 'skeleton']

    def test_core_components_state_their_design_defaults_first(self):
        from read_reference import sections
        documents = [f'references/libraries/antd_v6/components/{name}.md' for name in self.CORE] + [
            'references/libraries/overseas/components/app-shell.md', 'references/libraries/overseas/components/search-form.md',
            'references/libraries/react_ui/components/action-group.md']
        for document in documents:
            with self.subTest(document=document):
                text = (RESOURCE_ROOT / document).read_text(encoding='utf-8')
                headings = [h for h in sections(text)[1]]
                generation = next(i for i, h in enumerate(headings) if h['anchor'] == 'generation-rules')
                self.assertIn(headings[generation + 1]['anchor'], ('design-defaults', '设计默认'),
                              'Design defaults must be the first Generation rules section')
