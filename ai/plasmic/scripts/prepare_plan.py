#!/usr/bin/env python3
"""Mechanical helpers for the existing task-local selection/structure inventory.

No Desktop calls, business inference, runtime execution or source-evidence refresh.
Plan edits write a new file; semantic expectations still require source review.
"""
import argparse
from collections import Counter
import copy
import hashlib
import json
from pathlib import Path
import re
import shlex

from verify_component_policy import case_groups, source_text


def evidence(path, quote):
    path = Path(path).resolve()
    value = {'path': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'quote': quote}
    source_text(value)
    return value


def page_at(plan, route):
    pages = [page for page in plan['pages'] if page.get('path') == route]
    if len(pages) != 1:
        raise ValueError('Exactly one planned Page required for ' + route)
    return pages[0]


def cases(page):
    values = [case for _, group, _ in case_groups(page) for case in group]
    if any(not isinstance(case, dict) for case in values):
        raise ValueError('Runtime cases must be objects before preparing IDs')
    return values


def new_id(case, used):
    stem = re.sub(r'[^a-z0-9]+', '-', (str(case.get('nodeName', 'case')) + '-' + str(case.get('kind', 'case'))).lower()).strip('-') or 'case'
    index = 1
    while f'{stem}-{index}' in used:
        index += 1
    value = f'{stem}-{index}'
    used.add(value)
    return value


def assign_ids(plan):
    """Preserve existing unique IDs and the first occurrence of duplicates."""
    result, changes = copy.deepcopy(plan), 0
    for page in result['pages']:
        values = cases(page)
        used = {c['id'] for c in values if isinstance(c.get('id'), str) and c['id'].strip()}
        seen = set()
        for case in values:
            value = case.get('id')
            if not isinstance(value, str) or not value.strip() or value in seen:
                case['id'] = new_id(case, used)
                changes += 1
            seen.add(case['id'])
    return result, changes


def clone_actions(plan, route, source_owner, target_owner):
    result = copy.deepcopy(plan)
    page = page_at(result, route)
    owners = Counter(c['nodeName'] for c in page['components'] if c.get('role') == 'row-actions')
    if source_owner == target_owner or owners[source_owner] != 1 or owners[target_owner] != 1:
        raise ValueError('Source and target must be distinct declared row-actions owners')
    contracts = page.get('actionContracts', [])
    selected = [c for c in contracts if c.get('nodeName') == source_owner]
    if not selected or any(not isinstance(c.get('cases'), list) or not c.get('key') for c in selected):
        raise ValueError('Source owner needs action contracts with keys and case arrays')
    keys = [c['key'] for c in selected]
    if len(set(keys)) != len(keys) or set(keys) & {c.get('key') for c in contracts if c.get('nodeName') == target_owner}:
        raise ValueError('Duplicate/conflicting target action keys; review the existing contracts instead of overwriting')
    original = cases(page)
    ids = [c.get('id') for c in original]
    if any(not isinstance(value, str) or not value.strip() for value in ids) or len(set(ids)) != len(ids):
        raise ValueError('Prepare unique source case IDs before cloning actions')
    used = set(ids)
    for contract in copy.deepcopy(selected):
        contract['nodeName'] = target_owner
        for case in contract['cases']:
            # Only these native owner fields identify the cloned action. Fixture
            # values, quotes, selectors and other nodes must not be text-replaced.
            if case.get('nodeName') != source_owner:
                raise ValueError('Source action case must identify its native action owner')
            case['nodeName'] = target_owner
            case['id'] = new_id(case, used)
        contracts.append(contract)
    return result, len(selected)


def fragment(value, pointer):
    if pointer == '':
        return value
    if not pointer.startswith('/') or re.search(r'~(?![01])', pointer):
        raise ValueError('Use a JSON pointer beginning with /; escape ~ as ~0 and / as ~1')
    for part in pointer[1:].split('/'):
        key = part.replace('~1', '/').replace('~0', '~')
        if isinstance(value, list):
            if not re.fullmatch(r'0|[1-9][0-9]*', key):
                raise ValueError('JSON pointer array index must be a nonnegative integer')
            value = value[int(key)]
        else:
            value = value[key]
    return value


def write_new(path, value):
    with Path(path).open('x', encoding='utf-8') as output:
        json.dump(value, output, ensure_ascii=False, separators=(',', ':'))
        output.write('\n')


