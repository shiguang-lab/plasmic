#!/usr/bin/env python3
"""Check source-declared semantic roles, coverage and feedback wiring.

Does not infer business meaning from labels, execute JS or certify Preview.
Uses the existing structure inventory, not a second component prop model.
"""
import argparse
import hashlib
import json
import re
from collections import Counter
from pathlib import Path
from verify_forms import TextTree, walk, identity, node_name, props, slot, content
import verify_component_policy
import verify_templates
import verify_content
import rules_manifest


def norm(value):
    return re.sub(r'[^a-z0-9]', '', value.lower())


ADMIN_LIBRARIES = {'antd_v6', 'overseas', 'react_ui'}


def rule_matches_library(component, rule):
    library = rules_manifest.library_for(component)
    path = rule.split('#', 1)[0]
    if library and path in {SCALE, PAGE_TYPE_RULE.split('#', 1)[0]}:
        return library in ADMIN_LIBRARIES
    parts = path.split('/')
    if not library or len(parts) < 4 or parts[:2] != ['references', 'libraries']:
        return True
    return parts[2] == library or {library, parts[2]} <= ADMIN_LIBRARIES


# Scope: the existing Overseas / Antd6 full-project suite.
ROLE_COMPONENTS = {
    'shell': {'plasmic-overseas-app-shell'},
    'query': {'plasmic-overseas-search-form'},
    'submitted-form': {'plasmic-antd6-form'},
    'read-only-group': {'plasmic-antd6-descriptions'},
    'data-table': {'plasmic-antd6-table'},
    'content-scope': {'plasmic-antd6-tabs'},
    'field-choice': {'plasmic-antd6-radio-group', 'plasmic-antd6-segmented', 'plasmic-antd6-select', 'plasmic-antd6-checkbox-group'},
    'status': {'plasmic-antd6-badge', 'plasmic-antd6-table-column'},
    'count': {'plasmic-antd6-badge'},
    'category': {'plasmic-antd6-tag', 'plasmic-antd6-table-column'},
    'row-actions': {'plasmic-react-ui-action-group'},
    'pagination': {'plasmic-antd6-table', 'plasmic-antd6-pagination'},
    'persistent-feedback': {'plasmic-antd6-alert'},
    'empty-content': {'plasmic-antd6-empty'},
    'loading': {'plasmic-antd6-spin', 'plasmic-antd6-skeleton'},
    'page-result': {'plasmic-antd6-result'},
    'confirmation': {'plasmic-antd6-popconfirm', 'plasmic-antd6-modal'},
    'overlay-form': {'plasmic-antd6-modal', 'plasmic-antd6-drawer'},
    'overlay-information': {'plasmic-antd6-modal', 'plasmic-antd6-drawer'},
    'surface': {'plasmic-antd6-card'},
    'help': {'plasmic-antd6-tooltip', 'plasmic-antd6-popover'},
    'action-menu': {'plasmic-antd6-dropdown'},
    'navigation': {'plasmic-antd6-menu', 'plasmic-antd6-breadcrumb'},
    'workflow-progress': {'plasmic-antd6-steps'},
}
ROLES = {role: {norm(key) for key in keys} for role, keys in ROLE_COMPONENTS.items()}
CONSTRAINED = set().union(*ROLES.values()) - {'plasmicantd6tablecolumn'}
# Child contracts are checked with their owning Form/Descriptions/Tabs/Table etc.
OWNED_CHILDREN = {norm('plasmic-antd6-' + name) for name in (
    'form-item', 'form-list', 'descriptions-item', 'tab-item', 'table-column-group',
    'menu-item', 'menu-item-group', 'submenu', 'breadcrumb-item', 'step',
    'radio', 'checkbox', 'select-option', 'select-option-group')}
OWNED_CHILDREN.add('plasmicoverseassearchformitem')
LAYOUT = {norm('plasmic-antd6-' + name) for name in ('flex', 'row', 'col', 'space', 'divider')}
FEEDBACK_CONTEXT = 'plasmic-antd6-config-provider'
# Recognize the documented literal-key call without treating strings/comments as
# executable wiring. This is lexical evidence only, not a JS/runtime proof.
PROVIDER_CALL = re.compile(r'''//[^\r\n]*|/\*[\s\S]*?\*/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|(?<![\w$.])\$globalActions\s*\[\s*(?P<quote>["'])(?P<action>plasmic-antd6-config-provider\.(?:showMessage|showNotification))(?P=quote)\s*\]\s*\(''')


# Column presentation is a plan field, not a native prop: text leaves the native
# render Slot empty (Ant Design shows the value); custom composes registered
# components such as Tag/Badge/link/avatar in Column.render.
COLUMN_PRESENTATIONS = ('text', 'custom')
RETIRED_COLUMN_PROPS = ('displayType',)
BADGE_STATUSES = ('success', 'processing', 'default', 'error', 'warning')
STATE_LIKE = 'State-like Column must use role:status with a Badge render, or record nonStatusReason'


def state_like(data_index, title):
    """Lexical hint only: a status/state/状态 field name or title."""
    if isinstance(data_index, list):
        data_index = data_index[-1] if data_index else None
    for value in (data_index, title):
        if not isinstance(value, str):
            continue
        if '状态' in value:
            return True
        words = re.sub(r'([A-Z]+)([A-Z][a-z])', r'\1 \2', re.sub(r'([a-z0-9])([A-Z])', r'\1 \2', value))
        if {'status', 'state'} & {token.lower() for token in re.split(r'[^A-Za-z0-9]+', words) if token}:
            return True
    return False


def status_badge_errors(values, in_column, planned=False):
    """Status Badge uses only the installed official preset props: status + text.

    A per-row status column maps the row value inside the binding expression and
    records that mapping on the Column declaration; registered components never
    gain non-official props such as value/options.
    """
    errors = [f'Status Badge must not set {key}; the status preset provides the color'
              for key in ('color', 'dot', 'count') if values.get(key) is not None]
    extended = [key for key in ('value', 'options') if values.get(key) is not None]
    if extended:
        errors.append('Status Badge props must match the installed official contract; '
                      f'{", ".join(extended)} is not an official prop — map the row value inside the status/text expression')
    status, text = values.get('status'), values.get('text')
    if in_column:
        if planned:
            return errors
        if not isinstance(status, str) or '{{' not in status:
            errors.append('Status Badge in a Table Column must bind status to a row expression, e.g. {{ row.state === "ACTIVE" ? "success" : "default" }}; a literal status gives every row the same color')
        if not isinstance(text, str) or '{{' not in text:
            errors.append('Status Badge in a Table Column must bind text to the row label expression')
    elif not planned:
        if not isinstance(status, str) or not status.strip():
            errors.append('Status Badge requires a preset status or a business-state binding')
        elif '{{' not in status and status not in BADGE_STATUSES:
            errors.append(f'Status Badge status must be one of {", ".join(BADGE_STATUSES)}')
        if text is None or not str(text).strip():
            errors.append('Status Badge requires visible text or a business-label binding')
    return errors


