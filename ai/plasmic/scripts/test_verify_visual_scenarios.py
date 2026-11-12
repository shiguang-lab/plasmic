import hashlib
import struct
import tempfile
import unittest
import zlib
from pathlib import Path

from verify_visual_scenarios import check, discover, skeleton


STATE = {'projectId': 'project', 'branchId': None, 'sessionId': 'session', 'revision': 4, 'changeCounter': 0}


class VisualScenarioTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.serial = 0
        self.plan = {'path': '/records'}
        self.project_model = None
        self.model = {'name': 'Records', 'variants': [], 'variantGroups': [], 'variantSettings': [],
                      'baseVariantTplTree': '<div id="Root" data-plasmic-name="Root"></div>'}

    def screenshot(self):
        self.serial += 1
        def chunk(kind, body):
            return struct.pack('>I', len(body)) + kind + body + struct.pack('>I', zlib.crc32(kind + body))
        data = (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 1, 1, 8, 2, 0, 0, 0))
                + chunk(b'tEXt', f'fixture\0{self.serial}'.encode())
                + chunk(b'IDAT', zlib.compress(b'\0\x00\x00\x00')) + chunk(b'IEND', b''))
        path = self.root / f'{self.serial}.png'
        path.write_bytes(data)
        return {'path': str(path), 'sha256': hashlib.sha256(data).hexdigest()}

    def attempt(self):
        return {'checkedState': dict(STATE), 'screenshot': self.screenshot(),
                'analysis': {'layout': 'Controls fit within the panel.', 'content': 'Required fields are visible.',
                             'controls': 'The close action is reachable.'}, 'issues': [], 'repairs': []}

    def review(self):
        declared = {scene['id']: scene for scene in self.plan.get('visualScenarios', [])}
        return {'sourceCoverage': {'sources': ['User request for records panel'], 'reviewed': True,
                                   'notes': 'Compared conditional entry and all panels with requirements.'},
                'visualScenarios': [{**scene, 'given': declared.get(scene['id'], {}).get('given', 'User has a permitted account.'),
                                     'steps': declared.get(scene['id'], {}).get('steps', ['Open the required state.']),
                                     'expected': declared.get(scene['id'], {}).get('expected', 'The target state is visible.'),
                                     'attempts': [self.attempt()]} for scene in discover(self.plan, self.model, self.project_model)]}

    def errors(self, review):
        return check(self.plan, review, self.model, STATE, self.project_model)

    def test_discovers_native_states_and_nested_panels(self):
        self.model.update(variants=[self.variant('base', 'Base'), self.variant('compact', 'Compact'),
                                    {'__type': 'ElementVariant', 'elementUuid': 'conditional',
                                     'variant': {'__type': 'Variant', 'uuid': 'hover', 'name': 'Hover'}}],
                          variantGroups=[{'uuid': 'group', 'name': 'Mode', 'multi': False,
                                          'variants': [{'__type': 'Variant', 'uuid': 'compact', 'name': 'Compact'}]}],
                          baseVariantTplTree='''<plasmic-component id="drawer" data-plasmic-name="Details"
                            data-plasmic-component="plasmic-antd6-drawer"><slot name="children">
                            <plasmic-component id="tab" data-plasmic-component="plasmic-antd6-tab-item">
                            <button id="conditional" data-visible-if="{{ $state.allowed }}">Edit</button>
                            <plasmic-component id="table" data-plasmic-component="plasmic-antd6-table">
                            <slot name="expandedRowRender"><div>Details</div></slot></plasmic-component>
                            </plasmic-component></slot></plasmic-component>''')
        scenes = {scene['id'] for scene in discover(self.plan, self.model)}
        self.assertEqual(scenes, {'default', 'variant:base:active', 'variant:compact:active', 'variant:hover:active',
                                 'overlay:drawer:open', 'overlay:drawer:closed', 'panel:tab:visible',
                                 'visibility:conditional:visible', 'visibility:conditional:hidden',
                                 'expansion:table:expanded', 'expansion:table:collapsed'})
        review = self.review()
        self.assertEqual(self.errors(review), [])
        review['visualScenarios'] = [s for s in review['visualScenarios'] if s['id'] != 'visibility:conditional:hidden']
        self.assertIn('no review record', str(self.errors(review)))

    @staticmethod
    def variant(uuid='compact', name='Compact'):
        return {'__type': 'ComponentVariant', 'type': 'single', 'group': 'Mode',
                'variant': {'__type': 'Variant', 'uuid': uuid, 'name': name}}

    def test_native_static_visibility_and_dynamic_attributes(self):
        self.model['baseVariantTplTree'] = '''<div id="hidden" data-visibility="notRendered"></div>
            <div id="display" data-visibility="displayNone"></div>
            <button id="conditional" disabled="{{ $state.readOnly }}"></button>
            <div id="dynamic" hidden="{{ $state.hidden }}"></div>'''
        scenes = {s['id'] for s in discover(self.plan, self.model)}
        self.assertEqual(scenes, {'default', 'visibility:hidden:hidden', 'visibility:display:hidden',
                                 'entry:conditional:disabled', 'entry:conditional:enabled',
                                 'visibility:dynamic:visible', 'visibility:dynamic:hidden'})

    def test_permanently_hidden_ancestor_suppresses_unreachable_panels(self):
        self.model['baseVariantTplTree'] = '''<div id="hidden" data-visibility="notRendered">
            <plasmic-component id="drawer" data-plasmic-component="plasmic-antd6-drawer">
            <plasmic-component id="tab" data-plasmic-component="plasmic-antd6-tab-item"></plasmic-component>
            </plasmic-component></div>'''
        self.assertEqual({s['id'] for s in discover(self.plan, self.model)}, {'default', 'visibility:hidden:hidden'})
        self.model['variants'] = [self.variant()]
        self.model['variantSettings'] = [{'__type': 'VariantOverride', 'variant': self.variant()['variant'],
                                         'elements': [{'__type': 'ElementOverride', 'uuid': 'drawer',
                                                       'attrs': {'data-visible-if': '{{ $state.allowed }}'}}]}]
        scenes = {s['id'] for s in discover(self.plan, self.model)}
        self.assertEqual(scenes, {'default', 'variant:compact:active', 'visibility:hidden:hidden'})
        self.model['variantSettings'][0]['elements'].append(
            {'__type': 'ElementOverride', 'uuid': 'hidden', 'attrs': {'data-visibility': 'visible'}})
        scenes = {s['id'] for s in discover(self.plan, self.model)}
        self.assertIn('overlay:compact/drawer:open', scenes)
        self.assertIn('panel:compact/tab:visible', scenes)
        self.assertIn('visibility:compact/drawer:hidden', scenes)
        self.assertEqual(self.errors(self.review()), [])

    def test_dynamic_ancestor_keeps_descendant_states(self):
        self.model['baseVariantTplTree'] = '''<div id="conditional" data-visible-if="{{ $state.allowed }}">
            <plasmic-component id="drawer" data-plasmic-component="plasmic-antd6-drawer"></plasmic-component></div>'''
        scenes = {s['id'] for s in discover(self.plan, self.model)}
        self.assertIn('visibility:conditional:hidden', scenes)
        self.assertIn('overlay:drawer:open', scenes)

    def test_variant_overrides_add_conditional_outcomes_and_resolve_styles(self):
        self.model['variants'] = [self.variant()]
        self.model['baseVariantTplTree'] = '''<div id="hidden" style="display:none" data-visibility="displayNone">
            <button id="button">Edit</button></div>'''
        self.model['variantSettings'] = [{'__type': 'VariantOverride', 'variant': self.variant()['variant'],
                                         'elements': [{'__type': 'ElementOverride', 'uuid': 'hidden',
                                                       'styles': {'display': 'block'}},
                                                      {'__type': 'ElementOverride', 'uuid': 'button',
                                                       'attrs': {'data-visible-if': '{{ $state.allowed }}',
                                                                 'disabled': '{{ $state.readOnly }}'}}]}]
        scenes = {s['id'] for s in discover(self.plan, self.model)}
        self.assertNotIn('visibility:compact/hidden:hidden', scenes)
        for scene in ('visibility:compact/button:visible', 'visibility:compact/button:hidden',
                      'entry:compact/button:disabled', 'entry:compact/button:enabled'):
            self.assertIn(scene, scenes)
        self.assertEqual(self.errors(self.review()), [])
        self.model['variantSettings'][0]['elements'][0]['attrs'] = []
        self.assertIn('ElementOverride', str(self.errors({})))

    def test_project_globals_and_breakpoints_are_required_without_duplicates(self):
        self.project_model = {
            'globalVariantGroups': [
                {'__type': 'GlobalVariantGroup', 'uuid': 'theme', 'name': 'Theme',
                 'variants': [{'__type': 'Variant', 'uuid': 'dark', 'name': 'Dark'}]},
                {'__type': 'GlobalVariantGroup', 'uuid': 'screen', 'name': 'Screen',
                 'variants': [{'__type': 'Variant', 'uuid': 'mobile', 'name': 'Mobile'}]}],
            'screenBreakpoints': [{'__type': 'ScreenBreakpoint', 'uuid': 'mobile', 'name': 'Mobile', 'maxWidth': 768}]}
        scenes = {s['id'] for s in discover(self.plan, self.model, self.project_model)}
        self.assertEqual(scenes, {'default', 'global-variant:dark:active', 'breakpoint:mobile:active'})
        self.assertEqual(len(skeleton(self.plan, self.model, self.project_model)), 3)
        review = self.review()
        self.assertEqual(self.errors(review), [])
        review['visualScenarios'] = review['visualScenarios'][:1]
        self.assertIn('no review record', str(self.errors(review)))
        self.project_model['globalVariantGroups'][0]['variants'] = [{}]
        self.assertIn('Global Variant', str(self.errors(review)))

    def test_bare_verdict_does_not_replace_screenshot_analysis(self):
        for verdict in ('pass', 'OK', '通过', '正常。'):
            review = self.review()
            review['visualScenarios'][0]['attempts'][0]['analysis']['layout'] = verdict
            self.assertIn('Analyze layout', str(self.errors(review)))

    def test_static_hidden_and_disabled_have_only_the_actual_state(self):
        self.model['baseVariantTplTree'] = '''<div id="hidden" style="display:none !important"></div>
            <plasmic-component id="disabled" data-props='{"disabled":true}'></plasmic-component>
            <plasmic-component id="dynamic" data-props='{"disabled":"{{ $state.busy }}"}'></plasmic-component>'''
        states = {s['id'] for s in discover(self.plan, self.model)}
        self.assertEqual(states, {'default', 'visibility:hidden:hidden', 'entry:disabled:disabled',
                                  'entry:dynamic:disabled', 'entry:dynamic:enabled'})

    def test_source_scenarios_are_required_and_skeleton_stays_pending(self):
        self.plan['visualScenarios'] = [{'id': 'failed-query', 'kind': 'source', 'nodeName': 'Results',
                                         'state': 'failure', 'given': 'Service rejects the query.',
                                         'steps': ['Submit query.'], 'expected': 'An error is shown.',
                                         'source': 'Requirement section Query failures'}]
        self.assertEqual(len(skeleton(self.plan, self.model)), 2)
        self.assertTrue(self.errors({'visualScenarios': skeleton(self.plan, self.model)}))
        self.assertEqual(self.errors(self.review()), [])
        draft = skeleton(self.plan, self.model)[1]
        self.assertEqual(draft['expected'], 'An error is shown.')
        review = self.review()
        review['visualScenarios'][1]['expected'] = 'No error is shown.'
        self.assertIn('source-planned', str(self.errors(review)))

    def test_target_cannot_be_relabelled_as_another_state(self):
        review = self.review()
        review['visualScenarios'][0]['state'] = 'hidden'
        self.assertIn('differs', str(self.errors(review)))

    def test_screenshot_bytes_hash_and_format_are_checked(self):
        for change in ('missing', 'hash', 'text'):
            with self.subTest(change=change):
                review = self.review()
                screenshot = review['visualScenarios'][0]['attempts'][0]['screenshot']
                if change == 'missing':
                    Path(screenshot['path']).unlink()
                elif change == 'hash':
                    screenshot['sha256'] = '0' * 64
                else:
                    data = b'This text is not a screenshot.'
                    Path(screenshot['path']).write_bytes(data)
                    screenshot['sha256'] = hashlib.sha256(data).hexdigest()
                self.assertTrue(self.errors(review))

    def test_stale_analysis_or_missing_dimensions_fail(self):
        for change in ('revision', 'project', 'analysis', 'source'):
            with self.subTest(change=change):
                review = self.review()
                attempt = review['visualScenarios'][0]['attempts'][0]
                if change == 'revision':
                    attempt['checkedState']['revision'] -= 1
                elif change == 'project':
                    attempt['checkedState']['projectId'] = 'other'
                elif change == 'analysis':
                    del attempt['analysis']['controls']
                else:
                    review['sourceCoverage']['reviewed'] = False
                self.assertTrue(self.errors(review))

    def test_issue_requires_repair_and_subsequent_fresh_analysis(self):
        review = self.review()
        first = review['visualScenarios'][0]['attempts'][0]
        first['checkedState']['revision'] = 3
        first['issues'] = [{'id': 'clipped', 'description': 'The Save button is clipped.'}]
        second = self.attempt()
        review['visualScenarios'][0]['attempts'].append(second)
        self.assertIn('recorded repair', str(self.errors(review)))
        first['repairs'] = [{'issueId': 'clipped', 'change': 'Corrected the panel width to fit the button.'}]
        self.assertEqual(self.errors(review), [])
        second['screenshot'] = first['screenshot']
        self.assertIn('Reused screenshot', str(self.errors(review)))

    def test_final_findings_and_repairs_without_retest_fail(self):
        review = self.review()
        final = review['visualScenarios'][0]['attempts'][0]
        final['issues'] = [{'id': 'clipped', 'description': 'The Save button is clipped.'}]
        final['repairs'] = [{'issueId': 'clipped', 'change': 'Corrected the width.'}]
        errors = str(self.errors(review))
        self.assertIn('unresolved', errors)
        self.assertIn('fresh screenshot', errors)

    def test_reused_image_across_different_scenarios_fails(self):
        self.model['baseVariantTplTree'] = '<div id="conditional" data-visible-if="{{ $state.allowed }}"></div>'
        review = self.review()
        review['visualScenarios'][1]['attempts'][0]['screenshot'] = review['visualScenarios'][0]['attempts'][0]['screenshot']
        self.assertIn('Reused screenshot', str(self.errors(review)))

    def test_same_pixels_in_distinct_capture_files_are_valid(self):
        self.model['baseVariantTplTree'] = '<div id="hidden" style="display:none"></div>'
        review = self.review()
        screenshot = review['visualScenarios'][0]['attempts'][0]['screenshot']
        another = self.root / 'separate-capture.png'
        another.write_bytes(Path(screenshot['path']).read_bytes())
        review['visualScenarios'][1]['attempts'][0]['screenshot'] = {**screenshot, 'path': str(another)}
        self.assertEqual(self.errors(review), [])

    def test_recurring_issue_needs_repair_after_latest_observation(self):
        review = self.review()
        first = review['visualScenarios'][0]['attempts'][0]
        first['issues'] = [{'id': 'clip', 'description': 'Button remains clipped.'}]
        first['repairs'] = [{'issueId': 'clip', 'change': 'Adjusted the first container.'}]
        second = self.attempt()
        second['issues'] = [{'id': 'clip', 'description': 'The nested container still clips the button.'}]
        review['visualScenarios'][0]['attempts'].extend([second, self.attempt()])
        self.assertIn('recorded repair', str(self.errors(review)))
        second['repairs'] = [{'issueId': 'clip', 'change': 'Corrected the nested container.'}]
        self.assertEqual(self.errors(review), [])

    def test_registered_popup_and_collapse_states_are_discovered(self):
        registrations = ['popover', 'popconfirm', 'dropdown', 'tooltip', 'collapse-item']
        self.model['baseVariantTplTree'] = ''.join(
            f'<plasmic-component id="{name}" data-plasmic-component="plasmic-antd6-{name}"></plasmic-component>'
            for name in registrations)
        scenes = {s['id'] for s in discover(self.plan, self.model)}
        for name in registrations[:-1]:
            self.assertIn(f'overlay:{name}:open', scenes)
            self.assertIn(f'overlay:{name}:closed', scenes)
        self.assertIn('panel:collapse-item:expanded', scenes)
        self.assertIn('panel:collapse-item:collapsed', scenes)

    def test_setup_needs_meaningful_string(self):
        for given in (1, True, [], {'role': '__DECIDE__'}, '__DECIDE__'):
            review = self.review()
            review['visualScenarios'][0]['given'] = given
            self.assertTrue(self.errors(review))

    def test_malformed_reviews_return_diagnostics(self):
        for value in (None, [], {}, {'visualScenarios': [None, [], {'id': []}]}):
            self.assertTrue(self.errors(value))
        for field in ('checkedState', 'screenshot', 'analysis', 'issues', 'repairs'):
            review = self.review()
            review['visualScenarios'][0]['attempts'][0][field] = []
            if field not in ('issues', 'repairs'):
                self.assertTrue(self.errors(review), field)
        review = self.review()
        review['visualScenarios'][0]['attempts'] = [None]
        self.assertTrue(self.errors(review))

    def test_duplicate_issue_and_unknown_repair_fail(self):
        review = self.review()
        first = review['visualScenarios'][0]['attempts'][0]
        first['issues'] = [{'id': 'clipped', 'description': 'Clipped button.'}] * 2
        first['repairs'] = [{'issueId': 'missing', 'change': 'Changed width.'}]
        errors = str(self.errors(review))
        self.assertIn('Duplicate finding', errors)
        self.assertIn('existing unrepaired', errors)

    def test_unreadable_model_cannot_silently_remove_scene_coverage(self):
        review = self.review()
        for model in ({}, {'baseVariantTplTree': '<div></div>'},
                      {**self.model, 'variants': [{'name': 'Unknown'}]},
                      {**self.model, 'baseVariantTplTree': '<div data-props="invalid"></div>'},
                      {**self.model, 'baseVariantTplTree': '<plasmic-node-ref id="unread"></plasmic-node-ref>'}):
            self.assertTrue(check(self.plan, review, model, STATE))