def example(directory):
    """A runnable input-format fixture, never a template/Preview acceptance."""
    directory = Path(directory).resolve()
    directory.mkdir()  # Refuse existing evidence/output directories.
    source = directory / 'source.md'
    scope = '格式示例：单页记录列表，不含独立工作应用维度。此文件不是业务需求。'
    query = '筛选项为关键词；查询按名称过滤，重置清空关键词并返回第一页。'
    paging = '初始匹配25条不同记录 REC-001 至 REC-025；默认每页20条，可切换50、100条。'
    status = '状态使用启用、停用；语义分别为成功、默认。'
    action = ('角色为 administrator（管理员）、operator（运营）、reader（只读）；三者均可查看授权市场记录的详情，'
              '只有 administrator 可停用 ACTIVE 记录。operator/reader 不可停用；任何角色不得访问未授权市场，'
              '缺失身份或授权范围不授予权限。停用必须二次确认；提交时按最新角色、授权市场和记录状态再检查。'
              '取消或拒绝保持原记录，确认允许后改为 INACTIVE；成功提示“已停用”，失败提示错误。')
    source.write_text('\n'.join((scope, query, paging, status, action)) + '\n', encoding='utf-8')
    ev = {key: evidence(source, quote) for key, quote in [('scope', scope), ('query', query), ('paging', paging), ('status', status), ('action', action)]}

    def component(name, registration, role, section, rule, **extra):
        return {'nodeName': name, 'component': registration, 'role': role, 'purpose': section,
                'source': f'{source}: {section}', 'rule': 'references/libraries/' + rule, **extra}

    def case(kind, owner, given, texts, **extra):
        return {'kind': kind, 'nodeName': owner, 'given': given,
                'checks': [{'kind': 'text', 'text': text, 'present': present} for text, present in texts], **extra}

    def action_case(kind, role, checks, market='MX', transition=None, **setup):
        return case(kind, 'RowActions', {
            'viewer': {'id': 'USER-001', 'role': role, 'authorizedMarkets': ['MX']},
            'records': [{'id': 'REC-001', 'market': market, 'status': 'ACTIVE'}],
            'recordId': 'REC-001', **setup}, [], checks=checks,
            **({'transition': transition} if transition is not None else {}))

    def button(label, count):
        return {'kind': 'count', 'role': 'button', 'name': label, 'count': count}

    def state_cell(label, count=1):
        return {'kind': 'count', 'role': 'cell', 'name': label, 'count': count}

    transition = {'from': 'ACTIVE', 'to': 'INACTIVE', 'text': '停用'}
    page = {'path': '/records', 'name': '记录列表', 'source': str(source), 'pageHeader': None,
        'pageType': 'list',
        'pageStructure': {
            'intent': 'Find records by name and act on an authorized record',
            'source': f'{source}: {query} {paging} No spatial arrangement is specified.',
            'layout': 'Filters above ListCard; row confirmation appears only after a disable action.',
            'rationale': 'Design inference: query then review results is sequential; a full-width list preserves column readability.',
            'regions': [{'nodeName': 'Filters', 'purpose': 'Apply the name query'},
                        {'nodeName': 'ListCard', 'purpose': 'Browse records and their row actions'},
                        {'nodeName': 'RowConfirm', 'purpose': 'Confirm a record disable operation on demand'}],
            'sizing': 'Both main regions fill the content width and grow with content; the main name column absorbs remaining width.',
            'scrolling': 'AppShell content owns vertical scrolling; the Table retains native horizontal overflow and reachable pagination.',
            'actions': 'Query/reset stay in Filters; view/disable stay in each record row; confirmation belongs to that row.'},
        'wireframe': {'notApplicable': 'Format fixture source is prose only; it contains no text wireframe.'},
        'templates': [], 'templatesNotApplicable': 'Local input-format fixture only; no prototype or template-composition acceptance. Do not copy this exemption into a business task.',
        'nodes': [{'nodeName': 'RowActionAnchor', 'tag': 'span',
                   'owner': {'nodeName': 'RowConfirm', 'slot': 'children'},
                   'purpose': 'DOM anchor for the native Popconfirm', 'source': str(source)}],
        'copy': {'source': str(source), 'excluded': [{'text': scope, 'source': str(source)}],
                 'entries': [{'nodeName': 'Keyword', 'at': '/props/label', 'text': '关键词',
                              'kind': 'label', 'purpose': 'Identify the name filter', 'source': str(source), 'role': 'fieldLabel'}]},
        'components': [
            component('Shell', 'plasmic-overseas-app-shell', 'shell', scope, 'overseas/components/app-shell.md'),
            component('PageBody', 'plasmic-antd6-flex', 'widget', scope, 'antd_v6/components/flex.md',
                      props={'vertical': True, 'gap': 16}, owner={'nodeName': 'Shell', 'slot': 'children'}),
            component('Filters', 'plasmic-overseas-search-form', 'query', query, 'overseas/components/search-form.md', props={'colSpan': 6, 'marginBottom': 0},
                      owner={'nodeName': 'PageBody', 'slot': 'children'}),
            component('ListCard', 'plasmic-antd6-card', 'surface', paging, 'antd_v6/components/card.md',
                      props={'variant': 'outlined', 'styles': {'body': {'padding': '16px 20px 0'}}},
                      header='none', condition='The record list is the Page\'s own business surface; the shell already names it.',
                      owner={'nodeName': 'PageBody', 'slot': 'children'}),
            component('Keyword', 'plasmic-overseas-search-form-item', 'widget', query, 'overseas/components/search-form.md', props={'name': 'keyword', 'label': '关键词'}, owner={'nodeName': 'Filters', 'slot': 'children'}),
            component('KeywordInput', 'plasmic-antd6-input', 'widget', query, 'antd_v6/components/input.md', owner={'nodeName': 'Keyword', 'slot': 'children'}),
            component('Results', 'plasmic-antd6-table', 'pagination', paging, 'antd_v6/components/table.md', props={'pagination': {'defaultPageSize': 20, 'pageSizeOptions': [20, 50, 100], 'showSizeChanger': True}, 'scroll': {'x': 468}},
                      owner={'nodeName': 'ListCard', 'slot': 'children'}),
            component('NameColumn', 'plasmic-antd6-table-column', 'widget', query, 'antd_v6/components/table.md', props={'dataIndex': 'name', 'width': None}, presentation='text', owner={'nodeName': 'Results', 'slot': 'children'}),
            component('StateColumn', 'plasmic-antd6-table-column', 'status', status, 'antd_v6/components/badge.md',
                      props={'dataIndex': 'status', 'width': 128}, presentation='custom',
                      statusMap={'ACTIVE': {'status': 'success', 'label': '启用'},
                                 'INACTIVE': {'status': 'default', 'label': '停用'}},
                      owner={'nodeName': 'Results', 'slot': 'children'}),
            component('StateBadge', 'plasmic-antd6-badge', 'status', status, 'antd_v6/components/badge.md',
                      props={'status': "{{ row.status === 'ACTIVE' ? 'success' : 'default' }}", 'text': '{{ row.statusLabel }}'},
                      dynamicProps=['status', 'text'], owner={'nodeName': 'StateColumn', 'slot': 'render'}),
            component('ActionColumn', 'plasmic-antd6-table-column', 'widget', action, 'react_ui/components/action-group.md', props={'fixed': 'right', 'width': 100}, presentation='custom', owner={'nodeName': 'Results', 'slot': 'children'}),
            component('RowConfirm', 'plasmic-antd6-popconfirm', 'confirmation', action, 'antd_v6/components/popconfirm.md',
                      props={'title': '确认停用该记录？', 'okText': '停用', 'cancelText': '取消', 'okButtonProps': {'danger': True}},
                      dynamicProps=['open'], owner={'nodeName': 'ActionColumn', 'slot': 'render'}),
            component('RowActions', 'plasmic-react-ui-action-group', 'row-actions', action, 'react_ui/components/action-group.md', props={'max': 3}, owner={'nodeName': 'RowConfirm', 'slot': 'children'})],
        'bindings': [{'nodeName': 'Results', 'source': str(source), 'dynamicProps': ['data'], 'props': ['data'], 'propStateDependencies': {'data': ['rows', 'appliedFilters', 'viewer']}},
                     {'nodeName': 'Filters', 'source': str(source), 'events': ['onSearch', 'onReset']},
                     {'nodeName': 'RowActions', 'source': str(source), 'dynamicProps': ['items'],
                      'propStateDependencies': {'items': ['viewer']}, 'events': ['onAction']},
                     {'nodeName': 'RowConfirm', 'source': str(source), 'dynamicProps': ['open'],
                      'propStateDependencies': {'open': ['pendingAction']}, 'events': ['onConfirm', 'onCancel', 'onOpenChange']}],
        'rowActions': [{'column': 'ActionColumn', 'control': 'RowActions', 'event': 'onAction', 'source': str(source)}],
        'feedback': [{'nodeName': 'RowConfirm', 'event': 'onConfirm', 'kind': 'transient', 'source': str(source),
                      'success': 'Confirmed row changes to 停用; one 已停用 Message appears then dismisses',
                      'failure': 'Row unchanged; one error Message appears then dismisses'}],
        'appContext': {'required': False, 'evidence': ev['scope']},
        'runtimeCases': [
            case('query', 'Filters', {'keyword': 'REC-025', 'submit': True}, [('REC-025', True), ('REC-001', False)], evidence=ev['query']),
            case('reset', 'Filters', {'keyword': 'REC-025', 'reset': True}, [('REC-001', True)], evidence=ev['query'])],
        'actionContracts': [{'nodeName': 'RowActions', 'key': 'disable', 'evidence': ev['action'], 'confirm': True,
            'transitions': [transition], 'cases': [
                action_case('permission-allowed', 'administrator', [button('停用', 1), state_cell('启用')]),
                *[action_case('permission-denied', role, [button('停用', 0), state_cell('启用')])
                  for role in ('operator', 'reader')],
                action_case('permission-denied', 'administrator', [button('停用', 0),
                    {'kind': 'text', 'text': 'REC-001', 'present': False}], market='VN'),
                action_case('confirm-cancel', 'administrator', [state_cell('启用'), state_cell('停用', 0),
                    {'kind': 'text', 'text': '已停用', 'present': False}], decision='cancel'),
                action_case('confirm-accept', 'administrator', [state_cell('停用'), state_cell('启用', 0),
                    {'kind': 'text', 'text': '已停用', 'present': True}], decision='accept'),
                action_case('state-transition', 'administrator', [state_cell('停用'),
                    {'kind': 'text', 'text': '停用', 'present': True}], decision='accept', transition=transition)]},
            {'nodeName': 'RowActions', 'key': 'view', 'evidence': ev['action'], 'confirm': False,
             'transitions': [], 'cases': [
                *[action_case('permission-allowed', role, [button('详情', 1),
                    {'kind': 'text', 'text': 'REC-001', 'present': True}])
                  for role in ('administrator', 'operator', 'reader')],
                action_case('permission-denied', 'administrator', [button('详情', 0),
                    {'kind': 'text', 'text': 'REC-001', 'present': False}], market='VN')]}]}
    plan, _ = assign_ids({'pages': [page]})
    from verify_selection import check
    report = check(plan)
    if not report['passed']:
        raise ValueError('Bundled example failed the real selection preflight: ' + json.dumps(report['errors'], ensure_ascii=False))
    path = directory / 'structure-expectation.json'
    write_new(path, plan)
    return path