def status_map_errors(spec):
    """A per-row status Column records the value → {status,label} mapping it renders."""
    mapping = spec.get('statusMap')
    if not isinstance(mapping, dict) or not mapping:
        return ['Status Column must record statusMap {value: {status, label}} for every state it renders']
    errors = []
    for value, entry in mapping.items():
        if not isinstance(entry, dict):
            errors.append(f'statusMap[{value!r}] needs status and label')
            continue
        if entry.get('status') not in BADGE_STATUSES:
            errors.append(f'statusMap[{value!r}] status must be one of {", ".join(BADGE_STATUSES)}')
        if not isinstance(entry.get('label'), str) or not entry['label'].strip():
            errors.append(f'statusMap[{value!r}] needs a nonempty label')
    return errors


def provider_call(code, action):
    return isinstance(code, str) and any(match.group('action') == action
        for match in PROVIDER_CALL.finditer(code))


def feedback_wired(handler, interactions, action):
    if provider_call(handler, action):
        return True
    for interaction in interactions:
        # Public full readbacks serialize native steps directly as Interaction
        # with actionName, rather than a fabricated globalAction wrapper.
        if interaction.get('__type') != 'Interaction' or interaction.get('conditionalMode') == 'never':
            continue
        if interaction.get('actionName') == action:
            return True
        if interaction.get('actionName') == 'customFunction' and provider_call(interaction.get('code'), action):
            return True
    return False


def authored(root):
    if not root:
        return
    if root.get('attrs', {}).get('data-editable') == 'false':
        return
    yield root
    for child in root.get('children', []):
        yield from authored(child)


def column_presentation_errors(spec, node, declarations):
    """Compare the planned presentation with the actual native render Slot.

    Custom templates use the existing component/Slot owners to distinguish Tag
    from text. Their CSS and the justification for either choice need review.
    """
    if identity(node) != 'plasmicantd6tablecolumn':
        return []
    expected = spec.get('presentation')
    if expected not in COLUMN_PRESENTATIONS:
        return []  # Report the missing source decision in plan_errors().
    values, render = props(node), slot(node, 'render')
    actual = 'custom' if render and render.get('children') else 'text'
    category = spec.get('role') == 'category'
    context = {'check': 'categoryPresentation' if category else 'columnPresentation', 'node': spec.get('nodeName')}
    errors = [{**context, 'message': f'{key} is not a native Table Column prop; the render Slot alone decides presentation'}
              for key in RETIRED_COLUMN_PROPS if key in values]
    if actual != expected:
        return errors + [{**context, 'message': f'Column must retain reviewed presentation:{expected}; actual render Slot is {actual}'}]
    if actual != 'custom' or not category:
        return errors
    # Follow the planned render owner chain, including a Tooltip/layout wrapper.
    owners = {spec['nodeName']}
    rendered = set()
    while True:
        children = {entry.get('nodeName') for entry in declarations
                    if isinstance(entry.get('owner'), dict)
                    and entry['owner'].get('nodeName') in owners
                    and (entry['owner'].get('nodeName') != spec['nodeName']
                         or entry['owner'].get('slot') == 'render')}
        if children <= rendered:
            break
        rendered.update(children)
        owners.update(children)
    planned_tag = any(entry.get('nodeName') in rendered and norm(entry.get('component', '')) == 'plasmicantd6tag'
                      for entry in declarations)
    actual_tag = any(identity(n) == 'plasmicantd6tag' for n in authored(render or {}))
    if planned_tag != actual_tag or not actual_tag and not content(render):
        errors.append({**context, 'message': 'Custom category template must retain the reviewed text or registered Tag render owners; an empty Slot is insufficient'})
    return errors


MISSING = object()


def prop_value(values, path):
    for key in path.split('.'):
        if not isinstance(values, dict) or key not in values:
            return MISSING
        values = values[key]
    return values


