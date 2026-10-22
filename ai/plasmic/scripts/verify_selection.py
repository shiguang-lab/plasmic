#!/usr/bin/env python3
"""Check source-declared semantic roles, coverage and feedback wiring.

Does not infer business meaning from labels, execute JS or certify Preview.
Uses the existing structure inventory, not a second component prop model.
"""
import argparse
import json
import re
from collections import Counter
from pathlib import Path
from verify_forms import TextTree, walk, identity, node_name, props, slot, content
import verify_component_policy
import verify_templates
import verify_content


def norm(value):
    return re.sub(r'[^a-z0-9]', '', value.lower())


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


# Table Column presets were removed; Tag/Badge/link/avatar are registered
# components composed in Column.render.
COLUMN_DISPLAY_TYPES = ('text', 'custom')
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
    """Status Badge contract: preset status + text, or value + options.

    Inside a status Table Column the mapped form is required, otherwise every
    row shows one literal status. A planned declaration may leave the value
    binding to generation.
    """
    errors = [f'Status Badge must not set {key}; the status preset provides the color'
              for key in ('color', 'dot', 'count') if values.get(key) is not None]
    mapped = 'options' in values or values.get('value') is not None
    if mapped:
        value, options = values.get('value'), values.get('options')
        if not planned and (value is None or not str(value).strip()):
            errors.append('Mapped status Badge requires a nonempty value binding')
        if not isinstance(options, list) or not options:
            errors.append('Status Badge options must be a literal nonempty list of {value,label,status}')
        else:
            keys = []
            for option in options:
                if not isinstance(option, dict) or not isinstance(option.get('value'), str):
                    errors.append('Each status Badge option requires a string value')
                    continue
                keys.append(option['value'])
                if not isinstance(option.get('label'), str) or not option['label'].strip():
                    errors.append(f'Status Badge option {option["value"]!r} requires a nonempty label')
                if option.get('status') not in BADGE_STATUSES:
                    errors.append(f'Status Badge option {option["value"]!r} status must be one of {", ".join(BADGE_STATUSES)}')
            if len(set(keys)) != len(keys):
                errors.append('Status Badge option values must be unique')
        for key in ('status', 'text'):
            if values.get(key) is not None:
                errors.append(f'Mapped status Badge must not set explicit {key}; it overrides the options mapping')
    elif in_column:
        errors.append('Status Badge in a Table Column must map value + options; a literal status gives every row the same status')
    elif not planned:
        status = values.get('status')
        if not isinstance(status, str) or '{{' in status:
            errors.append('Status Badge status must be a literal preset; bind dynamic states with value + options')
        elif status not in BADGE_STATUSES:
            errors.append(f'Status Badge status must be one of {", ".join(BADGE_STATUSES)}')
        if values.get('text') is None or not str(values.get('text')).strip():
            errors.append('Status Badge requires visible text')
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


