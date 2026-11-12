import copy
import base64
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

import rules_manifest
from prepare_plan import project_rules, review_skeleton as native_review_skeleton, rules
from verify_review import check as native_check, plan_digest, rule_digest

CARD = 'references/libraries/antd_v6/components/card.md'
STATE = {'projectId': 'project', 'branchId': None, 'sessionId': 's', 'revision': 3, 'changeCounter': 0}


def plan():
    return {'path': '/selector', 'components': [
        {'nodeName': 'SqlCard', 'component': 'plasmic-antd6-card', 'role': 'surface', 'rule': CARD,
         'purpose': 'SQL editing', 'source': 'PRD SQL 编辑卡'},
        {'nodeName': 'Checks', 'component': 'plasmic-antd6-descriptions', 'role': 'read-only-group',
         'rule': 'references/libraries/antd_v6/components/descriptions.md', 'purpose': 'Check results', 'source': 'PRD 校验规则'}]}


def model_readback(root=None):
    pages = (root or {'pages': [plan()]})['pages']
    return {'results': [{'type': 'page', 'uuid': 'page-' + str(index), 'name': page['path'],
                         'pageMeta': {'path': page['path']}, 'baseVariantTplTree': '<div>Static fixture</div>',
                         'props': [], 'states': [], 'interactions': [], 'variants': [], 'variantGroups': [], 'variantSettings': []}
                        for index, page in enumerate(pages)]}


def project_overview():
    return {'results': [{'__type': 'Project', 'id': 'project', 'globalVariantGroups': [], 'screenBreakpoints': []}]}


def check(pages, ledger, review, capture_state=None, project=True, root=None, readback=None, overview=None):
    return native_check(pages, ledger, review, capture_state, project, root,
                        readback if readback is not None else model_readback(root),
                        overview if overview is not None else project_overview())


def review_skeleton(root, capture, mode, page_path=None):
    return native_review_skeleton(root, capture, mode, page_path, readback=model_readback(root), overview=project_overview())


def resolve_visual_review(entry, screenshot, state):
    entry['sourceCoverage'] = {'reviewed': True, 'sources': ['Fixture requirement'],
                               'notes': 'The fixture has one static surface and no conditional branches.'}
    for scenario in entry['visualScenarios']:
        scenario.update(given='The fixture is loaded', steps=['Open the fixture page'],
                        expected='The fixture content is visible', attempts=[{
                            'checkedState': dict(state),
                            'screenshot': {'path': str(screenshot), 'sha256': hashlib.sha256(screenshot.read_bytes()).hexdigest()},
                            'analysis': {'layout': 'Content fits the viewport', 'content': 'Required fixture content is visible',
                                         'controls': 'The fixture has no interactive controls'},
                            'issues': [], 'repairs': []}])