READING_BUDGET_BYTES = 98304  # UTF-8 bytes; not a model token/context limit


from rules_manifest import hard_constraints  # noqa: E402  (shared with the rule review)


def decided_values(page):
    """Every manifest decision of the Page with its current plan value, for the card digest."""
    from rules_manifest import decision_rule, decisions_for
    from verify_selection import MISSING, prop_value
    values = []
    for spec in page.get('components', []):
        if not isinstance(spec, dict):
            continue
        props = spec.get('props') if isinstance(spec.get('props'), dict) else {}
        for item in decisions_for(spec.get('component', '')):
            value = spec.get(item['prop'], MISSING) if item.get('target') == 'spec' else prop_value(props, item['prop'])
            values.append({'node': spec.get('nodeName'), 'prop': item['prop'],
                           'value': 'MISSING' if value is MISSING else value,
                           'rule': decision_rule(spec['component'], item)})
    return values


def card_reads(needed, ledger):
    """Reader commands, byte counts and hard constraints for a {path: anchors} selection."""
    from read_reference import select
    from verify_selection import RESOURCE_ROOT
    reads, total, constraints = [], 0, []
    for path, anchors in sorted(needed.items()):
        absolute = RESOURCE_ROOT / path
        command = ['python3', str(RESOURCE_ROOT / 'scripts/read_reference.py'), str(absolute)]
        for anchor in sorted(anchors or ()):
            command += ['--section', anchor]
        command += ['--log', str(Path(ledger).resolve())]
        content = absolute.read_text(encoding='utf-8')
        size = len((select(content, sorted(anchors)) if anchors else content).encode())
        total += size
        items = hard_constraints(content)
        if items:
            constraints.append({'rule': path, 'constraints': items})
        reads.append({'rule': path, 'sections': sorted(anchors) if anchors is not None else 'full', 'bytes': size,
                      'command': ' '.join(shlex.quote(part) for part in command), 'args': command})
    return reads, total, constraints