def category_errors(spec, node, declarations):
    """Compare the source-selected native presentation, independently of role.

    Custom templates use the existing component/Slot owners to distinguish Tag
    from text. Their CSS and the justification for either choice need review.
    """
    if spec.get('role') != 'category' or identity(node) != 'plasmicantd6tablecolumn':
        return []
    expected = spec.get('props', {}).get('displayType')
    if expected not in COLUMN_DISPLAY_TYPES:
        return []  # Report the missing source decision in plan_errors().
    values, render = props(node), slot(node, 'render')
    actual = values.get('displayType')
    if actual is None:
        actual = 'custom' if render and render.get('children') else 'text'
    context = {'check': 'categoryPresentation', 'node': spec.get('nodeName')}
    if actual != expected:
        return [{**context, 'message': f'Category Column must retain reviewed displayType:{expected}; actual presentation is {actual}'}]
    if actual != 'custom':
        return []
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
        return [{**context, 'message': 'Custom category template must retain the reviewed text or registered Tag render owners; an empty Slot is insufficient'}]
    return []


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
        if role not in {*ROLES, 'widget'}:
            issue(pointer + '/role', 'Unknown semantic role', node=name, actual=role, allowedRoles=sorted([*ROLES, 'widget']))
        elif role == 'widget' and component in CONSTRAINED:
            issue(pointer + '/role', 'Use a specific purpose role, not widget', node=name,
                  allowedRoles=sorted(r for r, keys in ROLES.items() if component in keys))
        elif role in ROLES and component not in ROLES[role]:
            issue(pointer + '/component', 'Component is incompatible with its semantic role', node=name, role=role,
                  component=spec.get('component'), allowedComponents=sorted(ROLE_COMPONENTS[role]),
                  allowedRoles=sorted(r for r, keys in ROLES.items() if component in keys))
        values = spec.get('props') if isinstance(spec.get('props'), dict) else {}
        if component == 'plasmicantd6tablecolumn':
            if 'displayType' in values and values['displayType'] not in COLUMN_DISPLAY_TYPES:
                issue(pointer + '/props/displayType', 'Table Column displayType must be text or custom; presets were removed - compose registered components in Custom render',
                      node=name, actual=values['displayType'], allowedValues=list(COLUMN_DISPLAY_TYPES))
            elif role == 'category' and values.get('displayType') not in COLUMN_DISPLAY_TYPES:
                issue(pointer + '/props/displayType', 'Declare native displayType from the source presentation; category alone does not require Tag',
                      node=name, allowedValues=list(COLUMN_DISPLAY_TYPES))
            reason = spec.get('nonStatusReason')
            if role != 'status' and state_like(values.get('dataIndex'), values.get('title')) and not (isinstance(reason, str) and reason.strip()):
                issue(pointer + '/role', STATE_LIKE, check='statusRole', node=name, field=values.get('dataIndex') or values.get('title'))
        if role == 'status' and component == 'plasmicantd6badge' and any(k in values for k in ('options', 'color', 'dot', 'count')):
            for message in status_badge_errors(values, False, planned=True):
                issue(pointer + '/props', message, node=name)
        if role in {'persistent-feedback', 'surface'} and not str(spec.get('condition', '')).strip():
            issue(pointer + '/condition', 'Declare the continuing condition or independently justified surface', node=name)
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
                if not badges or values.get('displayType') not in (None, 'custom'):
                    errors.append({'check': 'statusPresentation', 'node': name, 'message': 'Status Column requires its native Badge render template; Tag/text presets are not status presentation'})
                for badge in badges:
                    errors.extend({'check': 'statusPresentation', 'node': node_name(badge), 'message': message}
                                  for message in status_badge_errors(props(badge), True))
            elif key == 'plasmicantd6badge':
                errors.extend({'check': 'statusPresentation', 'node': name, 'message': message}
                              for message in status_badge_errors(values, False))
        if key == 'plasmicantd6tablecolumn' and role != 'status':
            reason = spec.get('nonStatusReason')
            title = content(slot(node, 'title')) or values.get('title')
            if state_like(values.get('dataIndex'), title) and not (isinstance(reason, str) and reason.strip()):
                errors.append({'check': 'statusRole', 'node': name, 'message': STATE_LIKE})
        errors.extend(category_errors(spec, node, plan.get('components', [])))
    for spec in plan.get('feedback', []):
        if not isinstance(spec, dict):
            continue
        matches = [n for n in nodes if node_name(n) == spec.get('nodeName')]
        if len(matches) != 1:
            errors.append({'check': 'feedback', 'node': spec.get('nodeName'), 'message': 'One real feedback event owner required'})
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


def check(expected, readback=None, page_path=None):
    errors = []
    templates = []
    content_reports = []
    plans = [(i, p) for i, p in enumerate(expected.get('pages', [])) if page_path is None or p.get('path') == page_path]
    if not plans:
        errors.append({'check': 'selectionPlan', 'message': 'Nonempty page inventory required'})
    for page_index, plan in plans:
        path = plan.get('path')
        template_report = verify_templates.check_page(plan)
        templates.append({'path': path, **template_report})
        errors.extend({'path': path, 'check': 'templateSource', 'pointer': f'/pages/{page_index}/templates', 'message': message} for message in template_report['errors'])
        if not isinstance(path, str) or not path.startswith('/'):
            errors.append({'check': 'selectionPlan', 'message': 'Every planned Page requires its exact absolute route before composition'})
        if readback is None:
            issues = plan_errors(plan) + verify_content.plan_errors(plan)
        else:
            pages = [p for p in readback.get('results', []) if p.get('type') == 'page' and p.get('pageMeta', {}).get('path') == path]
            issues = check_page(plan, pages[0]) if len(pages) == 1 else [{'check': 'selectionCoverage', 'message': 'One full Page readback required'}]
            if len(pages) == 1:
                reviewed = verify_content.check_page(plan, pages[0])
                content_reports.append({'path': path, **reviewed})
                issues += reviewed['errors']
        for error in issues:
            error = {'path': path, **error}
            if 'pointer' in error:
                error['pointer'] = f'/pages/{page_index}' + error['pointer']
                if 'relatedPointers' in error:
                    error['relatedPointers'] = [f'/pages/{page_index}' + p for p in error['relatedPointers']]
            errors.append(error)
    return {'passed': not errors, 'errors': errors, 'templates': templates, 'content': content_reports,
            'notChecked': ['source meaning and completeness', 'actual template insertion/detachment', 'JS execution', 'visual and runtime acceptance']}


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
    parser.add_argument('--full', action='store_true', help='Print the complete report even when --report saves it')
    args = parser.parse_args()
    inputs = {}
    try:
        for filename in (args.expectation, args.readback):
            if filename:
                inputs[filename] = json.loads(Path(filename).read_text(encoding='utf-8'))
        report = check(inputs[args.expectation], inputs.get(args.readback), args.page)
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
