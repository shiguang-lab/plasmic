"""Discover visual states in public models and check recorded screenshot reviews.

Discovery covers explicit public variants, panels and visibility declarations.
Source review supplies business branches hidden inside expressions or opaque
components. Image integrity and recorded analysis do not prove visual judgement.
"""
import hashlib
import re
import struct
import zlib
from pathlib import Path

from verify_forms import TextTree, identity, node_name, props, slot
from verify_slots import walk

RULE = 'references/visual-scenarios.md'
STATE_KEYS = ('projectId', 'branchId', 'sessionId', 'revision', 'changeCounter')
PENDING = '__DECIDE__'


def text(value):
    return isinstance(value, str) and bool(value.strip()) and PENDING not in value


def analysis_text(value):
    return text(value) and value.strip().strip('.。!！').lower() not in {
        'pass', 'passed', 'ok', 'okay', 'good', 'n/a', 'none', '通过', '正常', '无问题', '没问题'}


def expression(value):
    return isinstance(value, str) and '{{' in value


def native_variants(model):
    """Read VariantDefJson wrappers and native VariantGroup identities."""
    definitions, groups = model.get('variants'), model.get('variantGroups')
    if not isinstance(definitions, list) or not isinstance(groups, list):
        raise ValueError('Saved model must explicitly include variants and variantGroups arrays')
    variants = {}

    def add(variant):
        if (not isinstance(variant, dict) or variant.get('__type') != 'Variant'
                or not text(variant.get('uuid')) or not text(variant.get('name'))):
            raise ValueError('Native variant identity needs __type:Variant, uuid and name')
        variants.setdefault(variant['uuid'], variant)

    for definition in definitions:
        if not isinstance(definition, dict):
            raise ValueError('Native variant definitions must be ComponentVariant or ElementVariant wrappers')
        kind = definition.get('__type')
        if kind == 'ComponentVariant':
            if definition.get('type') not in ('single', 'multi', 'boolean') or not text(definition.get('group')):
                raise ValueError('ComponentVariant requires its native group and type')
        elif kind == 'ElementVariant':
            if not text(definition.get('elementUuid')):
                raise ValueError('ElementVariant requires its owning elementUuid')
        else:
            raise ValueError('Native variant definitions must be ComponentVariant or ElementVariant wrappers')
        add(definition.get('variant'))
    for group in groups:
        if (not isinstance(group, dict) or not text(group.get('uuid')) or not text(group.get('name'))
                or type(group.get('multi')) is not bool or not isinstance(group.get('variants'), list)):
            raise ValueError('Native variant group requires uuid, name, multi and variants')
        for variant in group['variants']:
            add(variant)
    return list(variants.values())