def project_rules(ledger, stage='compose', plan=None):
    """Project card: shared design rules read once per task and reviewed once per project;
    with the plan, also the task-wide rules its Pages need (record context, permissions)."""
    from verify_selection import project_reads
    reads, total, constraints = card_reads(project_reads(stage, plan), ledger)
    follow = ('read once before the first Page compose card; verify_selection.py --reads checks them with every Page'
              if stage == 'compose' else
              'record static findings in the checkpoint; complete project rule verdicts after required Preview/persistence checks (review-mode.md#rule-review)')
    return {'scope': 'project', 'stage': stage, 'totalBytes': total, 'hardConstraints': constraints, 'reads': reads,
            'next': 'Run every command; ' + follow}


def review_skeleton(plan, capture, mode, page_path=None):
    """Rule review file with every accept-card rule and hard constraint pending ("__DECIDE__").

    Mechanical only: it binds checkedState to the capture and lists what needs a
    verdict; the reviewer replaces every pending verdict with an observed one.
    """
    from rules_manifest import PENDING, RESOURCE_ROOT
    from verify_selection import project_reads, required_reads
    from verify_review import STATE_KEYS, plan_digest, rule_digest, valid_state
    if mode not in ('independent', 'fallback'):
        raise ValueError('mode is independent or fallback')
    after = capture.get('after') if isinstance(capture, dict) else None
    if not valid_state(after):
        raise ValueError('Use the final verify_all capture.json; its after identity binds the review')
    if capture.get('pagePath') is not None and capture['pagePath'] != page_path:
        raise ValueError('Capture Page scope must match the review; a scoped capture cannot establish full-project review')
    pages = [page_at(plan, page_path)] if page_path is not None else plan.get('pages', [])
    if not pages:
        raise ValueError('Review at least one planned Page')

    def entry(rule):
        item = {'rule': rule, 'sha256': rule_digest(rule), 'verdict': PENDING, 'evidence': []}
        found = hard_constraints((RESOURCE_ROOT / rule).read_text(encoding='utf-8'))
        if found:
            item['constraints'] = [{'constraint': text, 'verdict': PENDING, 'evidence': []} for text in found]
        return item
    review = {'reviewMode': mode, ('reviewer' if mode == 'independent' else 'fallbackReason'): PENDING,
              'checkedState': {key: after[key] for key in STATE_KEYS},
              'checkedPlanSha256': plan_digest(plan),
              'project': {'rules': [entry(rule) for rule in sorted(project_reads('accept', plan))]},
              'pages': [{'path': page.get('path'), 'rules': [entry(rule) for rule in sorted(required_reads(page, 'accept', plan))]}
                        for page in pages]}
    return review


def rules(plan, route, ledger, stage='compose'):
    """Per-Page reading card: the Page's hard constraints and decided values first, then
    exact reader commands for every required section."""
    from verify_selection import required_reads
    page = page_at(plan, route)
    reads, total, constraints = card_reads(required_reads(page, stage, plan), ledger)
    follow = ('verify_selection.py PLAN --page ' + route + ' --reads ' + str(Path(ledger).resolve())
              if stage == 'compose' else
              'record static findings and pending runtime/persistence checks in the checkpoint; complete rule verdicts after those checks (review-mode.md#rule-review)')
    # A byte budget signals context pressure, not host delegation/compaction capability.
    budget_exceeded = total > READING_BUDGET_BYTES
    steps = ('Run this card on the scaffolded plan before deciding: decide every "__DECIDE__" value from the delivered '
             'Plan decisions rows and hard constraints, then check every hardConstraints item against the plan and its '
             'decisions values; a constraint without a matching decision or plan entry is a plan defect to fix before markup. '
             if stage == 'compose' else
             'Assess each hard constraint using its required evidence; saved models/pixels cannot prove runtime behavior. '
             'After execution, record one constraint verdict per item inside its final rule verdict. ')
    if budget_exceeded:
        steps += ('This card exceeds the reading budget; readingBudgetExceeded is a context-pressure signal, not a host-capability guarantee. '
                  'Use a verified fresh-context handoff or client-supported compaction when available '
                  '(workflows/prototype.md#complete-one-page-at-a-time). Otherwise read sections sequentially with disk checkpoints, '
                  'without claiming a fresh context or skipping rules. If actual context capacity is insufficient, checkpoint '
                  'at the current Page boundary and report the remaining reads/checks before further composition or acceptance. ')
    # Digest first: small, decisive and read before the long sections.
    return {'page': route, 'stage': stage, 'readingBudgetExceeded': budget_exceeded, 'totalBytes': total,
            'pageStructure': page.get('pageStructure', 'MISSING'),
            'hardConstraints': constraints, 'decisions': decided_values(page), 'reads': reads,
            'next': steps + 'Run every command, apply each document\'s hard constraints and decision rows, then ' + follow}