def pending_pointers(value, pointer=''):
    if value == rules_manifest.PENDING:
        yield pointer
    elif isinstance(value, dict):
        for key, child in value.items():
            yield from pending_pointers(child, f"{pointer}/{str(key).replace('~', '~0').replace('/', '~1')}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from pending_pointers(child, f'{pointer}/{index}')


def decision_errors(plan):
    """Generic, manifest-driven: no pending slots, every declared decision made."""
    errors = []
    declarations = plan.get('components') if isinstance(plan.get('components'), list) else []
    page_rules = rules_manifest.manifest()['pageDecisions']
    for pointer in pending_pointers(plan):
        parts = pointer.split('/')
        rule = page_rules.get(parts[1]) if len(parts) > 1 else None
        if len(parts) > 3 and parts[1] == 'components' and parts[2].isdigit() and int(parts[2]) < len(declarations) and isinstance(declarations[int(parts[2])], dict):
            spec = declarations[int(parts[2])]
            prop = '.'.join(p.replace('~1', '/').replace('~0', '~') for p in parts[4:]) if parts[3] == 'props' else parts[3]
            target = 'props' if parts[3] == 'props' else 'spec'
            item = next((d for d in rules_manifest.decisions_for(spec.get('component', '')) if d['prop'] == prop
                         and d.get('target', 'props') == target), None)
            rule = rules_manifest.decision_rule(spec['component'], item) if item else rules_manifest.document_for(spec.get('component', ''))
        errors.append({'check': 'decisionPending', 'pointer': pointer,
                       'rule': rule or rules_manifest.manifest()['checks']['decisionPending'],
                       'message': 'Replace the scaffolded "__DECIDE__" value from the source and the owning rule before markup'})
    for i, spec in enumerate(declarations):
        if not isinstance(spec, dict):
            continue
        values = spec.get('props') if isinstance(spec.get('props'), dict) else {}
        for item in rules_manifest.decisions_for(spec.get('component', '')):
            in_spec = item.get('target') == 'spec'
            value = spec.get(item['prop'], MISSING) if in_spec else prop_value(values, item['prop'])
            if value is MISSING or value is None and not item.get('nullable'):
                errors.append({'check': 'planDecision', 'pointer': f'/components/{i}/' + ('' if in_spec else 'props/') + item['prop'].replace('.', '/'),
                               'node': spec.get('nodeName'), 'prop': item['prop'], 'nullable': bool(item.get('nullable')),
                               **({'baseline': item['baseline']} if 'baseline' in item else {}),
                               'rule': rules_manifest.decision_rule(spec['component'], item),
                               'message': ('Declare this plan decision before markup' if in_spec else 'Declare this native prop before markup')
                                          + ('; null means deliberately unset' if item.get('nullable') else '')})
        if norm(spec.get('component', '')) == 'plasmicantd6card' and spec.get('header', rules_manifest.PENDING) != rules_manifest.PENDING:
            errors.extend(card_header_plan_errors(spec, i))
    return errors


# Bracketed fields/actions ("名称[____]", "[校验]") and dropdowns ("类型▾") in a text wireframe.
WIREFRAME_TOKEN = re.compile(r'[^\s│┃|:：\[\]]*\[[^\]\n]+\]|[^\s│┃|:：\[\]（(]+▾')


def wireframe_errors(plan):
    """Every text-wireframe element maps to a planned node or a reasoned exclusion.

    Proves the inventory is verbatim and covers every bracketed/dropdown token;
    it cannot prove that named regions or prose lines were all transcribed.
    """
    value = plan.get('wireframe')
    if value == rules_manifest.PENDING:
        return []  # Reported once as decisionPending.
    rule = rules_manifest.manifest()['checks']['wireframe']
    def error(pointer, message, **details):
        return {'check': 'wireframe', 'pointer': pointer, 'rule': rule, 'message': message, **details}
    if not isinstance(value, dict):
        return [error('/wireframe', 'Declare the Page wireframe inventory {source, items}, or {notApplicable: reason} when the source has no text wireframe')]
    if 'notApplicable' in value:
        if not isinstance(value['notApplicable'], str) or not value['notApplicable'].strip() or value.keys() - {'notApplicable'}:
            return [error('/wireframe/notApplicable', 'A Page without a text wireframe declares only a nonempty notApplicable reason')]
        return []
    try:
        verify_component_policy.source_text(value.get('source'))
    except (ValueError, OSError, UnicodeError) as problem:
        return [error('/wireframe/source', f'Wireframe source evidence is unusable: {problem}; create it with prepare_plan.py evidence')]
    squash = lambda text: re.sub(r'\s+', '', text)
    quote = squash(value['source']['quote'])
    items = value.get('items')
    if not isinstance(items, list) or not items:
        return [error('/wireframe/items', 'List every wireframe element as {text, node} or {text, excluded}')]
    names = {c.get('nodeName') for c in plan.get('components', []) if isinstance(c, dict)}
    errors, texts = [], []
    for i, item in enumerate(items):
        pointer = f'/wireframe/items/{i}'
        text = item.get('text') if isinstance(item, dict) else None
        if not isinstance(text, str) or not text.strip():
            errors.append(error(pointer, 'Wireframe items need the verbatim element text'))
            continue
        texts.append(squash(text))
        if squash(text) not in quote:
            errors.append(error(pointer + '/text', 'Wireframe item text is not a verbatim part of the quoted wireframe', text=text))
        node, excluded = item.get('node'), item.get('excluded')
        if (node is None) == (excluded is None):
            errors.append(error(pointer, 'Map the element to node (one name or a list) or give an excluded reason, not both', text=text))
        elif excluded is not None:
            if not isinstance(excluded, str) or not excluded.strip():
                errors.append(error(pointer + '/excluded', 'An excluded wireframe element needs its scope reason', text=text))
        else:
            targets = [node] if isinstance(node, str) else node
            if not isinstance(targets, list) or not targets or any(t not in names for t in targets):
                errors.append(error(pointer + '/node', 'Wireframe element must map to declared component nodeNames', text=text,
                                    node=node))
    for token in dict.fromkeys(WIREFRAME_TOKEN.findall(value['source']['quote'])):
        if not any(squash(token) in text for text in texts):
            errors.append(error('/wireframe/items', 'Wireframe element is missing from the inventory; map it or exclude it with a reason', token=token))
    return errors


PAGE_TYPES = tuple(rules_manifest.manifest()['pageRules']['pageType'])
PAGE_TYPE_RULE = 'references/design/page-types.md#choosing-the-type'
SCALE = 'references/design/scale.md'
APP_SHELL = 'plasmic-overseas-app-shell'
OVERLAYS = {'plasmicantd6modal', 'plasmicantd6drawer'}


def page_type_errors(plan):
    value = plan.get('pageType')
    if value == rules_manifest.PENDING or value in PAGE_TYPES:
        return []
    return [{'check': 'pageType', 'pointer': '/pageType', 'rule': PAGE_TYPE_RULE, 'allowedValues': list(PAGE_TYPES),
             'message': 'Choose the Page type from the user task on this Page before declaring regions and components'}]


def page_body_errors(plan):
    """The business root inside AppShell owns the 16px region gap (scale.md#spacing)."""
    declarations = [c for c in plan.get('components', []) if isinstance(c, dict)]
    shells = {c.get('nodeName') for c in declarations if norm(c.get('component', '')) == norm(APP_SHELL)}
    rule = rules_manifest.manifest()['checks']['pageBody']
    errors = []
    for i, spec in enumerate(declarations):
        owner = spec.get('owner') if isinstance(spec.get('owner'), dict) else {}
        if owner.get('nodeName') not in shells or owner.get('slot', 'children') != 'children':
            continue
        values = spec.get('props') if isinstance(spec.get('props'), dict) else {}
        key = norm(spec.get('component', ''))
        expected = ({'vertical': True, 'gap': 16} if key == 'plasmicantd6flex' else
                    {'gutter': 16} if key == 'plasmicantd6row' else {})
        for prop, value in expected.items():
            actual = verify_component_policy.at(values, prop)
            if actual != value and not verify_component_policy.approved_override(spec, prop):
                errors.append({'check': 'pageBody', 'pointer': f'/components/{i}/props/{prop}', 'node': spec.get('nodeName'),
                               'rule': rule, 'expected': value, 'actual': actual,
                               'message': 'The business root in AppShell children separates top-level regions with the scale gap (Flex vertical gap 16, Row gutter 16); another value needs a source override'})
    return errors


CARD_HEADERS = ('none', 'title', 'title+extra')
CARD_HEADER_REASONS = ('actions', 'collapse', 'count', 'distinguish')


def card_header_plan_errors(spec, index):
    """A Card header is decided before markup; a header always carries its title."""
    rule = rules_manifest.document_for('plasmic-antd6-card') + '#card-headers'
    header, reason = spec.get('header'), spec.get('headerReason')
    pointer = f'/components/{index}'
    if header not in CARD_HEADERS:
        return [{'check': 'planDecision', 'pointer': pointer + '/header', 'node': spec.get('nodeName'), 'rule': rule,
                 'allowedValues': list(CARD_HEADERS),
                 'message': 'Card header must be none, title or title+extra; an extra-only header is not valid'}]
    if header == 'none' and reason is not None:
        return [{'check': 'planDecision', 'pointer': pointer + '/headerReason', 'node': spec.get('nodeName'), 'rule': rule,
                 'message': 'A headerless Card has no headerReason; remove it or decide a header'}]
    if header != 'none' and reason not in CARD_HEADER_REASONS:
        return [{'check': 'planDecision', 'pointer': pointer + '/headerReason', 'node': spec.get('nodeName'), 'rule': rule,
                 'allowedValues': list(CARD_HEADER_REASONS),
                 'message': 'A Card header needs its reason: card-scoped actions, collapse, a header count or distinguishing comparable Cards'}]
    if header == 'title+extra' and reason != 'actions' and reason != 'collapse':
        return [{'check': 'planDecision', 'pointer': pointer + '/headerReason', 'node': spec.get('nodeName'), 'rule': rule,
                 'message': 'title+extra puts actions or a toggle in the header; use title when the header has no extra content'}]
    return []


def table_plan_errors(declarations):
    """Freeze the Table width contract in the plan, before markup.

    Applies the saved-model gate's rules to declared Column props, and checks
    that the width-free main Column is ordinary text rather than a status,
    category or operation Column. Rendered widths still need layout evidence.
    """
    from verify_structure import column_width_errors
    errors = []
    def owned(owner, slot_name='children'):
        return [(i, c) for i, c in enumerate(declarations) if isinstance(c.get('owner'), dict)
                and c['owner'].get('nodeName') == owner and c['owner'].get('slot', 'children') == slot_name]
    def values(spec):
        return spec.get('props') if isinstance(spec.get('props'), dict) else {}
    action_columns = {c['owner'].get('nodeName') for c in declarations
                      if c.get('role') == 'row-actions' and isinstance(c.get('owner'), dict)}
    for t_index, table in enumerate(declarations):
        if norm(table.get('component', '')) != 'plasmicantd6table':
            continue
        leaves = []
        for i, child in owned(table.get('nodeName')):
            key = norm(child.get('component', ''))
            if key == 'plasmicantd6tablecolumngroup':
                leaves += [(j, c) for j, c in owned(child.get('nodeName')) if norm(c.get('component', '')) == 'plasmicantd6tablecolumn']
            elif key == 'plasmicantd6tablecolumn':
                leaves.append((i, child))
        if not leaves:
            continue
        context = {'check': 'tableWidthPlan', 'node': table.get('nodeName'), 'pointer': f'/components/{t_index}/props'}
        for i, column in leaves:
            if column.get('nodeName') in action_columns and (values(column).get('fixed') != 'right' or values(column).get('width') is None):
                errors.append({**context, 'column': column.get('nodeName'), 'pointer': f'/components/{i}/props',
                               'message': 'Plan the operation Column with fixed:"right" and a measured numeric width before markup'})
        typed = [c for _, c in leaves if c.get('role') in ('status', 'category') or c.get('nodeName') in action_columns]
        if typed and not any(values(c).get('width') is not None for _, c in leaves):
            errors.append({**context, 'message': 'Decide Column widths in the plan: status, category and operation Columns use explicit widths, one main text Column absorbs the remainder, and Table scroll.x is numeric'})
            continue
        entries = [(c.get('nodeName'), values(c), values(c).get('title') if isinstance(values(c).get('title'), str) else '') for _, c in leaves]
        errors.extend({**e, 'check': 'tableWidthPlan', 'pointer': f'/components/{t_index}/props'} for e in column_width_errors(values(table), entries, context, table))
        unset = [(i, c) for i, c in leaves if values(c).get('width') is None]
        if any(values(c).get('width') is not None for _, c in leaves) and len(unset) == 1:
            i, main = unset[0]
            if main.get('role') != 'widget' or main.get('nodeName') in action_columns:
                errors.append({**context, 'column': main.get('nodeName'), 'pointer': f'/components/{i}/role',
                               'message': 'The width-free Column absorbs remaining space and must be the main text Column (role:widget); status, category and operation Columns need explicit widths'})
    return errors


def plan_errors(plan):
    declarations = plan.get('components')
    if not isinstance(declarations, list) or any(not isinstance(c, dict) for c in declarations):
        return [{'check': 'selectionPlan', 'pointer': '/components', 'message': 'components inventory required before generation'}]
    errors = verify_component_policy.plan_errors(plan)
    def issue(pointer, message, **details):
        errors.append({'check': 'selectionPlan', 'pointer': pointer, 'message': message, **details})
    names = [c.get('nodeName') for c in declarations]
    for i, name in enumerate(names):
        if not isinstance(name, str) or not name.strip():
            issue(f'/components/{i}/nodeName', 'components require unique nonempty nodeName values')
    for name, count in Counter(n for n in names if isinstance(n, str)).items():
        if count > 1:
            pointers = [f'/components/{i}/nodeName' for i, n in enumerate(names) if n == name]
            issue(pointers[0], 'components require unique nonempty nodeName values', node=name, relatedPointers=pointers[1:])
    for i, spec in enumerate(declarations):
        pointer = f'/components/{i}'
        name, role = spec.get('nodeName'), spec.get('role')
        component = norm(spec.get('component', ''))
        if not all(isinstance(spec.get(k), str) and spec[k].strip() for k in ('source', 'purpose', 'rule')):
            issue(pointer, 'source, purpose and relevant reference rule are required', node=name,
                  missing=[k for k in ('source', 'purpose', 'rule') if not isinstance(spec.get(k), str) or not spec[k].strip()])
        else:
            rule = spec['rule'].split('#', 1)[0]
            resource_root = Path(__file__).resolve().parent.parent
            target = (resource_root / rule).resolve()
            if not rule.startswith('references/') or not target.is_relative_to((resource_root / 'references').resolve()) or not target.is_file():
                issue(pointer + '/rule', 'rule must point to an existing resolved reference', node=name)
            elif not rule_matches_library(spec.get('component', ''), spec['rule']):
                issue(pointer + '/rule', 'Rule library does not match the actual registration; select its own API family',
                      node=name, component=spec.get('component'), library=rules_manifest.library_for(spec.get('component', '')))
        if role not in {*ROLES, 'widget'}:
            issue(pointer + '/role', 'Unknown semantic role', node=name, actual=role, allowedRoles=sorted([*ROLES, 'widget']))
        elif role == 'widget' and component in CONSTRAINED:
            issue(pointer + '/role', 'Use a specific purpose role, not widget', node=name,
                  allowedRoles=sorted(r for r, keys in ROLES.items() if component in keys))
        elif (role in ROLES and rules_manifest.library_for(spec.get('component', '')) in ADMIN_LIBRARIES
              and component not in ROLES[role]):
            issue(pointer + '/component', 'Component is incompatible with its semantic role', node=name, role=role,
                  component=spec.get('component'), allowedComponents=sorted(ROLE_COMPONENTS[role]),
                  allowedRoles=sorted(r for r, keys in ROLES.items() if component in keys))
        values = spec.get('props') if isinstance(spec.get('props'), dict) else {}
        if component == 'plasmicantd6tablecolumn':
            for key in RETIRED_COLUMN_PROPS:
                if key in values:
                    issue(pointer + f'/props/{key}', f'{key} is not a native Table Column prop; record presentation:text|custom on the declaration and compose custom content in the render Slot',
                          node=name, actual=values[key])
            presentation = spec.get('presentation', MISSING)
            if presentation is not MISSING and presentation != rules_manifest.PENDING and presentation not in COLUMN_PRESENTATIONS:
                issue(pointer + '/presentation', 'Column presentation must be text (empty render Slot) or custom (registered components in render); category alone does not require Tag',
                      node=name, actual=presentation, allowedValues=list(COLUMN_PRESENTATIONS))
            elif role == 'status' and presentation == 'text':
                issue(pointer + '/presentation', 'Status Columns render a registered Badge: presentation must be custom',
                      node=name, actual=presentation)
            reason = spec.get('nonStatusReason')
            if role != 'status' and state_like(values.get('dataIndex'), values.get('title')) and not (isinstance(reason, str) and reason.strip()):
                issue(pointer + '/role', STATE_LIKE, check='statusRole', node=name, field=values.get('dataIndex') or values.get('title'))
        if role == 'status' and component == 'plasmicantd6badge' and any(k in values for k in ('options', 'color', 'dot', 'count')):
            for message in status_badge_errors(values, False, planned=True):
                issue(pointer + '/props', message, node=name)
        if role in {'persistent-feedback', 'surface'} and not str(spec.get('condition', '')).strip():
            issue(pointer + '/condition', 'Declare the continuing condition or independently justified surface', node=name)
    errors.extend(table_plan_errors(declarations))
    errors.extend(decision_errors(plan))
    if 'wireframe' in plan:  # Full Page presence is required by check(); snippets can omit it.
        errors.extend(wireframe_errors(plan))
    if 'pageType' in plan:
        errors.extend(page_type_errors(plan))
    errors.extend(page_body_errors(plan))
    feedback = plan.get('feedback')
    if not isinstance(feedback, list):
        issue('/feedback', 'Declare source-derived feedback:[] even when no operation feedback is required')
        return errors
    keys = {}
    for i, spec in enumerate(feedback):
        pointer = f'/feedback/{i}'
        if not isinstance(spec, dict):
            issue(pointer, 'feedback entries must be objects')
            continue
        if all(isinstance(spec.get(k), str) for k in ('nodeName', 'event')):
            keys.setdefault((spec['nodeName'], spec['event']), []).append(pointer)
        if isinstance(spec.get('notApplicable'), str) and spec['notApplicable'].strip():
            continue
        if not all(isinstance(spec.get(k), str) and spec[k].strip() for k in ('nodeName', 'event', 'source', 'success', 'failure')):
            issue(pointer, 'feedback needs a source, event owner and independent success/failure expectations',
                  required=['nodeName', 'event', 'source', 'success', 'failure'])
        if spec.get('kind') not in {'transient', 'asynchronous'}:
            issue(pointer + '/kind', 'Fields/continuing conditions belong to their native region', allowedValues=['transient', 'asynchronous'])
    for pointers in keys.values():
        if len(pointers) > 1:
            issue(pointers[0], 'Duplicate feedback event; list branches under one success/failure expectation', relatedPointers=pointers[1:])
    return errors


def check_page(plan, page):
    errors = plan_errors(plan)
    errors.extend(verify_component_policy.check_page(plan, page))
    root = TextTree(page.get('baseVariantTplTree', '')).root
    nodes = list(authored(root))
    declarations = {c.get('nodeName'): c for c in plan.get('components', [])}
    column_badges = set()  # Badges already checked through their status Column.
    for node in nodes:
        if node.get('tag') != 'plasmic-component':
            continue
        key, name = identity(node), node_name(node)
        if key in LAYOUT or key in OWNED_CHILDREN or key.startswith('plasmicantdicon'):
            continue
        spec = declarations.get(name)
        if not spec:
            errors.append({'check': 'selectionCoverage', 'node': name, 'component': key,
                           'message': 'Every authored functional instance requires a source-reviewed selection, including hidden content'})
            continue
        if norm(spec.get('component', '')) != key:
            errors.append({'check': 'selectionIdentity', 'node': name, 'message': 'Actual registration differs from the reviewed selection'})
        role, values = spec.get('role'), props(node)
        if role == 'status':
            if key == 'plasmicantd6tablecolumn':
                render = slot(node, 'render')
                badges = [n for n in authored(render or {}) if identity(n) == 'plasmicantd6badge']
                if not badges:
                    errors.append({'check': 'statusPresentation', 'node': name, 'message': 'Status Column requires its native Badge render template; Tag/text presets are not status presentation'})
                if badges:
                    errors.extend({'check': 'statusPresentation', 'node': name, 'message': message}
                                  for message in status_map_errors(spec))
                for badge in badges:
                    column_badges.add(id(badge))
                    errors.extend({'check': 'statusPresentation', 'node': node_name(badge), 'message': message}
                                  for message in status_badge_errors(props(badge), True))
            elif key == 'plasmicantd6badge' and id(node) not in column_badges:
                errors.extend({'check': 'statusPresentation', 'node': name, 'message': message}
                              for message in status_badge_errors(values, False))
        if key == 'plasmicantd6tablecolumn' and role != 'status':
            reason = spec.get('nonStatusReason')
            title = content(slot(node, 'title')) or values.get('title')
            if state_like(values.get('dataIndex'), title) and not (isinstance(reason, str) and reason.strip()):
                errors.append({'check': 'statusRole', 'node': name, 'message': STATE_LIKE})
        errors.extend(column_presentation_errors(spec, node, plan.get('components', [])))
    for spec in plan.get('feedback', []):
        if not isinstance(spec, dict):
            continue
        matches = [n for n in nodes if node_name(n) == spec.get('nodeName')]
        if len(matches) != 1:
            errors.append({'check': 'feedback', 'node': spec.get('nodeName'), 'message': 'One real feedback event owner required'})
            continue
        if isinstance(spec.get('notApplicable'), str) and spec['notApplicable'].strip():
            # No official transient-feedback component is registered in this library;
            # the reviewed decision records that the outcome shows through state instead.
            continue
        node = matches[0]
        handler = props(node).get(spec.get('event'))
        interactions = [i for i in page.get('interactions', [])
            if i.get('elementUuid') == node.get('attrs', {}).get('id') and i.get('eventName') == spec.get('event')]
        action = FEEDBACK_CONTEXT + ('.showMessage' if spec.get('kind') == 'transient' else '.showNotification')
        if not feedback_wired(handler, interactions, action):
            errors.append({'check': 'feedback', 'node': spec.get('nodeName'), 'message': f'Expected qualified provider action {action} wiring on the reviewed event; page Alert/notice state is not a substitute'})
    actual_names = Counter(node_name(n) for n in nodes if n.get('tag') == 'plasmic-component')
    for name in declarations:
        if actual_names[name] != 1:
            errors.append({'check': 'selectionCoverage', 'node': name, 'message': 'Each planned component must resolve to exactly one actual instance'})
    return errors


RESOURCE_ROOT = rules_manifest.RESOURCE_ROOT


def component_declarations(plan):
    values = plan.get('components')
    return [spec for spec in values if isinstance(spec, dict)] if isinstance(values, list) else []


def page_libraries(plan):
    return {library for spec in component_declarations(plan)
            if (library := rules_manifest.library_for(spec.get('component', '')))}


def admin_page(plan):
    """Page-wide v6 recipes cannot establish another library's layout/API contract."""
    if any(not rules_manifest.library_for(spec.get('component', ''))
           for spec in component_declarations(plan)):
        return False
    libraries = page_libraries(plan) - {'antd_icons'}
    return bool(libraries) and libraries <= ADMIN_LIBRARIES


def project_reads(stage='compose', root=None):
    """Shared design rules read once per task in full and reviewed once per project.

    Task-wide rules that only some tasks need (record context, permissions) join
    when any planned Page needs them (gate-rules.json projectRulesWhen).
    """
    data = rules_manifest.manifest()
    paths = list(data['projectRules'])
    pages = [p for p in (root or {}).get('pages', []) if isinstance(p, dict)] if isinstance(root, dict) else []
    libraries = set().union(*(page_libraries(page) for page in pages))
    paths += [f'references/libraries/{library}/index.md' for library in sorted(libraries)]
    if libraries & ADMIN_LIBRARIES:
        paths.append('references/libraries/antd_v6/selection.md')
    conditions = {'recordPage': any(p.get('recordPage') is True for p in pages),
                  'actionContracts': any(isinstance(p.get('actionContracts'), list) and p['actionContracts'] for p in pages)}
    for condition, applies in conditions.items():
        if applies:
            paths += data['projectRulesWhen'].get(condition, [])
    return {path: None for path in paths}


def page_conditions(plan, root=None):
    """Which conditional Page rules (gate-rules.json pageRules.when) apply to this Page plan."""
    declarations = component_declarations(plan)
    feedback = [f for f in plan.get('feedback', []) if isinstance(f, dict) and not str(f.get('notApplicable', '')).strip()] \
        if isinstance(plan.get('feedback'), list) else []
    keys = {norm(c.get('component', '')) for c in declarations}
    tables = [c for c in declarations if norm(c.get('component', '')) == 'plasmicantd6table']
    def selectable(table):
        values = table.get('props') if isinstance(table.get('props'), dict) else {}
        dynamic = table.get('dynamicProps') if isinstance(table.get('dynamicProps'), list) else []
        return (values.get('selectionMode') not in (None, 'none') or 'selectedRowKeys' in values
                or bool({'selectedRowKeys', 'selectionMode'} & set(dynamic)))
    feedback_owners = {c.get('nodeName') for c in declarations
                       if rules_manifest.library_for(c.get('component', '')) in ADMIN_LIBRARIES}
    native_feedback = [f for f in feedback if f.get('nodeName') in feedback_owners]
    state_components = {'plasmicantd6' + name for name in ('alert', 'empty', 'spin', 'skeleton', 'result', 'table', 'list')}
    wireframe = plan.get('wireframe')
    return {
        'overlay': bool(keys & OVERLAYS),
        'feedback': bool(native_feedback),
        'asynchronousFeedback': any(f.get('kind') == 'asynchronous' for f in native_feedback),
        'contentStates': bool(keys & state_components),
        'tableSelection': any(selectable(table) for table in tables),
        'stepForm': {'plasmicantd6steps', 'plasmicantd6form'} <= keys,
        'summaryMetrics': bool(keys & {'plasmicantd6descriptions', 'plasmicantd6statistic', 'plasmicantd6statistictimer'}),
        'searchTable': 'plasmicantd6table' in keys,
        'categoryColumn': any(norm(c.get('component', '')) == 'plasmicantd6tablecolumn'
                              and c.get('role') == 'category' for c in declarations),
        'pageHeader': admin_page(plan) and plan.get('pageType') in ('basic-detail', 'tabbed-detail')
                      and isinstance(plan.get('pageHeader'), dict)
                      and all(isinstance(plan['pageHeader'].get(key), str) and plan['pageHeader'][key].strip()
                              for key in ('nodeName', 'source')),
        'wireframe': isinstance(wireframe, dict) and 'notApplicable' not in wireframe
                     and isinstance(wireframe.get('source'), dict) and isinstance(wireframe.get('items'), list),
    }


def dynamic_navigation(plan, root=None):
    """Role-query or dynamic menus: the root navigation transform or a bound AppShell menuItems."""
    navigation = (root or {}).get('navigation') if isinstance(root, dict) else None
    if isinstance(navigation, dict) and 'roleQuery' in navigation:
        return True
    for spec in plan.get('components', []) if isinstance(plan.get('components'), list) else []:
        if isinstance(spec, dict) and norm(spec.get('component', '')) == norm(APP_SHELL):
            dynamic = spec.get('dynamicProps') if isinstance(spec.get('dynamicProps'), list) else []
            menu = (spec.get('props') or {}).get('menuItems') if isinstance(spec.get('props'), dict) else None
            if 'menuItems' in dynamic or isinstance(menu, str) and '{{' in menu:
                return True
    return False


def required_reads(plan, stage='compose', root=None):
    """{resource-relative path: set of anchors, or None for the full document}.

    Each declaration needs its own `rule` and its registration's owner document
    (rules.json). Stage-template documents deliver their preamble plus Plan
    decisions and Generation rules when composing, and the complete document
    for acceptance. Other documents and explicit anchors are read as declared.
    The decided page type and applicable Page conditions add their composition
    documents (gate-rules.json pageRules); `root` is the whole expectation.
    """
    needed = {}
    def add(path, anchors):
        if anchors is None or needed.get(path, set()) is None:
            needed[path] = None
        else:
            needed.setdefault(path, set()).update(anchors)
    def stage_anchors(path):
        stages = rules_manifest.stage_sections(path)
        if stage == 'accept' or 'generation-rules' not in stages:
            return None
        # Conditional rules arrive by explicit subsection (below), never as a whole stage.
        return {anchor for anchor in stages if anchor not in ('acceptance-checks', 'conditional-rules')}
    page_rules = rules_manifest.manifest()['pageRules']
    if 'components' in plan:
        documents = list(page_rules.get('pageType', {}).get(plan.get('pageType'), [])) if admin_page(plan) else []
        for condition, applies in page_conditions(plan, root).items():
            if applies:
                documents += page_rules.get('when', {}).get(condition, [])
        for path in documents:
            add(path, stage_anchors(path))
    for spec in plan.get('components', []) if isinstance(plan.get('components'), list) else []:
        if not isinstance(spec, dict):
            continue
        rule = spec.get('rule')
        if (isinstance(rule, str) and rule.startswith('references/')
                and rule_matches_library(spec.get('component', ''), rule)
                and (RESOURCE_ROOT / rule.split('#', 1)[0]).is_file()):
            path, _, anchor = rule.partition('#')
            add(path, stage_anchors(path))
            if anchor and needed[path] is not None:
                needed[path].add(anchor)
        owner = rules_manifest.document_for(spec.get('component', ''))
        if owner:
            path, _, anchor = owner.partition('#')
            add(path, stage_anchors(path))
            if anchor and needed[path] is not None:
                needed[path].add(anchor)
        owner_document = (rules_manifest.document_for(spec.get('component', '')) or '').split('#', 1)[0]
        for item in rules_manifest.decisions_for(spec.get('component', '')):
            # A decision owned by another document must be read explicitly; a decision
            # inside the component's own document is already covered by the stage template.
            decision_path, _, decision_anchor = rules_manifest.decision_rule(spec.get('component', ''), item).partition('#')
            if decision_path == owner_document or not (RESOURCE_ROOT / decision_path).is_file():
                continue
            add(decision_path, stage_anchors(decision_path))
            if decision_anchor and needed.get(decision_path) is not None:
                needed[decision_path].add(decision_anchor)
    # Conditional sections outside the stage template reach only the Pages that need them.
    shell = (rules_manifest.document_for(APP_SHELL) or '').split('#', 1)[0]
    if shell in needed and needed[shell] is not None:
        context = plan.get('appContext')
        if isinstance(context, dict) and context.get('required') is True:
            needed[shell].add('app-context')
        if dynamic_navigation(plan, root):
            needed[shell].add('cross-page-context-and-dynamic-menus')
    # Page-wide baselines belong to the supported suite only. Mixed/unknown
    # libraries retain their component-owned rules without borrowing a v6 page contract.
    if 'components' in plan and admin_page(plan):
        add(SCALE, None)
        page_types = PAGE_TYPE_RULE.split('#', 1)[0]
        kind = plan.get('pageType')
        add(page_types, None if stage == 'accept' else
            ({kind, 'regions-inside-any-type'} if kind in PAGE_TYPES else {'choosing-the-type'}))
    return needed


def read_coverage_errors(plan, ledger, stage='compose', root=None):
    """Compare the read_reference.py ledger with the Page's required reads.

    Proves only that the current bytes of each section were emitted to the
    agent, not that they were understood or followed.
    """
    return coverage_errors(required_reads(plan, stage, root), ledger)


def project_coverage_errors(ledger, stage='compose', root=None):
    """The project card's shared design rules, read in full at their current hash."""
    return [{**error, 'message': 'Read the project rules card (prepare_plan.py rules PLAN --project) with --log before composing'}
            for error in coverage_errors(project_reads(stage, root), ledger)]


def coverage_errors(needed, ledger):
    from read_reference import sections, selected_lines
    errors = []
    for path, anchors in sorted(needed.items()):
        file = RESOURCE_ROOT / path
        text = file.read_text(encoding='utf-8')
        digest = hashlib.sha256(text.encode()).hexdigest()
        lines, headings = sections(text)
        covered = set()
        for record in ledger:
            if not isinstance(record, dict):
                continue
            if not str(record.get('path', '')).endswith('/' + path) or record.get('sha256') != digest or record.get('outline'):
                continue
            chosen = record.get('sections')
            if not isinstance(chosen, list) or not all(isinstance(anchor, str) for anchor in chosen):
                continue
            try:
                covered.update(selected_lines(text, chosen))
            except ValueError:
                continue
        missing_lines = selected_lines(text, anchors) - covered
        if not missing_lines:
            continue
        if anchors is not None:
            missing = sorted(anchor for anchor in anchors if selected_lines(text, [anchor]) - covered)
        else:
            # Attribute unread lines to the heading that owns them, rather than
            # treating an emitted ancestor introduction as an unread whole subtree.
            missing = [heading['anchor'] for i, heading in enumerate(headings)
                       if missing_lines & set(range(heading['start'], headings[i + 1]['start'] if i + 1 < len(headings) else len(lines)))]
        errors.append({'check': 'referenceReads', 'rule': path, 'missingSections': missing or ['full-document'],
                       'message': 'Read these current sections with read_reference.py --log before composing; see prepare_plan.py rules'})
    return errors


def load_ledger(filename):
    records = []
    for number, line in enumerate(Path(filename).read_text(encoding='utf-8').splitlines(), 1):
        if line.strip():
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError as error:
                raise json.JSONDecodeError(f'{filename}:{number}: {error.msg}', error.doc, error.pos)
    return records


def check(expected, readback=None, page_path=None, reads=None):
    errors = []
    templates = []
    content_reports = []
    plans = [(i, p) for i, p in enumerate(expected.get('pages', [])) if page_path is None or p.get('path') == page_path]
    if not plans:
        errors.append({'check': 'selectionPlan', 'message': 'Nonempty page inventory required'})
    if reads is not None:
        errors.extend(project_coverage_errors(reads, root=expected))
    for page_index, plan in plans:
        path = plan.get('path')
        template_report = ({'passed': False, 'errors': []} if plan.get('templates') == rules_manifest.PENDING
                           else verify_templates.check_page(plan))  # Reported once as decisionPending.
        templates.append({'path': path, **template_report})
        errors.extend({'path': path, 'check': 'templateSource', 'pointer': f'/pages/{page_index}/templates', 'message': message} for message in template_report['errors'])
        if not isinstance(path, str) or not path.startswith('/'):
            errors.append({'check': 'selectionPlan', 'message': 'Every planned Page requires its exact absolute route before composition'})
        if reads is not None:
            errors.extend({'path': path, **e} for e in read_coverage_errors(plan, reads, root=expected))
        # plan_errors also serves component documentation snippets. A complete
        # Page cannot omit the decisions that drive routing and source coverage.
        missing_decisions = []
        if 'pageType' not in plan:
            missing_decisions.extend(page_type_errors(plan))
        if 'wireframe' not in plan:
            missing_decisions.extend(wireframe_errors(plan))
        if readback is None:
            issues = plan_errors(plan) + verify_content.plan_errors(plan)
        else:
            pages = [p for p in readback.get('results', []) if p.get('type') == 'page' and p.get('pageMeta', {}).get('path') == path]
            issues = check_page(plan, pages[0]) if len(pages) == 1 else [{'check': 'selectionCoverage', 'message': 'One full Page readback required'}]
            if len(pages) == 1:
                reviewed = verify_content.check_page(plan, pages[0])
                content_reports.append({'path': path, **reviewed})
                issues += reviewed['errors']
        issues += missing_decisions
        rules_manifest.annotate({'errors': issues}, 'selection', plan.get('components'))
        # While a decision is pending, report it once: drop derivative findings
        # about the same placeholder (its pointer, or the placeholder value).
        pending = {e['pointer'] for e in issues if e.get('check') == 'decisionPending'}
        issues = [e for e in issues if e.get('check') == 'decisionPending' or not pending or
                  e.get('pointer') not in pending and rules_manifest.PENDING not in json.dumps(e, ensure_ascii=False)]
        for error in issues:
            error = {'path': path, **error}
            if 'pointer' in error:
                error['pointer'] = f'/pages/{page_index}' + error['pointer']
                if 'relatedPointers' in error:
                    error['relatedPointers'] = [f'/pages/{page_index}' + p for p in error['relatedPointers']]
            errors.append(error)
    rules_manifest.annotate({'errors': errors}, 'selection')
    unsupported = sorted({rules_manifest.library_for(spec.get('component', '')) or str(spec.get('component') or 'unknown')
                          for _, plan in plans for spec in component_declarations(plan)
                          if rules_manifest.library_for(spec.get('component', '')) not in ADMIN_LIBRARIES | {'antd_icons'}})
    return {'passed': not errors, 'errors': errors, 'templates': templates, 'content': content_reports,
            'notChecked': ([] if reads is not None else ['reference reading coverage (no read ledger supplied)']) +
                          ([f'library-specific semantic/model coverage outside the supported admin suite: {", ".join(unsupported)}'] if unsupported else []) +
                          ['source meaning and completeness', 'actual template insertion/detachment', 'JS execution', 'visual and runtime acceptance']}


def summary(report, report_path):
    """Bound console context while retaining every diagnostic in the report."""
    counts = Counter(error['check'] for error in report['errors'])
    # One representative per check first; do not bury a different failure class.
    first = {}
    for i, error in enumerate(report['errors']):
        first.setdefault(error['check'], i)
    representatives = set(first.values())
    order = list(first.values()) + [i for i in range(len(report['errors'])) if i not in representatives]
    examples = [{'reportPointer': f'/errors/{i}', **report['errors'][i]} for i in order[:8]]
    return {'passed': report['passed'], 'errorCount': len(report['errors']), 'byCheck': dict(counts),
            'examples': examples, 'omittedErrorCount': len(report['errors']) - len(examples),
            'report': str(Path(report_path).resolve()), 'notChecked': report.get('notChecked', [])}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('expectation')
    parser.add_argument('readback', nargs='?')
    parser.add_argument('--page')
    parser.add_argument('--report')
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--reads', help='read_reference.py --log ledger; required for composition preflight and saved-model checks')
    mode.add_argument('--plan-only', action='store_true', help='Check declarations only; does not check reference reading or authorize composition')
    parser.add_argument('--full', action='store_true', help='Print the complete report even when --report saves it')
    args = parser.parse_args()
    if args.plan_only and args.readback:
        parser.error('--plan-only checks declarations only; a saved-model check requires --reads')
    inputs = {}
    try:
        for filename in (args.expectation, args.readback):
            if filename:
                inputs[filename] = json.loads(Path(filename).read_text(encoding='utf-8'))
        filename = args.reads
        reads = load_ledger(args.reads) if args.reads else None
        report = check(inputs[args.expectation], inputs.get(args.readback), args.page, reads)
    except json.JSONDecodeError as error:
        report = {'passed': False, 'errors': [{'check': 'input', 'file': filename, 'line': error.lineno,
                  'column': error.colno, 'message': error.msg}]}
    except OSError as error:
        report = {'passed': False, 'errors': [{'check': 'input', 'file': error.filename, 'message': str(error)}]}
    output = json.dumps(report, ensure_ascii=False, indent=2)
    if args.report:
        Path(args.report).write_text(output + '\n', encoding='utf-8')
    print(output if args.full or not args.report else json.dumps(summary(report, args.report), ensure_ascii=False, indent=2))
    raise SystemExit(0 if report['passed'] else 1)


if __name__ == '__main__':
    main()
