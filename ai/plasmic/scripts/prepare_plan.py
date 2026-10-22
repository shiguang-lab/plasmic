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
    paging = '初始匹配25条不同记录 REC-001 至 REC-025；默认每页20条，可切换50条。'
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
        'templates': [], 'templatesNotApplicable': 'Local input-format fixture only; no prototype or template-composition acceptance. Do not copy this exemption into a business task.',
        'nodes': [],
        'copy': {'source': str(source), 'excluded': [{'text': scope, 'source': str(source)}],
                 'entries': [{'nodeName': 'Keyword', 'at': '/props/label', 'text': '关键词',
                              'kind': 'label', 'purpose': 'Identify the name filter', 'source': str(source)}]},
        'components': [
            component('Shell', 'plasmic-overseas-app-shell', 'shell', scope, 'overseas/components/app-shell.md'),
            component('Filters', 'plasmic-overseas-search-form', 'query', query, 'overseas/components/search-form.md', props={'colSpan': 6}),
            component('Keyword', 'plasmic-overseas-search-form-item', 'widget', query, 'overseas/components/search-form.md', props={'name': 'keyword', 'label': '关键词'}, owner={'nodeName': 'Filters', 'slot': 'children'}),
            component('KeywordInput', 'plasmic-antd6-input', 'widget', query, 'antd_v6/components/input.md', owner={'nodeName': 'Keyword', 'slot': 'children'}),
            component('Results', 'plasmic-antd6-table', 'pagination', paging, 'antd_v6/components/table.md', props={'pagination': {'defaultPageSize': 20, 'pageSizeOptions': [20, 50], 'showSizeChanger': True}}),
            component('NameColumn', 'plasmic-antd6-table-column', 'widget', query, 'antd_v6/components/table.md', props={'dataIndex': 'name'}, owner={'nodeName': 'Results', 'slot': 'children'}),
            component('StateColumn', 'plasmic-antd6-table-column', 'status', status, 'antd_v6/components/badge.md', props={'dataIndex': 'status', 'displayType': 'custom'}, owner={'nodeName': 'Results', 'slot': 'children'}),
            component('StateBadge', 'plasmic-antd6-badge', 'status', status, 'antd_v6/components/badge.md',
                      props={'options': [{'value': 'ACTIVE', 'label': '启用', 'status': 'success'},
                                         {'value': 'INACTIVE', 'label': '停用', 'status': 'default'}]},
                      dynamicProps=['value'], owner={'nodeName': 'StateColumn', 'slot': 'render'}),
            component('ActionColumn', 'plasmic-antd6-table-column', 'widget', action, 'react_ui/components/action-group.md', props={'fixed': 'right', 'width': 100}, owner={'nodeName': 'Results', 'slot': 'children'}),
            component('RowActions', 'plasmic-react-ui-action-group', 'row-actions', action, 'react_ui/components/action-group.md', owner={'nodeName': 'ActionColumn', 'slot': 'render'})],
        'bindings': [{'nodeName': 'Results', 'source': str(source), 'dynamicProps': ['data'], 'props': ['data'], 'propStateDependencies': {'data': ['rows', 'appliedFilters', 'viewer']}},
                     {'nodeName': 'Filters', 'source': str(source), 'events': ['onSearch', 'onReset']},
                     {'nodeName': 'RowActions', 'source': str(source), 'dynamicProps': ['items'],
                      'propStateDependencies': {'items': ['viewer']}, 'events': ['onAction']}],
        'rowActions': [{'column': 'ActionColumn', 'control': 'RowActions', 'event': 'onAction', 'source': str(source)}],
        'feedback': [{'nodeName': 'RowActions', 'event': 'onAction', 'kind': 'transient', 'source': str(source),
                      'success': 'Confirmed row changes to 停用; one 已停用 Message appears then dismisses',
                      'failure': 'Row unchanged; one error Message appears then dismisses'}],
        'appContext': {'required': False, 'evidence': ev['scope']},
        'runtimeCases': [
            case('query', 'Filters', {'keyword': 'REC-025', 'submit': True}, [('REC-025', True), ('REC-001', False)], evidence=ev['query']),
            case('reset', 'Filters', {'keyword': 'REC-025', 'reset': True}, [('REC-001', True)], evidence=ev['query']),
            *[case('page-change', 'Results', {'current': current, 'pageSize': 20, 'sequence': order}, texts, evidence=ev['paging'])
              for current, order, texts in [(1, 1, [('REC-001', True), ('REC-021', False)]),
                                            (2, 2, [('REC-021', True), ('REC-001', False)]),
                                            (1, 3, [('REC-001', True), ('REC-021', False)])]],
            case('page-size', 'Results', {'current': 1, 'pageSize': 50}, [('REC-001', True), ('REC-025', True)], evidence=ev['paging'])],
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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
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
        elif args.command == 'show':
            result = fragment(json.loads(args.file.read_text(encoding='utf-8')), args.pointer)
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