# Controls that do not fill a Form.Item by default and need an explicit width:100%.
SKELETON_WIDTH = {'plasmicantd6datepicker', 'plasmicantd6daterangepicker', 'plasmicantd6rangepicker',
                  'plasmicantd6timepicker', 'plasmicantd6timerangepicker', 'plasmicantd6inputnumber'}


def form_skeleton(plan, inventory, route, form_name):
    """insertHtml markup for one decided Page Form: one Row, one Col per field, one Item per Col.

    Built from the decided plan and the independent field inventory, so the
    output satisfies form-layout.md#page-form-structure by construction. It
    does not add bindings, events, data or field help beyond the inventory.
    """
    from html import escape
    from plan_inventories import PagePlan
    from verify_selection import norm, pending_pointers
    attr = lambda value: escape(json.dumps(value, ensure_ascii=False, separators=(',', ':')), quote=True)
    page = page_at(plan, route)
    graph = PagePlan(page)
    entries = [p for p in inventory.get('pages', []) if p.get('path') == route]
    forms = [f for p in entries for f in p.get('forms', []) if f.get('name') == form_name]
    if len(entries) != 1 or len(forms) != 1:
        raise ValueError(f'Expected one inventoried Form {form_name} on {route}')
    form = forms[0]
    specs = {c['nodeName']: c for c in page.get('components', []) if isinstance(c, dict) and isinstance(c.get('nodeName'), str)}
    form_spec = specs.get(form_name)
    if not form_spec or norm(form_spec.get('component', '')) != 'plasmicantd6form':
        raise ValueError(f'Declare {form_name} as plasmic-antd6-form in the Page plan')
    props = {k: v for k, v in copy.deepcopy(form_spec.get('props') or {}).items() if v is not None}
    if any(True for _ in pending_pointers(props)):
        raise ValueError(f'Decide every {form_name} prop before generating its skeleton')
    if props.setdefault('mode', 'advanced') != 'advanced':
        raise ValueError('Form.Item children require mode advanced')
    layout = copy.deepcopy(form.get('layout'))
    if isinstance(layout, dict) and isinstance(layout.get('container'), list):
        if len(layout['container']) == 1:
            layout['container'] = layout['container'][0]
        else:
            raise ValueError('form-skeleton writes one Row; for a grouped Form, write each group Card with its own Row in the same structure')
    if not isinstance(layout, dict) or not isinstance(layout.get('container'), str) or layout.get('columns') not in (1, 2, 3, 4):
        raise ValueError('Record layout {container, columns, gutter} in the field inventory first; see form-layout.md#page-form-structure')
    columns, gutter = layout['columns'], layout.get('gutter', 16)
    width = form.get('labelWidth')
    if form.get('formLayout') == 'horizontal' and isinstance(width, dict):
        # First composition starts from the planning estimate; after rendering, the measured width wins.
        key = next((k for k in ('measuredPx', 'estimatedPx') if isinstance(width.get(k), (int, float))), None)
        if key and props.get('labelCol') != {'flex': f"{int(width[key])}px"}:
            raise ValueError(f"Plan labelCol must be {{\"flex\": \"{int(width[key])}px\"}} to match labelWidth.{key}")
    def planned_slots(name, trail=()):
        slots = {}
        for child in graph.children(name):
            slots.setdefault(graph.owner(child)[1] or 'children', []).append(render(child, trail))
        return {slot: ''.join(children) for slot, children in slots.items()}

    def render(name, trail=()):
        if name in trail:
            raise ValueError(f'Cyclic Form ownership at {name}')
        trail = (*trail, name)
        if name in graph.node_by_name:
            node = graph.node_by_name[name]
            tag = node.get('tag', 'span')
            if not isinstance(tag, str) or not re.fullmatch(r'[a-z][a-z0-9]*', tag):
                raise ValueError(f'Invalid planned tag for {name}')
            body = escape(graph.text.get(name, '')) + ''.join(render(c, trail) for c in graph.children(name))
            return f'<{tag} data-plasmic-name="{escape(name)}">{body}</{tag}>'
        spec = specs[name]
        values = {k: v for k, v in (spec.get('props') or {}).items() if v is not None}
        if any(True for _ in pending_pointers(values)):
            raise ValueError(f'Decide every prop of {name} first')
        body = ''.join(f'<slot name="{escape(slot)}">{value}</slot>' for slot, value in planned_slots(name, trail).items())
        style = ' style="width:100%"' if norm(spec['component']) in SKELETON_WIDTH else ''
        return (f'<plasmic-component data-plasmic-name="{escape(name)}" '
                f'data-plasmic-component="{escape(spec["component"])}" data-props="{attr(values)}"{style}>{body}</plasmic-component>')

    used = set(specs) | set(graph.node_by_name)
    cols = []
    for field in form.get('fields', []):
        control = specs.get(field.get('control'))
        if not control:
            raise ValueError(f"Declare control {field.get('control')} in the Page plan")
        item_spec = specs.get(field['nodeName'], {})
        item_props = {k: v for k, v in copy.deepcopy(item_spec.get('props') or {}).items() if v is not None}
        item_props['name'] = field['name']
        if field.get('rules') and 'rules' not in item_props:
            item_props['rules'] = field['rules']
        control_props = {k: v for k, v in (control.get('props') or {}).items() if v is not None}
        if any(True for _ in pending_pointers([item_props, control_props])):
            raise ValueError(f"Decide every prop of {field['nodeName']} and {field['control']} first")
        contents = planned_slots(field['nodeName'])
        contents.setdefault('label', f'<span>{escape(field["label"])}</span>')
        contents.setdefault('children', render(field['control']))
        contents.setdefault('tooltip', f'<span>{escape(field["tooltip"])}</span>' if field.get('tooltip') else '')
        if field.get('description') and field.get('descriptionPlacement', 'below') == 'below':
            contents.setdefault('description', f'<span>{escape(field["description"])}</span>')
        slots = ''.join(f'<slot name="{escape(slot)}">{value}</slot>' for slot, value in contents.items())
        item = (f'<plasmic-component data-plasmic-name="{escape(field["nodeName"])}" data-plasmic-component="plasmic-antd6-form-item" '
                f'data-props="{attr(item_props)}">{slots}</plasmic-component>')
        span = 24 if field.get('span', 1) == columns else 24 // columns
        name, owner_slot = graph.owner(field['nodeName'])
        col_props = {}
        if name:
            if (graph.kind(name) != 'plasmicantd6col' or owner_slot != 'children'
                    or graph.owner(name) != (layout['container'], 'children')):
                raise ValueError(f"{field['nodeName']} must belong to a declared Col in {layout['container']}")
            col_props = {k: v for k, v in graph.props(name).items() if v is not None}
            if col_props.get('span', span) != span:
                raise ValueError(f'Planned span for {name} differs from the field inventory')
        else:
            stem = re.sub(r'(Item|Field)$', '', field['nodeName']) or field['nodeName']
            name, index = stem + 'Col', 2
            while name in used:
                name, index = f'{stem}Col{index}', index + 1
            used.add(name)
        col_props['span'] = span
        cols.append(f'<plasmic-component data-plasmic-name="{escape(name)}" data-plasmic-component="plasmic-antd6-col" '
                    f'data-props="{attr(col_props)}"><slot name="children">{item}</slot></plasmic-component>')
    row_props = {k: v for k, v in graph.props(layout['container']).items() if v is not None}
    row_props.update(gutter=gutter, wrap=True)
    row = (f'<plasmic-component data-plasmic-name="{escape(layout["container"])}" data-plasmic-component="plasmic-antd6-row" '
           f'data-props="{attr(row_props)}" style="align-self:stretch;max-width:none;min-width:0">'
           f'<slot name="children">{"".join(cols)}</slot></plasmic-component>')
    # Padding 0: the Card body owns the 24px inset (form-layout.md#page-form-structure).
    return (f'<plasmic-component data-plasmic-name="{escape(form_name)}" data-plasmic-component="plasmic-antd6-form" '
            f'data-props="{attr(props)}" style="width:100%;padding:0"><slot name="children">{row}</slot></plasmic-component>')