def write_image(path):
    path.write_bytes(base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='))


def capture_document(state=STATE, **extra):
    return {'before': state, 'after': state,
            'files': {'pages.json': hashlib.sha256(json.dumps(model_readback()).encode()).hexdigest(),
                      'overview.json': hashlib.sha256(json.dumps(project_overview()).encode()).hexdigest()}, **extra}


def constraints(rule, evidence):
    items = rules_manifest.hard_constraints((rules_manifest.RESOURCE_ROOT / rule).read_text(encoding='utf-8'))
    return [{'constraint': text, 'verdict': 'pass', 'evidence': evidence} for text in items]


class RuleReviewTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        self.ledger_path = self.root / 'accept-reads.jsonl'
        card = rules({'pages': [plan()]}, '/selector', self.ledger_path, 'accept')
        project = project_rules(self.ledger_path, 'accept', plan={'pages': [plan()]})
        self.required = [read['rule'] for read in card['reads']]
        self.project = [read['rule'] for read in project['reads']]
        for read in card['reads'] + project['reads']:
            subprocess.run(read['args'], check=True, capture_output=True)
        self.screenshot = self.root / 'selector.png'
        write_image(self.screenshot)
        self.pages_path = self.root / 'pages.json'
        self.pages_path.write_text(json.dumps(model_readback()))
        self.overview_path = self.root / "overview.json"
        self.overview_path.write_text(json.dumps(project_overview()))

    def test_missing_windows_absolute_evidence_is_not_observed_prose(self):
        from verify_review import evidence_problem
        self.assertIn('do not exist', evidence_problem(r'C:\plasmic-missing-review-evidence\capture.webp'))
        self.assertIn('do not exist', evidence_problem('//missing-review-server/share/capture.webp'))

    def ledger(self):
        return [json.loads(line) for line in self.ledger_path.read_text().splitlines() if line.strip()]

    def verdict(self, rule):
        evidence = [str(self.screenshot), 'observed values']
        item = {'rule': rule, 'sha256': rule_digest(rule), 'verdict': 'pass', 'evidence': evidence}
        found = constraints(rule, evidence)
        return {**item, 'constraints': found} if found else item

    def review(self, **overrides):
        verdicts = [self.verdict(rule) for rule in self.required]
        for index, change in overrides.items():
            verdicts[int(index)] = {**verdicts[int(index)], **change} if change else None
        result = review_skeleton({'pages': [plan()]}, capture_document(), 'independent')
        result.update(reviewer='review-child-1', project={'rules': [self.verdict(rule) for rule in self.project]})
        result['pages'][0]['rules'] = [v for v in verdicts if v]
        resolve_visual_review(result['pages'][0], self.screenshot, STATE)
        return result

    def resolved_skeleton(self, mode='independent', root=None, page_path=None):
        review = review_skeleton(root or {'pages': [plan()]}, capture_document(), mode, page_path)
        review['reviewer' if mode == 'independent' else 'fallbackReason'] = (
            'review-child-1' if mode == 'independent' else 'No delegation tool')
        for scope in [review['project'], *review['pages']]:
            for item in scope['rules']:
                item.update(verdict='pass', evidence=[str(self.screenshot), 'Observed saved model values'])
                for constraint in item.get('constraints', []):
                    constraint.update(verdict='pass', evidence='Observed constraint-specific model values')
        for entry in review['pages']:
            resolve_visual_review(entry, self.screenshot, STATE)
        return review

    def test_complete_review_passes(self):
        self.assertEqual(sorted(self.required), sorted(set(self.required)))
        self.assertIn(CARD, self.required)
        self.assertIn('references/design/layout.md', self.project)
        result = check([plan()], self.ledger(), self.review(), STATE)
        self.assertTrue(result['passed'], result)
        self.assertEqual(result['reviewMode'], 'independent')

    def test_final_review_requires_saved_models_and_every_hidden_scene(self):
        review = self.review()
        missing_model = native_check([plan()], self.ledger(), review, STATE)
        self.assertFalse(missing_model['passed'])
        self.assertIn('Saved Page readbacks', json.dumps(missing_model['errors']))
        readback = model_readback()
        readback['results'][0]['baseVariantTplTree'] = (
            '<div id="condition" data-plasmic-name="ConditionalPanel" '
            'data-visible-if="{{ $state.allowed }}">Restricted details</div>')
        result = native_check([plan()], self.ledger(), review, STATE, readback=readback)
        self.assertFalse(result['passed'])
        self.assertIn('visibility:condition', json.dumps(result['errors']))
        skeleton = native_review_skeleton({'pages': [plan()]}, capture_document(),
                                          'independent', readback=readback, overview=project_overview())
        self.assertEqual({scene['state'] for scene in skeleton['pages'][0]['visualScenarios']},
                         {'default', 'visible', 'hidden'})

    def test_global_variant_discovery_requires_complete_project_overview(self):
        review = self.review()
        result = native_check([plan()], self.ledger(), review, STATE, readback=model_readback())
        self.assertFalse(result['passed'])
        self.assertIn('project overview', json.dumps(result['errors']))
        overview = project_overview()
        overview['results'][0]['globalVariantGroups'] = [
            {'__type': 'GlobalVariantGroup', 'uuid': 'theme', 'name': 'Theme',
             'variants': [{'__type': 'Variant', 'uuid': 'dark', 'name': 'Dark'}]}]
        result = check([plan()], self.ledger(), review, STATE, overview=overview)
        self.assertFalse(result['passed'])
        self.assertIn('dark', json.dumps(result['errors']))
        overview['results'][0].pop('screenBreakpoints')
        result = check([plan()], self.ledger(), review, STATE, overview=overview)
        self.assertFalse(result['passed'])
        self.assertIn('screenBreakpoints', json.dumps(result['errors']))

    def test_explicit_screen_projection_certifies_a_project_without_breakpoints(self):
        overview = project_overview()
        overview['results'][0].pop('screenBreakpoints')
        overview['read'] = {'fields': ['globalVariantGroups', 'screenBreakpoints']}
        result = check([plan()], self.ledger(), self.review(), STATE, overview=overview)
        self.assertTrue(result['passed'], result)
        overview['read']['fields'] = ['globalVariantGroups']
        result = check([plan()], self.ledger(), self.review(), STATE, overview=overview)
        self.assertFalse(result['passed'])

    def test_cli_rejects_changed_page_bytes_for_review_and_skeleton(self):
        for name, value in (('plan', {'pages': [plan()]}), ('capture', capture_document()),
                            ('review', self.review())):
            (self.root / (name + '.json')).write_text(json.dumps(value))
        changed = model_readback()
        changed['results'][0]['baseVariantTplTree'] = '<div>Changed after capture</div>'
        self.pages_path.write_text(json.dumps(changed))
        common = ['--capture', str(self.root / 'capture.json'), '--pages', str(self.pages_path), '--overview', str(self.overview_path)]
        commands = [
            [sys.executable, str(Path(__file__).with_name('verify_review.py')), str(self.root / 'plan.json'),
             '--ledger', str(self.ledger_path), '--review', str(self.root / 'review.json'), *common],
            [sys.executable, str(Path(__file__).with_name('prepare_plan.py')), 'review-skeleton',
             str(self.root / 'plan.json'), '--mode', 'independent', '--output', str(self.root / 'new-review.json'), *common],
        ]
        for command in commands:
            result = subprocess.run(command, capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('pages bytes differ', result.stdout + result.stderr)
        self.pages_path.write_text(json.dumps(model_readback()))
        self.overview_path.write_text(json.dumps({'results': []}))
        for command in commands:
            result = subprocess.run(command, capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('overview bytes differ', result.stdout + result.stderr)

    def test_review_cannot_be_reused_after_plan_changes_with_same_rules_and_model(self):
        changed = plan()
        changed['components'][0]['purpose'] = 'Read-only SQL, no editing actions'
        result = check([changed], self.ledger(), self.review(), STATE)
        self.assertFalse(result['passed'], result)
        self.assertTrue(any(error['check'] == 'checkedPlan' for error in result['errors']))

    def test_review_cannot_reuse_verdicts_from_other_rule_bytes(self):
        review = self.review()
        review['pages'][0]['rules'][0]['sha256'] = '0' * 64
        result = check([plan()], self.ledger(), review, STATE)
        self.assertFalse(result['passed'], result)
        self.assertTrue(any(error['check'] == 'reviewedRule' for error in result['errors']))

    def test_missing_unread_failed_or_unsupported_verdicts_fail(self):
        card = self.required.index(CARD)
        cases = {
            'missing verdict': (self.ledger(), self.review(**{'0': None})),
            'fail verdict': (self.ledger(), self.review(**{'0': {'verdict': 'fail', 'finding': 'extra-only Card header'}})),
            'pass without evidence': (self.ledger(), self.review(**{'0': {'evidence': []}})),
            'missing evidence file': (self.ledger(), self.review(**{'0': {'evidence': [str(self.root / 'absent.webp')]}})),
            'not applicable without reason': (self.ledger(), self.review(**{'0': {'verdict': 'notApplicable', 'evidence': None}})),
            'unknown verdict': (self.ledger(), self.review(**{'0': {'verdict': 'ok'}})),
            'missing constraint verdicts': (self.ledger(), self.review(**{str(card): {'constraints': []}})),
            'failed constraint': (self.ledger(), self.review(**{str(card): {'constraints': [
                {**constraints(CARD, 'ok')[0], 'verdict': 'fail', 'finding': 'Card wraps SearchForm'}] + constraints(CARD, 'ok')[1:]}})),
            'no accept reads': ([], self.review()),
            'no Page entry': (self.ledger(), {**self.review(), 'pages': []}),
            'no project verdicts': (self.ledger(), {**self.review(), 'project': None}),
        }
        for name, (ledger, review) in cases.items():
            with self.subTest(name=name):
                self.assertFalse(check([plan()], ledger, review, STATE)['passed'])
        finding = check([plan()], self.ledger(), self.review(**{'0': {'verdict': 'fail', 'finding': 'extra-only Card header'}}), STATE)
        self.assertEqual(finding['errors'][0]['check'], 'ruleFinding')
        self.assertEqual(finding['errors'][0]['finding'], 'extra-only Card header')

    def test_review_mode_and_checked_state_bind_the_review(self):
        for field, value in (('revision', 4), ('changeCounter', 1), ('sessionId', 'another-session')):
            with self.subTest(changed=field):
                stale = check([plan()], self.ledger(), self.review(), {**STATE, field: value})
                self.assertFalse(stale['passed'])
                self.assertIn('checkedState', json.dumps(stale['errors']))
        for change in ({'reviewMode': None}, {'reviewer': ''}, {'reviewMode': 'fallback'}, {'checkedState': None}):
            with self.subTest(change=change):
                self.assertFalse(check([plan()], self.ledger(), {**self.review(), **change}, STATE)['passed'])
        fallback = check([plan()], self.ledger(), {**self.review(), 'reviewMode': 'fallback', 'fallbackReason': 'No delegation tool'}, STATE)
        self.assertTrue(fallback['passed'], fallback)
        self.assertEqual(fallback['reviewMode'], 'fallback')

    def test_stale_reads_do_not_count(self):
        stale = [{**record, 'sha256': '0' * 64} for record in self.ledger()]
        result = check([plan()], stale, self.review(), STATE)
        self.assertFalse(result['passed'])
        self.assertTrue(all(error['check'] == 'acceptReads' for error in result['errors']))

    def test_skeleton_lists_every_rule_and_constraint_pending(self):
        capture = {'after': dict(STATE)}
        skeleton = review_skeleton({'pages': [plan()]}, capture, 'fallback')
        self.assertEqual(skeleton['checkedState'], STATE)
        self.assertEqual([r['rule'] for r in skeleton['project']['rules']], self.project)
        page_rules = skeleton['pages'][0]['rules']
        self.assertEqual([r['rule'] for r in page_rules], sorted(self.required))
        card = next(r for r in page_rules if r['rule'] == CARD)
        self.assertEqual(len(card['constraints']), len(constraints(CARD, 'x')))
        self.assertFalse(check([plan()], self.ledger(), skeleton, STATE)['passed'])

    def test_resolved_skeleton_supports_constraint_and_document_exemptions(self):
        for mode in ('independent', 'fallback'):
            review = self.resolved_skeleton(mode)
            card = next(item for item in review['pages'][0]['rules'] if item['rule'] == CARD)
            card['constraints'][0].update(verdict='notApplicable', reason='This Card has no header')
            with self.subTest(mode=mode, exemption='constraint'):
                result = check([plan()], self.ledger(), review, STATE)
                self.assertTrue(result['passed'], result)
            card.update(verdict='notApplicable', reason='The declared Card is in a state branch absent from this Page')
            card.pop('constraints')
            with self.subTest(mode=mode, exemption='document'):
                result = check([plan()], self.ledger(), review, STATE)
                self.assertTrue(result['passed'], result)

    def test_pending_values_anywhere_in_resolved_skeleton_fail(self):
        base = self.resolved_skeleton()
        card_index = next(index for index, item in enumerate(base['pages'][0]['rules']) if item['rule'] == CARD)
        card_path = ['pages', 0, 'rules', card_index]
        cases = [
            ('reviewer', ['reviewer']),
            ('evidence', card_path + ['evidence', 0]),
            ('constraint evidence', card_path + ['constraints', 0, 'evidence']),
            ('constraint text', card_path + ['constraints', 0, 'constraint']),
            ('checked state', ['checkedState', 'revision']),
        ]
        for name, path in cases:
            review = copy.deepcopy(base)
            item = review
            for key in path[:-1]:
                item = item[key]
            item[path[-1]] = rules_manifest.PENDING
            with self.subTest(name=name):
                result = check([plan()], self.ledger(), review, STATE)
                self.assertFalse(result['passed'], result)
                self.assertTrue(any('Replace every __DECIDE__' in error['message'] for error in result['errors']))
        for scope in ('document', 'constraint'):
            review = copy.deepcopy(base)
            item = review['pages'][0]['rules'][card_index]
            if scope == 'constraint':
                item = item['constraints'][0]
            item.update(verdict='notApplicable', reason=rules_manifest.PENDING)
            with self.subTest(reason=scope):
                self.assertFalse(check([plan()], self.ledger(), review, STATE)['passed'])
        fallback = self.resolved_skeleton('fallback')
        fallback['fallbackReason'] = rules_manifest.PENDING
        self.assertFalse(check([plan()], self.ledger(), fallback, STATE)['passed'])

    def test_document_exemption_does_not_hide_supplied_constraint_results(self):
        for verdict in ('fail', rules_manifest.PENDING):
            review = self.resolved_skeleton()
            card = next(item for item in review['pages'][0]['rules'] if item['rule'] == CARD)
            card.update(verdict='notApplicable', reason='Card not rendered in the inspected state')
            card['constraints'][0].update(verdict=verdict, finding='Card wraps SearchForm')
            with self.subTest(verdict=verdict):
                result = check([plan()], self.ledger(), review, STATE)
                self.assertFalse(result['passed'], result)
                if verdict == 'fail':
                    self.assertTrue(any(error['check'] == 'ruleFinding' and
                                        error.get('finding') == 'Card wraps SearchForm' for error in result['errors']))

    def test_duplicate_unknown_or_malformed_pages_fail(self):
        base = self.resolved_skeleton()
        for name, extra in (
            ('duplicate', copy.deepcopy(base['pages'][0])),
            ('unknown', {**base['pages'][0], 'path': '/unknown'}),
            ('missing path', {'rules': []}),
            ('invalid path type', {'path': [], 'rules': []}),
            ('invalid entry type', 'not a Page'),
        ):
            review = copy.deepcopy(base)
            review['pages'].append(extra)
            with self.subTest(name=name):
                self.assertFalse(check([plan()], self.ledger(), review, STATE)['passed'])
        failed = copy.deepcopy(base['pages'][0])
        failed['rules'][0].update(verdict='fail', finding='A real earlier finding')
        base['pages'].insert(0, failed)
        result = check([plan()], self.ledger(), base, STATE)
        self.assertFalse(result['passed'], result)
        self.assertTrue(any(error.get('finding') == 'A real earlier finding' for error in result['errors']))
        for value in (None, {}, 'not a list'):
            with self.subTest(pages=value):
                self.assertFalse(check([plan()], self.ledger(), {**self.resolved_skeleton(), 'pages': value}, STATE)['passed'])

    def test_duplicate_or_unknown_rules_fail_in_each_scope(self):
        for scope_name in ('project', 'page'):
            for name in ('duplicate', 'duplicate with anchor', 'unknown'):
                review = self.resolved_skeleton()
                scope = review['project'] if scope_name == 'project' else review['pages'][0]
                extra = copy.deepcopy(scope['rules'][0])
                if name == 'unknown':
                    extra['rule'] = 'references/unknown-rule.md'
                elif name == 'duplicate with anchor':
                    extra['rule'] += '#another-anchor'
                scope['rules'].append(extra)
                with self.subTest(scope=scope_name, name=name):
                    result = check([plan()], self.ledger(), review, STATE)
                    self.assertFalse(result['passed'], result)

    def test_scoped_review_allows_other_known_pages_in_same_file(self):
        review = self.resolved_skeleton()
        other = {**plan(), 'path': '/other'}
        review['pages'].append({**copy.deepcopy(review['pages'][0]), 'path': '/other'})
        review['checkedPlanSha256'] = plan_digest({'pages': [plan(), other]})
        result = check([plan()], self.ledger(), review, STATE, project=False, root={'pages': [plan(), other]})
        self.assertTrue(result['passed'], result)

    def test_scoped_skeleton_retains_shared_rules_without_sibling_placeholders(self):
        root = {'pages': [plan(), {'path': '/draft', 'pageStructure': '__DECIDE__'}]}
        for mode in ('independent', 'fallback'):
            with self.subTest(mode=mode):
                skeleton = review_skeleton(root, capture_document(pagePath='/selector'), mode, '/selector')
                self.assertEqual([p['path'] for p in skeleton['pages']], ['/selector'])
                self.assertEqual(skeleton['checkedPlanSha256'], plan_digest(root))
                self.assertIn('references/design/layout.md', [r['rule'] for r in skeleton['project']['rules']])
                review = self.resolved_skeleton(mode, root, '/selector')
                self.assertTrue(check([plan()], self.ledger(), review, STATE, root=root)['passed'])
                self.assertFalse(check(root['pages'], self.ledger(), review, STATE, root=root)['passed'])
        for route in (None, '/draft', '/missing'):
            with self.subTest(route=route), self.assertRaisesRegex(ValueError, 'scope'):
                review_skeleton(root, capture_document(pagePath='/selector'), 'independent', route)
        with self.assertRaisesRegex(ValueError, 'Exactly one'):
            review_skeleton(root, capture_document(), 'independent', '/missing')
        with self.assertRaisesRegex(ValueError, 'at least one'):
            review_skeleton({'pages': []}, capture_document(), 'independent')

    def test_single_page_cli_checks_shared_rules_and_capture_scope(self):
        root = {'pages': [plan(), {'path': '/draft'}]}
        for name, value in (('plan', root), ('capture', capture_document(pagePath='/selector'))):
            (self.root / (name + '.json')).write_text(json.dumps(value))
        review_path = self.root / 'scoped-review.json'
        prepare = subprocess.run([sys.executable, str(Path(__file__).with_name('prepare_plan.py')),
                                  'review-skeleton', str(self.root / 'plan.json'), '--page', '/selector',
                                  '--capture', str(self.root / 'capture.json'), '--pages', str(self.pages_path), '--overview', str(self.overview_path), '--mode', 'independent',
                                  '--output', str(review_path)], capture_output=True, text=True)
        self.assertEqual(prepare.returncode, 0, prepare.stderr)
        self.assertEqual([p['path'] for p in json.loads(review_path.read_text())['pages']], ['/selector'])
        command = [sys.executable, str(Path(__file__).with_name('verify_review.py')), str(self.root / 'plan.json'),
                   '--ledger', str(self.ledger_path), '--pages', str(self.pages_path), '--overview', str(self.overview_path), '--review', str(review_path),
                   '--capture', str(self.root / 'capture.json')]
        review = self.resolved_skeleton(root=root, page_path='/selector')
        review_path.write_text(json.dumps(review))
        run = subprocess.run(command + ['--page', '/selector'], capture_output=True, text=True)
        self.assertEqual(run.returncode, 0, run.stderr + run.stdout)
        full = subprocess.run(command, capture_output=True, text=True)
        self.assertNotEqual(full.returncode, 0)
        self.assertIn('scope', full.stderr)
        for failure in ('missing shared rules', 'failed shared rule', 'failed rule after fallback'):
            modified = copy.deepcopy(review)
            if failure == 'missing shared rules':
                modified.pop('project')
            else:
                modified['project']['rules'][0].update(verdict='fail', finding='Observed shared layout defect')
                if failure.endswith('fallback'):
                    modified.update(reviewMode='fallback', fallbackReason='Child lost tool access')
            review_path.write_text(json.dumps(modified))
            run = subprocess.run(command + ['--page', '/selector'], capture_output=True, text=True)
            with self.subTest(failure=failure):
                self.assertEqual(run.returncode, 1, run.stderr)
                self.assertFalse(json.loads(run.stdout)['passed'])

    def test_static_readiness_cannot_pass_final_review_with_pending_runtime(self):
        # Synthetic record test only; actual static readiness is recorded in the task
        # checkpoint, not a pass for a document that also requires real Preview.
        root = {'pages': [plan()]}
        review = self.resolved_skeleton(root=root, page_path='/selector')
        accessibility = next(item for item in review['project']['rules']
                             if item['rule'] == 'references/design/accessibility.md')
        accessibility.update(verdict=rules_manifest.PENDING, evidence=[])
        for mode in ('independent', 'fallback'):
            review.update(reviewMode=mode, fallbackReason='No delegation tools')
            result = check([plan()], self.ledger(), review, STATE, root=root)
            with self.subTest(mode=mode):
                self.assertFalse(result['passed'], result)
                pointer = '/project/rules/' + str(review['project']['rules'].index(accessibility))
                self.assertTrue(any(error.get('pointer') == pointer + '/verdict'
                                    and error['check'] == 'ruleReview' for error in result['errors']))

    def test_constraint_identity_must_match_current_document_in_order(self):
        for name in ('missing', 'unrelated', 'reordered', 'duplicated'):
            for verdict in ('pass', 'notApplicable'):
                review = self.resolved_skeleton()
                card = next(item for item in review['pages'][0]['rules'] if item['rule'] == CARD)
                card.update(verdict=verdict, reason='Card not rendered in the inspected state')
                entries = card['constraints']
                if name == 'missing':
                    entries[0].pop('constraint')
                elif name == 'unrelated':
                    entries[0]['constraint'] = 'Unrelated to this rule document'
                elif name == 'reordered':
                    entries[0], entries[1] = entries[1], entries[0]
                else:
                    entries[1] = copy.deepcopy(entries[0])
                with self.subTest(name=name, verdict=verdict):
                    result = check([plan()], self.ledger(), review, STATE)
                    self.assertFalse(result['passed'], result)
                    self.assertTrue(any('exact current constraint text' in error['message'] for error in result['errors']))

    def test_empty_review_scope_and_unknown_cli_page_fail(self):
        review = self.resolved_skeleton()
        for project in (False, True):
            with self.subTest(project=project):
                result = check([], self.ledger(), review, STATE, project=project, root={'pages': [plan()]})
                self.assertFalse(result['passed'], result)
                self.assertTrue(any('selected scope is empty' in error['message'] for error in result['errors']))
        inputs = {'plan': {'pages': [plan()]}, 'review': review, 'capture': capture_document()}
        for name, content in inputs.items():
            (self.root / f'{name}.json').write_text(json.dumps(content))
        cli = subprocess.run([sys.executable, str(Path(__file__).with_name('verify_review.py')),
                              str(self.root / 'plan.json'), '--ledger', str(self.ledger_path),
                              '--review', str(self.root / 'review.json'), '--pages', str(self.pages_path), '--overview', str(self.overview_path), '--capture', str(self.root / 'capture.json'),
                              '--page', '/not-in-plan'], capture_output=True, text=True)
        self.assertEqual(cli.returncode, 1, cli.stderr)
        self.assertFalse(json.loads(cli.stdout)['passed'])

    def test_explicit_capture_must_supply_a_valid_saved_state(self):
        (self.root / 'plan.json').write_text(json.dumps({'pages': [plan()]}))
        review = self.resolved_skeleton()
        (self.root / 'review.json').write_text(json.dumps(review))
        command = [sys.executable, str(Path(__file__).with_name('verify_review.py')),
                   str(self.root / 'plan.json'), '--ledger', str(self.ledger_path),
                   '--review', str(self.root / 'review.json'), '--pages', str(self.pages_path), '--overview', str(self.overview_path)]
        unbound = subprocess.run(command, capture_output=True, text=True)
        self.assertNotEqual(unbound.returncode, 0)
        self.assertIn('--capture', unbound.stderr)
        for state in (None, {}, {**STATE, 'projectId': ''}, {**STATE, 'branchId': 1},
                      {**STATE, 'revision': True}, {**STATE, 'revision': -1},
                      {**STATE, 'sessionId': ''}, {**STATE, 'changeCounter': True}, {**STATE, 'changeCounter': -1},
                      {key: value for key, value in STATE.items() if key != 'changeCounter'}):
            with self.subTest(state=state):
                (self.root / 'capture.json').write_text(json.dumps({'after': state}))
                cli = subprocess.run(command + ['--capture', str(self.root / 'capture.json')], capture_output=True, text=True)
                self.assertNotEqual(cli.returncode, 0)
                self.assertIn('valid after identity', cli.stderr)
                invalid_review = {**review, 'checkedState': state}
                self.assertFalse(check([plan()], self.ledger(), invalid_review)['passed'])
                with self.assertRaises(ValueError):
                    review_skeleton({'pages': [plan()]}, {'after': state}, 'independent')
        (self.root / 'capture.json').write_text('{}')
        self.assertNotEqual(subprocess.run(command + ['--capture', str(self.root / 'capture.json')], capture_output=True).returncode, 0)
        (self.root / 'capture.json').write_text(json.dumps(capture_document()))
        bound = subprocess.run(command + ['--capture', str(self.root / 'capture.json')], capture_output=True, text=True)
        self.assertEqual(bound.returncode, 0, bound.stderr)
        self.assertNotIn('no capture supplied', ' '.join(json.loads(bound.stdout)['notChecked']))


if __name__ == '__main__':
    unittest.main()