def discover(page_plan, model, project_model=None):
    """Return stable descriptors from saved native identities and source cases."""
    page_plan = page_plan if isinstance(page_plan, dict) else {}
    model = model if isinstance(model, dict) else {}
    found = {'default': {'id': 'default', 'kind': 'default',
                         'nodeName': model.get('name') or page_plan.get('path', 'Page'), 'state': 'default'}}

    def add(key, kind, name, states):
        for state in states:
            scene_id = f'{kind}:{key}:{state}'
            found[scene_id] = {'id': scene_id, 'kind': kind, 'nodeName': name, 'state': state}

    def add_visibility(key, name, attrs, values):
        visibility = attrs.get('data-visible-if')
        hidden = values.get('hidden', attrs.get('hidden'))
        style = values.get('style', {})
        style = style if isinstance(style, dict) else {}
        inline = attrs.get('style') or ''
        dynamic_visibility = (expression(visibility) or expression(hidden)
                              or expression(values.get('style'))
                              or any(expression(style.get(k)) for k in ('display', 'visibility', 'opacity'))
                              or expression(inline))
        if dynamic_visibility:
            add(key, 'visibility', name, ['visible', 'hidden'])
        elif (visibility == 'false' or hidden is True or 'hidden' in attrs
              or attrs.get('data-visibility') in ('displayNone', 'notRendered')
              or style.get('display') == 'none' or style.get('visibility') in ('hidden', 'collapse')
              or style.get('opacity') in (0, '0')
              or re.search(r'(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|opacity\s*:\s*0)\s*(?:!important\s*)?(?:;|$)', inline)):
            add(key, 'visibility', name, ['hidden'])
            return True
        elif attrs.get('data-visibility') == 'visible':
            add(key, 'visibility', name, ['visible'])
        disabled = values.get('disabled', attrs.get('disabled'))
        if expression(disabled):
            add(key, 'entry', name, ['enabled', 'disabled'])
        elif values.get('disabled') is True or 'disabled' in attrs:
            add(key, 'entry', name, ['disabled'])
        return False

    variants = native_variants(model)
    variant_ids = {variant['uuid'] for variant in variants}
    for variant in variants:
        add(variant['uuid'], 'variant', variant.get('name') or variant['uuid'], ['active'])
    if project_model is not None:
        if (not isinstance(project_model, dict) or not isinstance(project_model.get('globalVariantGroups'), list)
                or not isinstance(project_model.get('screenBreakpoints'), list)):
            raise ValueError('Project visual discovery requires globalVariantGroups and screenBreakpoints arrays')
        breakpoint_ids = set()
        for breakpoint in project_model['screenBreakpoints']:
            if (not isinstance(breakpoint, dict) or breakpoint.get('__type') != 'ScreenBreakpoint'
                    or not text(breakpoint.get('uuid')) or not text(breakpoint.get('name'))):
                raise ValueError('ScreenBreakpoint needs its native UUID and name')
            breakpoint_ids.add(breakpoint['uuid'])
            add(breakpoint['uuid'], 'breakpoint', breakpoint['name'], ['active'])
        for group in project_model['globalVariantGroups']:
            if (not isinstance(group, dict) or group.get('__type') != 'GlobalVariantGroup'
                    or not text(group.get('uuid')) or not text(group.get('name'))
                    or not isinstance(group.get('variants'), list)):
                raise ValueError('GlobalVariantGroup needs its native UUID, name and variants')
            for variant in group['variants']:
                if (not isinstance(variant, dict) or variant.get('__type') != 'Variant'
                        or not text(variant.get('uuid')) or not text(variant.get('name'))):
                    raise ValueError('Global Variant needs its native UUID and name')
                if variant['uuid'] not in breakpoint_ids:
                    add(variant['uuid'], 'global-variant', variant['name'], ['active'])

    markup = model.get('baseVariantTplTree', '')
    root = TextTree(markup if isinstance(markup, str) else '').root
    nodes, base_reachable = {}, set()
    for index, node in enumerate(walk(root)):
        if node['tag'] in ('root', 'text', 'slot'):
            continue
        attrs = node['attrs']
        name = node_name(node) or attrs.get('id') or f'node-{index}'
        values = props(node)
        if not isinstance(values, dict):
            raise ValueError('Native data-props must be an object before visual discovery')
        nodes[id(node)] = (name, attrs, values)
    saved_ids = {attrs['id'] for _, attrs, _ in nodes.values() if attrs.get('id')}
    settings = model.get('variantSettings')
    if not isinstance(settings, list):
        raise ValueError('Native variantSettings must be an array')
    for setting in settings:
        if (not isinstance(setting, dict) or setting.get('__type') != 'VariantOverride'
                or not isinstance(setting.get('variant'), dict)
                or setting['variant'].get('__type') != 'Variant'
                or not text(setting['variant'].get('uuid')) or setting['variant']['uuid'] not in variant_ids
                or not isinstance(setting.get('elements'), list)):
            raise ValueError('Native VariantOverride needs a known variant identity and elements')
        for element in setting['elements']:
            if (not isinstance(element, dict) or element.get('__type') != 'ElementOverride'
                    or not text(element.get('uuid')) or element['uuid'] not in saved_ids
                    or not isinstance(element.get('attrs', {}), dict)
                    or not isinstance(element.get('styles', {}), dict)
                    or not all(isinstance(value, str) for value in element.get('attrs', {}).values())
                    or not all(isinstance(value, str) for value in element.get('styles', {}).values())):
                raise ValueError('Native ElementOverride needs a captured element UUID and readable attrs/styles')

    def merged_properties(attrs, values, override):
        attrs, values = dict(attrs), dict(values)
        changed_attrs = override.get('attrs', {})
        if any(key in changed_attrs for key in ('data-visible-if', 'data-visibility')):
            attrs.pop('data-visible-if', None)
            attrs.pop('data-visibility', None)
        attrs.update(changed_attrs)
        styles = override.get('styles', {})
        if styles:
            inline = dict(part.split(':', 1) for part in attrs.get('style', '').split(';') if ':' in part)
            inline = {key.strip(): value.strip() for key, value in inline.items()}
            inline.update(styles)
            attrs['style'] = ';'.join(f'{key}:{value}' for key, value in inline.items())
            values['style'] = {**(values.get('style') if isinstance(values.get('style'), dict) else {}), **styles}
            if 'display' in styles and attrs.get('data-visibility') == 'displayNone':
                attrs.pop('data-visibility')
        return attrs, values

    def visit(node, overrides, variant_id=None):
        if id(node) in nodes:
            name, attrs, values = nodes[id(node)]
            saved_id = attrs.get('id')
            key = saved_id or name
            override = overrides.get(saved_id, {})
            attrs, values = merged_properties(attrs, values, override)
            relevant = variant_id is None or bool(override) or id(node) not in base_reachable
            # Resolve reachability for each variant before emitting child states.
            # A permanently hidden ancestor is itself reviewed; its children cannot be entered.
            before = set(found)
            qualified_key = f'{variant_id}/{key}' if variant_id else key
            hidden = add_visibility(qualified_key, name, attrs, values)
            if not relevant:
                for scene_id in set(found) - before:
                    del found[scene_id]
            if variant_id is None:
                base_reachable.add(id(node))
            if hidden:
                return
            if relevant:
                component = identity(node)
                if component in ('plasmicantd6tabitem', 'plasmicantd5tabitem'):
                    add(qualified_key, 'panel', name, ['visible'])
                if component in ('plasmicantd6collapseitem', 'plasmicantd5collapseitem', 'plasmicantd5singlecollapse'):
                    add(qualified_key, 'panel', name, ['expanded', 'collapsed'])
                if component in ('plasmicantd6modal', 'plasmicantd6drawer', 'plasmicantd5modal', 'plasmicantd5drawer',
                                 'plasmicantd6popover', 'plasmicantd6popconfirm', 'plasmicantd6dropdown', 'plasmicantd6tooltip',
                                 'plasmicantd5popover', 'plasmicantd5dropdown', 'plasmicantd5tooltip'):
                    add(qualified_key, 'overlay', name, ['open', 'closed'])
                elif 'open' in values and expression(values['open']):
                    add(qualified_key, 'entry', name, ['open', 'closed'])
                expanded = slot(node, 'expandedRowRender')
                if expanded is not None and expanded['children']:
                    add(qualified_key, 'expansion', name, ['expanded', 'collapsed'])
        for child in node['children']:
            visit(child, overrides, variant_id)

    visit(root, {})
    for setting in settings:
        visit(root, {element['uuid']: element for element in setting['elements']}, setting['variant']['uuid'])
    declared = page_plan.get('visualScenarios', [])
    for scene in declared if isinstance(declared, list) else []:
        if isinstance(scene, dict) and text(scene.get('id')) and scene['id'] not in found:
            found[scene['id']] = {field: scene.get(field) for field in ('id', 'kind', 'nodeName', 'state')}
    return list(found.values())


