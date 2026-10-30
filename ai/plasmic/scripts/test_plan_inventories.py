import json
import copy
import hashlib
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from plan_inventories import PENDING, descriptions_inventory, form_inventory, overlay_inventory, route_slug, slot_intent
from verify_slots import Tree, walk

HERE = Path(__file__).resolve().parent


def spec(name, component, owner=None, slot='children', **extra):
    value = {'nodeName': name, 'component': component, 'role': 'widget', **extra}
    if owner:
        value['owner'] = {'nodeName': owner, 'slot': slot}
    return value


def text(name, owner, slot, words):
    return ({'nodeName': name, 'tag': 'span', 'owner': {'nodeName': owner, 'slot': slot}},
            {'nodeName': name, 'at': '/text', 'text': words, 'kind': 'label'})


def page(components, texts=()):
    return {'path': '/records/new', 'components': components, 'nodes': [n for n, _ in texts],
            'copy': {'entries': [c for _, c in texts]}}


class FormInventoryTests(unittest.TestCase):
    def plan(self):
        components = [
            spec('Shell', 'plasmic-overseas-app-shell'),
            spec('FormCard', 'plasmic-antd6-card', 'Shell', header='none'),
            spec('RecordForm', 'plasmic-antd6-form', 'FormCard',
                 props={'layout': 'horizontal', 'labelCol': {'flex': '72px'}}),
            spec('Fields', 'plasmic-antd6-row', 'RecordForm', props={'gutter': 16}),
            spec('NameCol', 'plasmic-antd6-col', 'Fields', props={'span': 8}),
            spec('NameItem', 'plasmic-antd6-form-item', 'NameCol',
                 props={'name': 'name', 'rules': [{'ruleType': 'required'}]}),
            spec('NameInput', 'plasmic-antd6-input', 'NameItem'),
            spec('OwnerCol', 'plasmic-antd6-col', 'Fields', props={'span': 8}),
            spec('OwnerItem', 'plasmic-antd6-form-item', 'OwnerCol', props={'name': 'owner'}),
            spec('OwnerSelect', 'plasmic-antd6-select', 'OwnerItem'),
            spec('NoteCol', 'plasmic-antd6-col', 'Fields', props={'span': 24}),
            spec('NoteItem', 'plasmic-antd6-form-item', 'NoteCol', props={'name': 'note'}),
            spec('NoteInput', 'plasmic-antd6-textarea', 'NoteItem'),
            spec('FormActions', 'plasmic-antd6-form-item', 'RecordForm', props={'colon': False}),
            spec('Search', 'plasmic-antd6-input', 'Shell')]
        texts = [text('NameLabel', 'NameItem', 'label', '名称'), text('OwnerLabel', 'OwnerItem', 'label', '负责人'),
                 text('OwnerHelp', 'OwnerItem', 'tooltip', '负责处理该记录的人员'),
                 text('NoteLabel', 'NoteItem', 'label', '备注')]
        return {'pages': [page(components, texts)]}

    def test_fields_layout_and_pending_measurement_come_from_the_plan(self):
        form = form_inventory(self.plan())['pages'][0]['forms'][0]
        self.assertEqual(form['name'], 'RecordForm')
        self.assertEqual(form['formLayout'], 'horizontal')
        self.assertEqual(form['layout'], {'container': 'Fields', 'columns': 3, 'gutter': 16})
        self.assertEqual([f['nodeName'] for f in form['fields']], ['NameItem', 'OwnerItem', 'NoteItem'])
        name, owner, note = form['fields']
        self.assertEqual((name['label'], name['control'], name['rules']), ('名称', 'NameInput', [{'ruleType': 'required'}]))
        self.assertEqual(owner['tooltip'], '负责处理该记录的人员')
        self.assertEqual(owner['copyTriage'], 'perceive-on-demand')
        self.assertEqual(form['sourceCopyUnits'], [{'field': 'OwnerItem', 'text': '负责处理该记录的人员',
                                                   'decision': 'perceive-on-demand', 'source': PENDING}])
        self.assertEqual(note['span'], 3)
        self.assertNotIn('span', name)
        # The actions Item has no field name and is not a field.
        self.assertNotIn('FormActions', [f['nodeName'] for f in form['fields']])
        self.assertEqual(form['labelWidth'], {'longestLabel': '负责人', 'estimatedPx': 84, 'measuredPx': PENDING, 'measuredFrom': PENDING})

    def test_label_width_helper_gives_the_planning_label_col(self):
        from prepare_plan import label_widths
        result = label_widths(self.plan(), '/records/new')
        self.assertEqual(result['forms'], [{'form': 'RecordForm', 'longestLabel': '负责人', 'estimatedPx': 84, 'labelCol': {'flex': '84px'}}])
    def test_controls_outside_any_form_need_a_reviewed_reason(self):
        standalone = form_inventory(self.plan())['pages'][0]['standaloneControls']
        self.assertEqual(standalone, [{'nodeName': 'Search', 'reason': PENDING}])

    def test_undecided_field_name_and_rules_remain_pending(self):
        plan = self.plan()
        field = next(s for s in plan['pages'][0]['components'] if s['nodeName'] == 'NameItem')
        field['props'] = {'rules': PENDING}
        name = form_inventory(plan)['pages'][0]['forms'][0]['fields'][0]
        self.assertEqual(name['name'], PENDING)
        self.assertEqual(name['rules'], PENDING)

    def test_reviewed_form_and_field_metadata_survives_derivation(self):
        plan = self.plan()
        declarations = {s['nodeName']: s for s in plan['pages'][0]['components']}
        form_meta = {'layoutReason': {'kind': 'source', 'evidence': PENDING},
                     'columnsReason': {'kind': 'measurement', 'controlWidth': 400, 'columnWidth': 800},
                     'labelAlignReason': {'kind': 'source', 'evidence': PENDING},
                     'sourceCopyUnits': [{'field': 'OwnerItem', 'text': '负责处理该记录的人员',
                                          'decision': 'perceive-on-demand', 'source': PENDING}],
                     'labelWidth': {'longestLabel': '负责人', 'measuredPx': 84, 'measuredFrom': PENDING}}
        field_meta = {'copyTriage': 'perceive-on-demand', 'controlWidthReason': {'kind': 'source', 'evidence': PENDING}}
        declarations['RecordForm'].update(copy.deepcopy(form_meta))
        declarations['OwnerItem'].update(copy.deepcopy(field_meta))
        declarations['OwnerItem']['props']['validateFirst'] = False
        inventory = form_inventory(plan)['pages'][0]['forms'][0]
        for key, value in form_meta.items():
            self.assertEqual(inventory[key], value)
        for key, value in field_meta.items():
            self.assertEqual(inventory['fields'][1][key], value)
        self.assertIs(inventory['fields'][1]['validateFirst'], False)


class FormInventoryIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        source = self.root / 'requirement.md'
        source.write_text('负责人：负责处理该记录的人员', encoding='utf-8')
        self.source = {'path': str(source), 'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                       'quote': source.read_text(encoding='utf-8')}
        capture = self.root / 'layout.json'
        capture.write_text('{"frames":[{"elements":[{"elementUuid":"OwnerLabel","width":76}]}]}', encoding='utf-8')
        self.capture = {'path': str(capture), 'sha256': hashlib.sha256(capture.read_bytes()).hexdigest()}

    def plan(self):
        plan = FormInventoryTests().plan()
        declarations = plan['pages'][0]['components']
        declarations[:] = [s for s in declarations if s['nodeName'] != 'Search']
        form = next(s for s in declarations if s['nodeName'] == 'RecordForm')
        form['props'].update(mode='advanced', labelCol={'flex': '84px'})
        form['labelWidth'] = {'longestLabel': '负责人', 'measuredPx': 84, 'measuredFrom': self.capture}
        form['sourceCopyUnits'] = [{'field': 'OwnerItem', 'text': '负责处理该记录的人员',
                                    'decision': 'perceive-on-demand', 'source': self.source}]
        return plan

    def model(self, plan, inventory, overlay=None):
        from html import escape
        from prepare_plan import form_skeleton
        markup = form_skeleton(plan, inventory, '/records/new', 'RecordForm')
        end = markup.rindex('</slot></plasmic-component>')
        actions = ('<plasmic-component data-plasmic-name="FormActions" data-plasmic-component="plasmic-antd6-form-item" '
                   'data-props=\'{"colon":false}\'><slot name="label"><span> </span></slot><slot name="children">'
                   '<plasmic-component data-plasmic-name="Submit" data-plasmic-component="plasmic-antd6-button" '
                   'data-props=\'{"htmlType":"submit"}\'><slot name="children"><span>提交</span></slot>'
                   '</plasmic-component></slot></plasmic-component>')
        markup = markup[:end] + actions + markup[end:]
        if overlay:
            markup = (f'<plasmic-component data-plasmic-component="{overlay["component"]}" '
                      f'data-props="{escape(json.dumps(overlay["props"]), quote=True)}"><slot name="children">'
                      + markup + '</slot></plasmic-component>')
        page = {'uuid': 'page', 'type': 'page', 'pageMeta': {'path': '/records/new'}, 'baseVariantTplTree': markup}
        return {'results': [{'__type': 'Project', 'components': [page]}]}, {'results': [page]}

    def test_plan_inventory_and_recommended_actions_pass_the_real_gate(self):
        from verify_forms import check
        plan = self.plan()
        inventory = form_inventory(plan)
        overview, readback = self.model(plan, inventory)
        result = check(inventory, overview, readback)
        self.assertTrue(result['passed'], result)
        self.assertEqual(result['checkedFields'], 3)

    def test_form_skeleton_preserves_declared_names_and_control_slots(self):
        from prepare_plan import form_skeleton
        plan = self.plan()
        target = plan['pages'][0]
        target['components'].append(spec('OwnerOption', 'plasmic-antd6-option', 'OwnerSelect',
                                         props={'value': 'owner-1', 'disabled': False}))
        node, words = text('OwnerOptionLabel', 'OwnerOption', 'children', '张三')
        target['nodes'].append(node)
        target['copy']['entries'].append(words)
        markup = form_skeleton(plan, form_inventory(plan), '/records/new', 'RecordForm')
        tree = Tree(markup)
        names = [n['attrs'].get('data-plasmic-name') for n in walk(tree.root)]
        for name in ('NameCol', 'OwnerCol', 'NoteCol', 'NameLabel', 'OwnerLabel', 'OwnerHelp',
                     'NoteLabel', 'OwnerOption', 'OwnerOptionLabel'):
            self.assertEqual(names.count(name), 1, name)
        self.assertNotIn('NameCol2', names)
        self.assertIn('&quot;value&quot;:&quot;owner-1&quot;', markup)
        self.assertIn('张三', markup)

    def test_form_skeleton_rejects_inventory_span_drift(self):
        from prepare_plan import form_skeleton
        plan = self.plan()
        inventory = form_inventory(plan)
        inventory['pages'][0]['forms'][0]['fields'][0]['span'] = 3
        with self.assertRaisesRegex(ValueError, 'Planned span'):
            form_skeleton(plan, inventory, '/records/new', 'RecordForm')

    def test_form_skeleton_omits_unset_props_and_keeps_false_and_zero(self):
        from prepare_plan import form_skeleton
        plan = self.plan()
        declarations = {s['nodeName']: s for s in plan['pages'][0]['components']}
        declarations['OwnerSelect']['props'] = {'showSearch': None, 'allowClear': False, 'maxTagCount': 0}
        declarations['Fields']['props']['align'] = None
        declarations['OwnerCol']['props'].update(flex=None, offset=0)
        markup = form_skeleton(plan, form_inventory(plan), '/records/new', 'RecordForm')
        props = {n['attrs']['data-plasmic-name']: json.loads(n['attrs'].get('data-props', '{}'))
                 for n in walk(Tree(markup).root) if n['tag'] == 'plasmic-component'}
        self.assertEqual(props['OwnerSelect'], {'allowClear': False, 'maxTagCount': 0})
        self.assertNotIn('align', props['Fields'])
        self.assertEqual(props['OwnerCol'], {'span': 8, 'offset': 0})

    def test_missing_copy_evidence_is_pending_and_cannot_pass_the_gate(self):
        from verify_forms import check
        plan = self.plan()
        form = next(s for s in plan['pages'][0]['components'] if s['nodeName'] == 'RecordForm')
        del form['sourceCopyUnits']
        inventory = form_inventory(plan)
        self.assertEqual(inventory['pages'][0]['forms'][0]['sourceCopyUnits'][0]['source'], PENDING)
        overview, readback = self.model(plan, inventory)
        self.assertFalse(check(inventory, overview, readback)['passed'])

    def test_modal_width_and_drawer_native_size_reach_the_form_gate(self):
        from verify_forms import check
        cases = [('drawer', 'size', 640, 2, None), ('modal', 'width', 640, 2, None),
                 ('modal', 'width', 720, 2, None), ('modal', 'width', 880, 2, None),
                 ('modal', 'width', '80vw', 2, None), ('drawer', 'size', 640, 1, 'right'),
                 ('drawer', 'size', 900, 2, 'left'), ('drawer', 'size', 'default', 1, 'right'),
                 ('drawer', 'size', 'large', 2, 'right'), ('drawer', 'size', '70vw', 2, 'right'),
                 ('drawer', 'size', 'calc(100vw - 24px)', 2, 'right'), ('drawer', 'size', 240, 2, 'top')]
        for component, dimension, size, columns, placement in cases:
            with self.subTest(component=component, size=size, placement=placement):
                plan = self.plan()
                page = plan['pages'][0]
                page['components'][:] = [s for s in page['components'] if not s['nodeName'].startswith('Note')]
                page['nodes'][:] = [n for n in page['nodes'] if n['nodeName'] != 'NoteLabel']
                page['copy']['entries'][:] = [e for e in page['copy']['entries'] if e['nodeName'] != 'NoteLabel']
                form = next(s for s in page['components'] if s['nodeName'] == 'RecordForm')
                form['owner'] = {'nodeName': 'EditOverlay', 'slot': 'children'}
                form['props'].update(layout='vertical', labelCol=None)
                del form['labelWidth']
                for col in [s for s in page['components'] if s['component'] == 'plasmic-antd6-col']:
                    col['props']['span'] = 24 // columns
                overlay = spec('EditOverlay', 'plasmic-antd6-' + component, props={dimension: size})
                if placement:
                    overlay['props']['placement'] = placement
                page['components'].append(overlay)
                inventory = form_inventory(plan)
                layout = inventory['pages'][0]['forms'][0]['layout']
                self.assertEqual(layout['modalWidth' if component == 'modal' else 'drawerSize'], size)
                overview, readback = self.model(plan, inventory, overlay)
                result = check(inventory, overview, readback)
                self.assertTrue(result['passed'], result)
                wrong = {**overlay, 'props': {**overlay['props'], dimension: 960 if size != 960 else 880}}
                self.assertFalse(check(inventory, *self.model(plan, inventory, wrong))['passed'])
                inventory['pages'][0]['forms'][0]['sourceCopyUnits'][0]['source'] = {'path': '/missing', 'sha256': 'x', 'quote': 'x'}
                self.assertFalse(check(inventory, overview, readback)['passed'])


class DescriptionAndOverlayTests(unittest.TestCase):
    def test_native_items_exception_survives_derivation_outside_props(self):
        reason = {'kind': 'dynamic-fields', 'binding': '$ctx.query.fields',
                  'evidence': {'path': '/task/source.md', 'sha256': 'abc', 'quote': 'Fields come from the API'}}
        declaration = spec('BasicInfo', 'plasmic-antd6-descriptions', 'InfoCard',
                           props={'column': 3, 'items': '{{ $ctx.query.fields }}'}, itemsReason=reason)
        plan = {'pages': [page([spec('InfoCard', 'plasmic-antd6-card'), declaration])]}
        group = descriptions_inventory(plan)['pages'][0]['groups'][0]
        self.assertEqual(group['itemsReason'], reason)
        self.assertNotIn('itemsReason', declaration['props'])
        group['itemsReason']['evidence']['quote'] = 'changed'
        self.assertEqual(reason['evidence']['quote'], 'Fields come from the API')
        del declaration['itemsReason']
        self.assertEqual(descriptions_inventory(plan)['pages'][0]['groups'][0]['itemsReason'], PENDING)

    def test_description_column_evidence_survives_derivation(self):
        reason = {'kind': 'source', 'evidence': {'path': '/task/source.md', 'sha256': 'abc', 'quote': 'Use one column'}}
        components = [spec('InfoCard', 'plasmic-antd6-card'),
                      spec('BasicInfo', 'plasmic-antd6-descriptions', 'InfoCard', props={'column': 1}, columnReason=reason)]
        group = descriptions_inventory({'pages': [page(components)]})['pages'][0]['groups'][0]
        self.assertEqual(group['columnReason'], reason)
        group['columnReason']['evidence']['quote'] = 'changed'
        self.assertEqual(reason['evidence']['quote'], 'Use one column')

    def test_description_items_take_label_and_value_text_from_their_slots(self):
        components = [spec('InfoCard', 'plasmic-antd6-card'),
                      spec('BasicInfo', 'plasmic-antd6-descriptions', 'InfoCard', props={'column': 3}),
                      spec('IdItem', 'plasmic-antd6-descriptions-item', 'BasicInfo', props={'key': 'id'}),
                      spec('NoteItem', 'plasmic-antd6-descriptions-item', 'BasicInfo', props={'span': 3})]
        texts = [text('Title', 'BasicInfo', 'title', '基本信息'), text('IdLabel', 'IdItem', 'label', '编号'),
                 text('IdValue', 'IdItem', 'children', 'R1001'), text('NoteLabel', 'NoteItem', 'label', '说明')]
        group = descriptions_inventory({'pages': [page(components, texts)]})['pages'][0]['groups'][0]
        self.assertEqual((group['container'], group['title'], group['column']), ('InfoCard', '基本信息', 3))
        self.assertEqual(group['itemSlots'], [
            {'name': 'IdItem', 'key': 'id', 'label': '编号', 'children': 'R1001'},
            {'name': 'NoteItem', 'key': 'NoteItem', 'label': '说明', 'children': PENDING, 'span': 3}])

    def test_overlay_footers_and_effects(self):
        components = [spec('EditModal', 'plasmic-antd6-modal', props={'width': 720}),
                      spec('DetailDrawer', 'plasmic-antd6-drawer', props={'size': 640, 'closable': False}),
                      spec('Footer', 'plasmic-antd6-flex', 'DetailDrawer', slot='footer'),
                      spec('CloseButton', 'plasmic-antd6-button', 'Footer')]
        overlays = overlay_inventory({'pages': [page(components)]})['pages'][0]['overlays']
        modal, drawer = overlays
        self.assertEqual((modal['footer'], modal['closeIcon'], modal['width']), ('native', True, 720))
        self.assertEqual(modal['footerActions'], [{'name': 'nativeCancel', 'effect': 'dismiss'},
                                                  {'name': 'nativeOk', 'effect': PENDING}])
        self.assertEqual((drawer['footer'], drawer['closeIcon']), ('custom', False))
        self.assertEqual(drawer['size'], 640)
        self.assertNotIn('width', drawer)
        self.assertEqual(drawer['footerActions'], [{'name': 'CloseButton', 'effect': PENDING}])


class SlotIntentTests(unittest.TestCase):
    def test_intent_declares_owned_slots_and_cleared_card_headers(self):
        components = [spec('Shell', 'plasmic-overseas-app-shell'),
                      spec('ListCard', 'plasmic-antd6-card', 'Shell', header='none',
                           props={'styles': {'body': {'padding': '16px 20px 0'}}}),
                      spec('Results', 'plasmic-antd6-table', 'ListCard'),
                      spec('NameColumn', 'plasmic-antd6-table-column', 'Results')]
        texts = [text('NameTitle', 'NameColumn', 'title', '名称')]
        tree = Tree(slot_intent(page(components, texts))).root
        nodes = {n['attrs']['data-plasmic-name']: n for n in walk(tree) if n['tag'] == 'plasmic-component'}
        card_slots = {c['attrs']['name']: c for c in nodes['ListCard']['children'] if c['tag'] == 'slot'}
        self.assertEqual(sorted(card_slots), ['children', 'extra', 'title'])
        self.assertEqual(card_slots['title']['children'], [])
        self.assertIn('16px 20px 0', nodes['ListCard']['attrs']['data-props'])
        column_slots = [c['attrs']['name'] for c in nodes['NameColumn']['children'] if c['tag'] == 'slot']
        self.assertEqual(column_slots, ['title'])


class CommandTests(unittest.TestCase):
    def test_cli_writes_new_directory_with_suite_and_refuses_existing(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            plan = root / 'structure-expectation.json'
            plan.write_text(json.dumps(FormInventoryTests().plan()), encoding='utf-8')
            out = root / 'inventories'
            ledger = root / 'compose.jsonl'
            ledger.write_text('')
            command = [sys.executable, str(HERE / 'prepare_plan.py'), 'inventories', str(plan), '--reads', str(ledger), '--output-dir', str(out)]
            result = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            summary = json.loads(result.stdout)
            # measuredPx, measuredFrom, copy evidence and the standalone-control reason.
            self.assertEqual(summary['pendingDecisions']['forms-inventory.json'], 4)
            suite = json.loads((out / 'suite.json').read_text(encoding='utf-8'))
            self.assertEqual(suite['structure']['inventory'], '../structure-expectation.json')
            self.assertEqual(suite['structure']['reads'], '../compose.jsonl')
            self.assertEqual(suite['slots']['pages'], [{'path': '/records/new', 'intent': 'intents/%2Frecords%2Fnew.html'}])
            self.assertTrue((out / 'intents' / '%2Frecords%2Fnew.html').is_file())
            again = subprocess.run(command, capture_output=True, text=True)
            self.assertNotEqual(again.returncode, 0)

    def test_route_filenames_preserve_distinct_routes(self):
        from urllib.parse import unquote
        routes = ['/', '/root', '/a/b', '/a-b', '/订单', '/客户', '/a/[id]', '/a/%2F']
        filenames = [route_slug(route) for route in routes]
        self.assertEqual(len(set(filenames)), len(routes))
        self.assertEqual([unquote(name) for name in filenames], routes)
        self.assertTrue(all('/' not in name for name in filenames))


if __name__ == '__main__':
    unittest.main()
