#!/usr/bin/env python3
"""Inventory authored names/copy and compare them with source-reviewed intent.

No semantic approvals or names are generated from the output being checked.
"""
import argparse
import json
import re
from collections import Counter
from pathlib import Path

from verify_forms import TextTree, identity, node_name, props


UI_KEYS = {'title', 'label', 'text', 'description', 'help', 'tooltip', 'placeholder',
           'message', 'children', 'okText', 'cancelText', 'emptyText', 'notFoundContent',
           'checkedChildren', 'unCheckedChildren', 'addonBefore', 'addonAfter', 'extra',
           'caption', 'content', 'value', 'defaultValue'}
UI_COLLECTIONS = {'items', 'options', 'menuItems', 'menuItemsJson', 'rules'}
COPY_KINDS = {'label', 'placeholder', 'value', 'help', 'warning', 'feedback', 'action'}
COPY_ROLES = {'button', 'fieldLabel', 'columnTitle', 'placeholder', 'title', 'help', 'hint', 'value', 'other'}


def text(value):
    return isinstance(value, str) and bool(value.strip())


def normalized(value):
    # Binding source is exact; collapsing whitespace can change a JS string value.
    return value.strip() if '{{' in value else ' '.join(value.split())


def escape(key):
    return str(key).replace('~', '~0').replace('/', '~1')


def property_copy(value, path='', visible=False):
    if isinstance(value, str) and visible and value.strip():
        yield '/props' + path, value
    elif isinstance(value, list):
        for i, item in enumerate(value):
            yield from property_copy(item, path + '/' + str(i), visible)
    elif isinstance(value, dict):
        for key, item in value.items():
            # Configuration/data/event properties are not UI prose. Nested native
            # option/action/validation labels are, including hidden alternatives.
            ui = key in UI_KEYS or key.endswith(('Text', 'Title', 'Label', 'Placeholder', 'Description', 'Message', 'Tooltip', 'Caption'))
            if key in {'value', 'defaultValue'} and path:
                ui = False  # Option keys are not their displayed labels.
            if ui or key in UI_COLLECTIONS:
                yield from property_copy(item, path + '/' + escape(key), ui or isinstance(item, str))


def inventory(page, declarations=()):
    """Read-only candidates with real UUID, nearest component and native Slot."""
    records, copies = [], []
    extra = {d.get('nodeName'): d.get('copyProps', []) for d in declarations
             if isinstance(d, dict) and isinstance(d.get('copyProps', []), list)}

    def visit(node, owner=None, slot=None, readonly=False, target=None, location='/text'):
        attrs, tag = node.get('attrs', {}), node.get('tag')
        if readonly or attrs.get('data-editable') == 'false':
            return
        if tag == 'text':
            if text(node.get('text')):
                copies.append({'nodeName': target, 'at': location, 'text': node['text'],
                               'owner': owner, 'slot': slot})
            return
        if tag == 'slot':
            slot = attrs.get('name')
            location = '/slots/' + escape(slot) + '/text'
        elif tag != 'root':
            named = node_name(node)
            direct_text = any(c.get('tag') == 'text' and text(c.get('text')) for c in node.get('children', []))
            if attrs.get('id') or named or tag == 'plasmic-component' or direct_text:
                context = {'nodeName': owner, 'slot': slot} if owner else None
                record = {'nodeName': named, 'elementUuid': attrs.get('id'), 'tag': tag,
                          'owner': context, 'text': ''.join(c.get('text', '') for c in node.get('children', []) if c.get('tag') == 'text').strip()}
                if tag == 'plasmic-component':
                    record['component'] = identity(node)
                records.append(record)
                target, location = named, '/text'
            if tag == 'plasmic-component':
                values = props(node)
                found = dict(property_copy(values))
                for pointer in extra.get(named, []):
                    if not text(pointer) or not pointer.startswith('/'):
                        continue
                    value = values
                    try:
                        for part in pointer.strip('/').split('/'):
                            key = part.replace('~1', '/').replace('~0', '~')
                            value = value[int(key)] if isinstance(value, list) else value[key]
                    except (KeyError, IndexError, ValueError, TypeError):
                        continue  # A declared missing copy property fails readback coverage below.
                    if text(value):
                        found['/props' + pointer] = value
                copies.extend({'nodeName': named, 'at': pointer, 'text': value,
                               'owner': named, 'slot': None} for pointer, value in found.items())
                owner, slot = named, None
        for child in node.get('children', []):
            visit(child, owner, slot, False, target, location)

    visit(TextTree(page.get('baseVariantTplTree', '')).root)
    # A text location may contain several parser chunks (entities/inline syntax).
    grouped = {}
    for item in copies:
        key = (item['nodeName'], item['at'])
        if key in grouped:
            grouped[key]['text'] += item['text']
        else:
            grouped[key] = dict(item)
    return {'nodes': records, 'copy': list(grouped.values())}