def skeleton(page_plan, model, project_model=None):
    declared = page_plan.get('visualScenarios', [])
    if not isinstance(declared, list):
        raise ValueError('Planned visualScenarios must be an array')
    by_id = {scene['id']: scene for scene in declared if isinstance(scene, dict) and text(scene.get('id'))}
    return [{**scene, **{key: by_id.get(scene['id'], {}).get(key, default)
                        for key, default in (('given', PENDING), ('steps', [PENDING]), ('expected', PENDING))},
             'attempts': []} for scene in discover(page_plan, model, project_model)]


def valid_state(state):
    return (isinstance(state, dict) and set(state) == set(STATE_KEYS)
            and text(state.get('projectId')) and text(state.get('sessionId'))
            and (state.get('branchId') is None or text(state.get('branchId')))
            and all(type(state.get(k)) is int and state[k] >= 0 for k in ('revision', 'changeCounter')))


def image_bytes_valid(data):
    """Validate image containers without adding a runtime imaging dependency."""
    if data.startswith(b'\x89PNG\r\n\x1a\n'):
        offset, types = 8, []
        while offset + 12 <= len(data):
            length = int.from_bytes(data[offset:offset + 4], 'big')
            end = offset + 12 + length
            if end > len(data):
                return False
            kind, body = data[offset + 4:offset + 8], data[offset + 8:end - 4]
            if zlib.crc32(kind + body) != int.from_bytes(data[end - 4:end], 'big'):
                return False
            if not types and (kind != b'IHDR' or length != 13 or not all(struct.unpack('>II', body[:8]))):
                return False
            types.append(kind)
            offset = end
            if kind == b'IEND':
                return offset == len(data) and b'IDAT' in types
        return False
    if data.startswith(b'RIFF') and data[8:12] == b'WEBP':
        return (len(data) > 20 and int.from_bytes(data[4:8], 'little') + 8 == len(data)
                and data[12:16] in (b'VP8 ', b'VP8L', b'VP8X'))
    return len(data) > 20 and data.startswith(b'\xff\xd8\xff') and data.endswith(b'\xff\xd9')