def label_widths(plan, route):
    """Planning labelCol for each horizontal Page Form from its labels (form-layout.md#columns-and-label-width)."""
    from plan_inventories import form_inventory
    page = page_at(plan, route)
    forms = form_inventory({'pages': [page]})['pages'][0]['forms']
    result = []
    for form in forms:
        width = form.get('labelWidth')
        if isinstance(width, dict):
            estimate = width.get('estimatedPx')
            result.append({'form': form['name'], 'longestLabel': width.get('longestLabel'), 'estimatedPx': estimate,
                           'labelCol': {'flex': f'{estimate}px'} if isinstance(estimate, int) else None})
    return {'page': route, 'forms': result,
            'next': 'Set each Form labelCol to this estimate before markup; after the first render measure the longest label '
                    'with snapshot_layout, record measuredPx and measuredFrom in the Form inventory, and update labelCol in the '
                    'plan and model when they differ.'}


def write_inventories(plan, plan_path, directory, reads_path, page_path=None):
    """Write the gate inventories, Slot intents and suite.json derived from the plan into a new directory."""
    import os
    from plan_inventories import (descriptions_inventory, form_inventory, overlay_inventory, pending_count,
                                  route_slug, slot_intent)
    if page_path is not None:
        plan = {**plan, 'pages': [page_at(plan, page_path)]}
    reads_path = Path(reads_path).resolve()
    if not reads_path.is_file():
        raise ValueError('Use --reads with the existing compose ledger used by selection preflight')
    directory = Path(directory).resolve()
    directory.mkdir()  # Refuse to overwrite reviewed inventories.
    (directory / 'intents').mkdir()
    files = {'forms-inventory.json': form_inventory(plan),
             'description-inventory.json': descriptions_inventory(plan),
             'overlay-inventory.json': overlay_inventory(plan)}
    for name, value in files.items():
        write_new(directory / name, value)
    intents = []
    for page in plan.get('pages', []):
        path = directory / 'intents' / f"{route_slug(page.get('path', ''))}.html"
        with path.open('x', encoding='utf-8') as output:
            output.write(slot_intent(page) + '\n')
        intents.append({'path': page.get('path'), 'intent': f'intents/{path.name}'})
    suite = {'structure': {'inventory': Path(os.path.relpath(Path(plan_path).resolve(), directory)).as_posix(),
                           'reads': Path(os.path.relpath(reads_path, directory)).as_posix()},
             'page_layout': {},
             'forms': {'inventory': 'forms-inventory.json'},
             'descriptions': {'inventory': 'description-inventory.json'},
             'overlays': {'inventory': 'overlay-inventory.json'},
             'slots': {'pages': intents},
             'shell_height': {},
             'review': {'ledger': 'accept-reads.jsonl', 'results': 'rule-review.json'}}
    write_new(directory / 'suite.json', suite)
    pending = {name: pending_count(value) for name, value in files.items()}
    return {'output': str(directory), 'pendingDecisions': pending,
            'next': 'Decide every "__DECIDE__" (rendered label measurements with their layout capture, standalone-control '
                    'reasons, footer action effects) from the source and measurements; change the plan, not these drafts, '
                    'for any other difference, then re-derive. The suite retains the supplied compose ledger in structure.reads. '
                    'Add references to suite.json only when Pen sources were supplied.'}