def plan_errors(plan):
    errors = []

    def issue(pointer, message, **details):
        errors.append({'check': 'contentPlan', 'pointer': pointer, 'message': message, **details})

    supplemental = plan.get('nodes')
    if not isinstance(supplemental, list):
        issue('/nodes', 'Declare nodes:[] or source-reviewed names for authored layout, owned children and text nodes; functional components stay in components')
        supplemental = []
    components = plan.get('components')
    if not isinstance(components, list):
        issue('/components', 'Source-reviewed functional component inventory required')
        components = []
    declarations = [(f'/components/{i}', d) for i, d in enumerate(components)]
    declarations += [(f'/nodes/{i}', d) for i, d in enumerate(supplemental)]
    names = []
    for pointer, spec in declarations:
        if not isinstance(spec, dict):
            issue(pointer, 'Node declaration must be an object')
            continue
        name = spec.get('nodeName')
        names.append(name)
        if not text(name) or not re.fullmatch(r'[A-Z][A-Za-z0-9]*', name):
            issue(pointer + '/nodeName', 'Choose a concise semantic English PascalCase name before composition', node=name)
        if not all(text(spec.get(k)) for k in ('source', 'purpose')):
            issue(pointer, 'Name needs a source and actual owning business/content/layout purpose; ordinal renaming is not a review', node=name)
        if pointer.startswith('/nodes/'):
            if not text(spec.get('tag')) and not text(spec.get('component')):
                issue(pointer, 'Supplemental node needs its real tag or registered component identity', node=name)
            if 'owner' not in spec:
                issue(pointer + '/owner', 'Declare nearest component and native Slot, or null for a root/outside-component node', node=name)
        if spec.get('owner') is not None and (not isinstance(spec['owner'], dict) or not text(spec['owner'].get('nodeName')) or 'slot' not in spec['owner'] or not (spec['owner'].get('slot') is None or text(spec['owner'].get('slot')))):
            issue(pointer + '/owner', 'owner requires nodeName and native slot (null only outside a Slot)', node=name)
        if not isinstance(spec.get('copyProps', []), list) or any(not text(p) or not p.startswith('/') for p in spec.get('copyProps', [])):
            issue(pointer + '/copyProps', 'Additional contract-derived UI properties use JSON pointers relative to native props', node=name)
    for name, count in Counter(n for n in names if isinstance(n, str)).items():
        if count != 1:
            issue('/nodes', 'Each name belongs to exactly one declaration across components and nodes', node=name)
    component_names = {d.get('nodeName') for _, d in declarations if isinstance(d, dict) and text(d.get('component'))}
    for pointer, spec in declarations:
        if isinstance(spec, dict) and isinstance(spec.get('owner'), dict) and spec['owner'].get('nodeName') not in component_names:
            issue(pointer + '/owner', 'Owner must be a planned named component', node=spec.get('nodeName'))

    copy = plan.get('copy')
    if not isinstance(copy, dict) or not text(copy.get('source')) or not isinstance(copy.get('entries'), list) or not isinstance(copy.get('excluded'), list):
        issue('/copy', 'Source-reviewed copy requires source, entries and excluded arrays; empty entries never exempts actual UI text')
        return errors
    keys = []
    for i, spec in enumerate(copy['entries']):
        pointer = f'/copy/entries/{i}'
        if not isinstance(spec, dict) or not all(text(spec.get(k)) for k in ('nodeName', 'at', 'text', 'source', 'purpose', 'role')):
            issue(pointer, 'Every UI literal/binding needs a named location, exact text, role, source and user purpose')
            continue
        if spec.get('role') not in COPY_ROLES:
            issue(pointer + '/role', 'Declare the copy role so length and repetition budgets apply', allowedValues=sorted(COPY_ROLES))
        if spec['nodeName'] not in names:
            issue(pointer + '/nodeName', 'Copy owner must occur in components or nodes')
        if spec.get('kind') not in COPY_KINDS:
            issue(pointer + '/kind', 'Classify copy by the user decision/action it supports', allowedValues=sorted(COPY_KINDS))
        if not re.fullmatch(r'/(?:text|(?:props|slots)/.+)', spec['at']):
            issue(pointer + '/at', 'Use /text, /slots/<nativeSlot>/text or /props/<nativePropertyPath>')
        keys.append((spec['nodeName'], spec['at']))
    for key, count in Counter(keys).items():
        if count != 1:
            issue('/copy/entries', 'One review per exact copy location', node=key[0], at=key[1])
    for pointer, spec in declarations:
        if isinstance(spec, dict) and isinstance(spec.get('copyProps'), list):
            for prop in spec['copyProps']:
                if text(prop) and (spec.get('nodeName'), '/props' + prop) not in keys:
                    issue(pointer + '/copyProps', 'Each additional visible prop needs an exact copy entry', node=spec.get('nodeName'), at='/props' + prop)
    for i, spec in enumerate(copy['excluded']):
        if not isinstance(spec, dict) or not all(text(spec.get(k)) for k in ('text', 'source')):
            issue(f'/copy/excluded/{i}', 'Excluded requirement/process text needs its source')
    return errors