def verified_screenshot_path(screenshot):
    if not isinstance(screenshot, dict) or not text(screenshot.get('path')):
        raise ValueError('Screenshot needs an absolute image path and sha256')
    path = Path(screenshot['path'])
    if not path.is_absolute() or not path.is_file():
        raise ValueError('Screenshot must be an existing absolute file')
    data = path.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if screenshot.get('sha256') != digest:
        raise ValueError('Screenshot bytes changed or sha256 is missing')
    if not image_bytes_valid(data):
        raise ValueError('Screenshot must contain a valid PNG, JPEG or WebP image container')
    return str(path.resolve())


def check(page_plan, page_review, model, checked_state, project_model=None):
    errors = []

    def issue(message, scene_id=None):
        errors.append({'check': 'visualScenarios', 'rule': RULE, 'page': page_plan.get('path'),
                       'scenario': scene_id, 'message': message})

    page_plan = page_plan if isinstance(page_plan, dict) else {}
    page_review = page_review if isinstance(page_review, dict) else {}
    if not valid_state(checked_state):
        issue('A valid current checkedState is required')
        return errors
    if not isinstance(model, dict) or not text(model.get('baseVariantTplTree')):
        issue('A complete saved Page model with baseVariantTplTree is required')
        return errors
    try:
        native_variants(model)
    except ValueError as error:
        issue(str(error))
    if '<plasmic-node-ref' in model['baseVariantTplTree']:
        issue('Resolve truncated node references before discovering visual scenarios')
    for node in walk(TextTree(model['baseVariantTplTree']).root):
        try:
            values = props(node)
            if not isinstance(values, dict):
                issue('Native data-props must be an object before visual discovery')
        except (ValueError, TypeError):
            issue('Unreadable native data-props can hide conditional visual scenarios')
    coverage = page_review.get('sourceCoverage')
    if (not isinstance(coverage, dict) or coverage.get('reviewed') is not True
            or not isinstance(coverage.get('sources'), list) or not coverage['sources']
            or not all(text(source) for source in coverage['sources']) or not text(coverage.get('notes'))):
        issue('Record sourceCoverage with reviewed:true, source citations and notes reconciling source branches with the model')
    declared = page_plan.get('visualScenarios', [])
    if not isinstance(declared, list):
        issue('Planned visualScenarios must be an array')
        declared = []
    declared_ids = set()
    for scene in declared:
        if (not isinstance(scene, dict) or not all(text(scene.get(k)) for k in ('id', 'kind', 'nodeName', 'state', 'expected', 'source'))
                or not text(scene.get('given')) or not isinstance(scene.get('steps'), list) or not scene['steps']
                or not all(text(step) for step in scene['steps'])):
            issue('Each source scenario needs id/kind/nodeName/state, given, steps, expected and source')
            continue
        if scene['id'] in declared_ids:
            issue('Duplicate planned scenario ID', scene['id'])
        declared_ids.add(scene['id'])
    try:
        expected = {scene['id']: scene for scene in discover(page_plan, model, project_model)}
    except (ValueError, TypeError) as error:
        issue(f'Cannot discover visual scenarios from the saved model: {error}')
        return errors
    planned = {scene['id']: scene for scene in declared if isinstance(scene, dict) and text(scene.get('id'))}
    records = page_review.get('visualScenarios')
    if not isinstance(records, list):
        issue('Record visualScenarios for every discovered and source-planned state')
        return errors
    seen, screenshot_paths = set(), set()
    for record in records:
        scene_id = record.get('id') if isinstance(record, dict) else None
        if not isinstance(scene_id, str) or scene_id not in expected or scene_id in seen:
            issue('Unknown, malformed or duplicate visual scenario', scene_id if isinstance(scene_id, str) else None)
            continue
        seen.add(scene_id)
        if any(record.get(key) != expected[scene_id][key] for key in ('kind', 'nodeName', 'state')):
            issue('Scenario target/kind/state differs from the discovered or planned scene', scene_id)
        if (not text(record.get('given')) or not text(record.get('expected'))
                or not isinstance(record.get('steps'), list) or not record['steps']
                or not all(text(step) for step in record['steps'])):
            issue('Scenario needs actual preconditions, entry steps and expected visual result', scene_id)
        if scene_id in planned and any(record.get(key) != planned[scene_id].get(key) for key in ('given', 'steps', 'expected')):
            issue('Retain the source-planned setup, steps and expected result in the review', scene_id)
        attempts = record.get('attempts')
        if not isinstance(attempts, list) or not attempts:
            issue('Scenario has no screenshot analysis attempt', scene_id)
            continue
        findings, repaired = {}, {}
        previous = None
        for index, attempt in enumerate(attempts):
            if not isinstance(attempt, dict):
                issue('Malformed screenshot analysis attempt', scene_id)
                continue
            state = attempt.get('checkedState')
            if (not valid_state(state) or any(state.get(k) != checked_state[k] for k in ('projectId', 'branchId'))):
                issue('Screenshot attempt belongs to an invalid or different project/branch state', scene_id)
            else:
                order = (state['revision'], state['changeCounter'])
                if previous is not None and order < previous:
                    issue('Screenshot attempts must follow model revision/changeCounter order', scene_id)
                previous = order
            if index == len(attempts) - 1 and state != checked_state:
                issue('Final screenshot analysis must match the current checkedState', scene_id)
            try:
                screenshot_path = verified_screenshot_path(attempt.get('screenshot'))
                if screenshot_path in screenshot_paths:
                    issue('Reused screenshot cannot prove a distinct state or repair recheck', scene_id)
                screenshot_paths.add(screenshot_path)
            except (ValueError, OSError, TypeError) as error:
                issue(str(error), scene_id)
            analysis = attempt.get('analysis')
            if not isinstance(analysis, dict) or not all(analysis_text(analysis.get(k)) for k in ('layout', 'content', 'controls')):
                issue('Analyze layout, content and controls for this screenshot', scene_id)
            issues, repairs = attempt.get('issues'), attempt.get('repairs')
            if not isinstance(issues, list) or not isinstance(repairs, list):
                issue('Every attempt needs explicit issues and repairs arrays', scene_id)
                continue
            observed_ids = set()
            for finding in issues:
                if not isinstance(finding, dict) or not text(finding.get('id')) or not text(finding.get('description')):
                    issue('Every finding needs an ID and concrete description', scene_id)
                elif finding['id'] in observed_ids:
                    issue('Duplicate finding ID', scene_id)
                else:
                    observed_ids.add(finding['id'])
                    findings[finding['id']] = index
                    repaired.pop(finding['id'], None)
            for repair in repairs:
                if (not isinstance(repair, dict) or not text(repair.get('issueId')) or not text(repair.get('change'))
                        or repair['issueId'] not in findings or repair['issueId'] in repaired):
                    issue('Repair must describe a change for one existing unrepaired finding', scene_id)
                else:
                    repaired[repair['issueId']] = index
            if index == len(attempts) - 1 and issues:
                issue('Final screenshot still has unresolved findings', scene_id)
        for finding in findings:
            if finding not in repaired or repaired[finding] >= len(attempts) - 1:
                issue('Every finding needs a recorded repair followed by a fresh screenshot analysis', scene_id)
    for scene_id in sorted(set(expected) - seen):
        issue('Discovered or source-planned visual scenario has no review record', scene_id)
    return errors