def set_path(values, path, value):
    keys = path.split('.')
    for key in keys[:-1]:
        values = values.setdefault(key, {})
        if not isinstance(values, dict):
            raise ValueError('Cannot scaffold nested decision under a non-object prop: ' + path)
    values.setdefault(keys[-1], value)


def scaffold(minimal, page_path=None):
    """Add rule owners, baselines and "__DECIDE__" slots; never business values."""
    from rules_manifest import PENDING, decisions_for, document_for, manifest
    result = copy.deepcopy(minimal)
    if not isinstance(result.get('pages'), list) or not result['pages']:
        raise ValueError('Minimal plan needs pages:[{path, components:[...]}]')
    if page_path is not None:
        page_at(result, page_path)  # Reject missing/ambiguous targets before writing.
    for page in result['pages']:
        if page_path is not None and page.get('path') != page_path:
            continue
        if not isinstance(page.get('path'), str) or not page['path'].startswith('/'):
            raise ValueError('Every Page needs its exact absolute route path')
        components = page.get('components')
        if not isinstance(components, list) or not components:
            raise ValueError(page['path'] + ': list the planned functional instances in components')
        for spec in components:
            if not isinstance(spec, dict) or not all(isinstance(spec.get(k), str) and spec[k].strip() for k in ('nodeName', 'component', 'role')):
                raise ValueError(page['path'] + ': each component needs nodeName, component and role')
            owner = document_for(spec['component'])
            if 'rule' not in spec:
                if not owner:
                    raise ValueError(f"{spec['nodeName']}: no rule owner for {spec['component']}; supply rule explicitly")
                spec['rule'] = owner
            for key in ('purpose', 'source'):
                spec.setdefault(key, PENDING)
            if spec['role'] in ('surface', 'persistent-feedback'):
                spec.setdefault('condition', PENDING)
            props = spec.setdefault('props', {})
            for item in decisions_for(spec['component']):
                if item.get('target') == 'spec':
                    # Plan field outside native props, e.g. Card header.
                    spec.setdefault(item['prop'], item.get('baseline', PENDING))
                else:
                    set_path(props, item['prop'], item.get('baseline', PENDING))
        roles = {spec['role'] for spec in components}
        for key in manifest()['pageDecisions']:
            if key == 'appContext' and 'shell' not in roles or key in ('rowActions', 'actionContracts') and 'row-actions' not in roles:
                continue
            page.setdefault(key, PENDING)
    from verify_selection import pending_pointers
    pending = sum(1 for _ in pending_pointers(result))
    return result, pending


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    card = commands.add_parser('rules', help='List the reference sections a Page (or, with --project, the whole task) requires, with reader commands')
    card.add_argument('plan', type=Path, nargs='?')
    scope = card.add_mutually_exclusive_group(required=True)
    scope.add_argument('--page')
    scope.add_argument('--project', action='store_true', help='Shared design rules read once per task and reviewed once per project')
    card.add_argument('--ledger', type=Path, required=True)
    card.add_argument('--stage', choices=('compose', 'accept'), default='compose')
    build = commands.add_parser('scaffold', help='Add rule owners, baselines and __DECIDE__ slots to a minimal declaration list')
    build.add_argument('--page', help='Scaffold only this Page; retain sibling structure drafts unchanged')
    build.add_argument('plan', type=Path)
    build.add_argument('--output', type=Path, required=True)
    demo = commands.add_parser('example', help='Write a runnable format fixture into a new local directory')
    demo.add_argument('directory', type=Path)
    ev = commands.add_parser('evidence', help='Emit a native file hash and verified exact quote')
    ev.add_argument('source', type=Path)
    ev.add_argument('--quote', required=True)
    ids = commands.add_parser('ids', help='Fill missing/duplicate IDs without changing business expectations')
    ids.add_argument('plan', type=Path)
    ids.add_argument('--output', type=Path, required=True)
    clone = commands.add_parser('clone-actions', help='Copy reviewed action rules to another existing owner')
    clone.add_argument('plan', type=Path)
    clone.add_argument('--page', required=True)
    clone.add_argument('--from-owner', required=True)
    clone.add_argument('--to-owner', required=True)
    clone.add_argument('--output', type=Path, required=True)
    skeleton = commands.add_parser('form-skeleton', help='Write insertHtml markup for a decided Page Form: one Row of Cols, one Item per Col')
    skeleton.add_argument('plan', type=Path)
    skeleton.add_argument('--inventory', type=Path, required=True, help='Independent field inventory with the Form layout')
    skeleton.add_argument('--page', required=True)
    skeleton.add_argument('--form', required=True)
    skeleton.add_argument('--output', type=Path, required=True)
    widths = commands.add_parser('label-width', help='Planning labelCol estimate for each horizontal Page Form of a Page')
    widths.add_argument('plan', type=Path)
    widths.add_argument('--page', required=True)
    review = commands.add_parser('review-skeleton', help='Write the rule review file with every accept-card rule and hard constraint pending')
    review.add_argument('plan', type=Path)
    review.add_argument('--page', help='Review shared project rules and only this Page; retain the complete plan digest')
    review.add_argument('--capture', type=Path, required=True, help='Final verify_all capture.json of the reviewed saved model')
    review.add_argument('--mode', choices=('independent', 'fallback'), required=True)
    review.add_argument('--output', type=Path, required=True)
    derive = commands.add_parser('inventories', help='Derive Form/Descriptions/overlay inventories, Slot intents and suite.json from the plan')
    derive.add_argument('--page', help='Derive only this Page; use scoped verification until all Pages are ready')
    derive.add_argument('plan', type=Path)
    derive.add_argument('--output-dir', type=Path, required=True)
    derive.add_argument('--reads', type=Path, required=True, help='Existing compose ledger used by selection preflight; retained in suite.structure.reads')
    show = commands.add_parser('show', help='Read only one JSON-pointer fragment from a plan/report')
    show.add_argument('file', type=Path)
    show.add_argument('--pointer', required=True)
    runtime = commands.add_parser('runtime-manifest', help='Prepare the existing runtime evidence index; all cases start unexecuted')
    runtime.add_argument('plan', type=Path)
    runtime.add_argument('--capture', type=Path, required=True)
    runtime.add_argument('--pages', type=Path, required=True)
    runtime.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    try:
        if args.command == 'example':
            result = {'plan': str(example(args.directory)), 'preflight': 'passed', 'runtimeAcceptance': 'unverified'}
        elif args.command == 'evidence':
            result = evidence(args.source, args.quote)
        elif args.command == 'rules':
            if args.project:
                result = project_rules(args.ledger, args.stage,
                                       json.loads(args.plan.read_text(encoding='utf-8')) if args.plan else None)
            elif args.plan is None:
                raise ValueError('A Page card needs the plan file')
            else:
                result = rules(json.loads(args.plan.read_text(encoding='utf-8')), args.page, args.ledger, args.stage)
            for read in result['reads']:
                read.pop('args')
        elif args.command == 'scaffold':
            plan, pending = scaffold(json.loads(args.plan.read_text(encoding='utf-8')), args.page)
            write_new(args.output, plan)
            result = {'output': str(args.output.resolve()), 'pendingDecisions': pending,
                      'next': 'Run rules PLAN --project once per task and rules PLAN --page ROUTE --stage compose on this scaffold; '
                              'replace every "__DECIDE__" from the source and the delivered Plan decisions rows, then run '
                              'verify_selection.py --page ROUTE --reads LEDGER'}
        elif args.command == 'show':
            result = fragment(json.loads(args.file.read_text(encoding='utf-8')), args.pointer)
        elif args.command == 'form-skeleton':
            markup = form_skeleton(json.loads(args.plan.read_text(encoding='utf-8')),
                                   json.loads(args.inventory.read_text(encoding='utf-8')), args.page, args.form)
            with args.output.open('x', encoding='utf-8') as output:
                output.write(markup + '\n')
            result = {'output': str(args.output.resolve()), 'bytes': len(markup.encode()),
                      'next': 'Insert this markup at the Form owner Slot with insertHtml; add bindings, events and field help '
                              'from the plan, then save and run verify_forms.py. Fix the plan or inventory, not the markup, '
                              'when the structure must change.'}
        elif args.command == 'label-width':
            result = label_widths(json.loads(args.plan.read_text(encoding='utf-8')), args.page)
        elif args.command == 'review-skeleton':
            skeleton = review_skeleton(json.loads(args.plan.read_text(encoding='utf-8')),
                                       json.loads(args.capture.read_text(encoding='utf-8')), args.mode, args.page)
            write_new(args.output, skeleton)
            from verify_selection import pending_pointers
            result = {'output': str(args.output.resolve()), 'pendingVerdicts': sum(1 for _ in pending_pointers(skeleton)),
                      'next': 'After applicable static, Preview and persistence checks, run the accept cards and replace every "__DECIDE__" with its verdict, evidence, '
                              'reason or finding; validate with verify_review.py --capture and the same --page scope. '
                              'For full-project acceptance configure suite review {ledger, results} and rerun verify_all.py'}
        elif args.command == 'inventories':
            result = write_inventories(json.loads(args.plan.read_text(encoding='utf-8')), args.plan, args.output_dir, args.reads, args.page)
        elif args.command == 'runtime-manifest':
            from verify_runtime import make_manifest
            raw = {name: getattr(args, name).read_bytes() for name in ('plan', 'capture', 'pages')}
            manifest = make_manifest(json.loads(raw['plan']), json.loads(raw['capture']),
                                     hashlib.sha256(raw['plan']).hexdigest(), hashlib.sha256(raw['pages']).hexdigest())
            if any(getattr(args, name).read_bytes() != data for name, data in raw.items()):
                raise ValueError('Plan or capture changed during preparation')
            write_new(args.output, manifest)
            result = {'output': str(args.output.resolve()), 'caseCount': len(manifest['cases']),
                      'runtimeAcceptance': 'unverified',
                      'next': 'Execute planned Preview cases; replace each null assertLine with its actual trace line, then run verify_runtime.py'}
        else:
            plan = json.loads(args.plan.read_text(encoding='utf-8'))
            if args.command == 'ids':
                result, count = assign_ids(plan)
            else:
                result, count = clone_actions(plan, args.page, args.from_owner, args.to_owner)
            write_new(args.output, result)
            result = {'output': str(args.output.resolve()), 'changedIDs' if args.command == 'ids' else 'clonedActions': count,
                      'reviewRequired': 'Review source, target fixtures/selectors and business expectations; rerun selection preflight before composition'}
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except (OSError, ValueError, KeyError, IndexError, TypeError) as error:
        parser.exit(1, f'{error}\n')


if __name__ == '__main__':
    main()