def check_page(plan, page):
    errors = plan_errors(plan)
    declarations = [d for key in ('components', 'nodes') for d in (plan.get(key) if isinstance(plan.get(key), list) else []) if isinstance(d, dict)]
    captured = inventory(page, declarations)
    expected = {d.get('nodeName'): d for d in declarations}
    counts = Counter(n['nodeName'] for n in captured['nodes'])
    for node in captured['nodes']:
        spec = expected.get(node['nodeName'])
        detail = {'check': 'namingCoverage', **node}
        if not spec:
            errors.append({**detail, 'message': 'Unreviewed authored node: name from its actual role/owner/Slot, then reconcile source intent; do not number diagnostics'})
            continue
        if 'owner' in spec and spec['owner'] != node['owner']:
            errors.append({**detail, 'expectedOwner': spec['owner'], 'message': 'Actual semantic owner/Slot differs from the naming plan'})
        if spec.get('tag', node['tag']) != node['tag'] or spec.get('component') and re.sub(r'[^a-z0-9]', '', spec['component'].lower()) != node.get('component'):
            errors.append({**detail, 'message': 'Name resolves to a different native node kind/identity'})
    for name in expected:
        if counts[name] != 1:
            errors.append({'check': 'namingCoverage', 'nodeName': name, 'count': counts[name], 'message': 'Every reviewed name must resolve to exactly one authored node'})
    review = plan.get('copy') if isinstance(plan.get('copy'), dict) else {}
    entries = {(s.get('nodeName'), s.get('at')): s for s in (review.get('entries') if isinstance(review.get('entries'), list) else [])
               if isinstance(s, dict) and text(s.get('nodeName')) and text(s.get('at'))}
    actual = {(s['nodeName'], s['at']): s for s in captured['copy']}
    for key, item in actual.items():
        spec = entries.get(key)
        if not spec or normalized(str(spec.get('text', ''))) != normalized(item['text']):
            errors.append({'check': 'copyCoverage', **item, 'expected': spec.get('text') if spec else None,
                           'message': 'Unreviewed or changed UI copy/binding; review its user purpose at this exact owner/location against the source'})
    for key, spec in entries.items():
        if key not in actual:
            errors.append({'check': 'copyCoverage', 'nodeName': key[0], 'at': key[1], 'message': 'Reviewed UI copy is missing or moved to a different native location'})
    for spec in review.get('excluded', []) if isinstance(review.get('excluded'), list) else []:
        if isinstance(spec, dict) and text(spec.get('text')):
            for item in captured['copy']:
                if normalized(spec['text']) in normalized(item['text']):
                    errors.append({'check': 'uiCopy', **item, 'message': 'Source-specific excluded requirement/process prose appears in UI'})
    return {'passed': not errors, 'errors': errors, 'inventory': captured,
            'notChecked': ['Natural-language name/source meaning', 'JS-produced copy and runtime data values', 'Inherited library defaults; inspect contracts and Preview']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('readback', type=Path)
    parser.add_argument('--expectation', type=Path)
    parser.add_argument('--page-path')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    pages = json.loads(args.readback.read_text())['results']
    plans = json.loads(args.expectation.read_text())['pages'] if args.expectation else []
    reports = []
    for page in pages:
        path = page.get('pageMeta', {}).get('path')
        if page.get('type') != 'page' or args.page_path and args.page_path != path:
            continue
        plan = next((p for p in plans if p.get('path') == path), {})
        result = check_page(plan, page) if args.expectation else {'inventory': inventory(page), 'reviewed': False}
        reports.append({'path': path, **result})
    report = {'pages': reports, 'reviewed': False}
    if args.expectation:
        # Matching reviewed intent is still a static check, not semantic approval.
        report['passed'] = bool(reports) and all(r.get('passed') is True for r in reports)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({**({'passed': report['passed']} if args.expectation else {'status': 'unreviewed-inventory'}),
                      'pages': len(reports), 'report': str(args.output)}))
    if args.expectation and not report['passed']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
