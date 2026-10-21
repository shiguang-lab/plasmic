"""Source-backed admin composition policies, independent of generated expectations.

These are prototype conventions, not restrictions on component implementations.
Source excerpts prove provenance; their business meaning still requires review.
"""
import hashlib
import json
import re
from pathlib import Path
from verify_forms import TextTree, walk, identity, node_name, props


BASELINES = {
    'plasmicoverseassearchform': {'colSpan': 6, 'minRows': 1, 'collapsed': True},
    'plasmicreactuiactiongroup': {'max': 3, 'dropdownProps.trigger': ['hover']},
    'plasmicantd6dropdown': {'trigger': 'hover'},
}
APP_SOURCE = re.compile(r'app[\s_-]*source|app(?:lication)?[\s_-]*(?:id|name)|(?:app|应用)[\s_-]*(?:来源|标识|名称)|应用[\s_-]*id|多[\s_-]*(?:app|应用)', re.I)


def static(value):
    if isinstance(value, str) and value.startswith('{{') and value.endswith('}}'):
        try:
            return json.loads(value[2:-2].strip())
        except (ValueError, TypeError):
            pass
    return value


def at(values, key, default=None):
    for part in key.split('.'):
        values = static(values)
        if not isinstance(values, dict) or part not in values:
            return default
        values = values[part]
    return static(values)


def same(a, b):
    return json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True)


def uses_binding(value, binding):
    if not isinstance(binding, str) or not re.fullmatch(r'\$(?:state|ctx|q|queries)(?:\.[A-Za-z_$][\w$]*)+', binding):
        return False
    if isinstance(value, dict):
        return (value.get('__type') == 'ObjectPath' and value.get('path') == binding.split('.')
                or any(uses_binding(v, binding) for v in value.values()))
    if isinstance(value, list):
        return any(uses_binding(v, binding) for v in value)
    return isinstance(value, str) and bool(re.search(r'(?<![\w$])' + re.escape(binding) + r'(?![\w$])', value))


def case_groups(plan):
    """Native case arrays, their Page-local JSON pointers and inherited source."""
    context = plan.get('appContext')
    groups = [('/runtimeCases', plan.get('runtimeCases', []), None)]
    if isinstance(context, dict):
        groups.append(('/appContext/cases', context.get('cases', []), context.get('evidence')))
    contracts = plan.get('actionContracts', [])
    if not isinstance(contracts, list):
        raise ValueError('actionContracts must be an array')
    groups.extend((f'/actionContracts/{i}/cases', action.get('cases', []), action.get('evidence'))
                  for i, action in enumerate(contracts) if isinstance(action, dict))
    for pointer, group, _ in groups:
        if not isinstance(group, list):
            raise ValueError(f'{pointer}: runtime case collection must be an array')
    return groups


def runtime_cases(plan):
    return [{**case, 'evidence': case.get('evidence', evidence)} if isinstance(case, dict) else case
            for _, group, evidence in case_groups(plan) for case in group]


def source_text(evidence):
    if not isinstance(evidence, dict) or not all(isinstance(evidence.get(k), str) and evidence[k].strip()
                                               for k in ('path', 'sha256', 'quote')):
        raise ValueError('Source evidence requires path, sha256 and an exact nonempty quote')
    path = Path(evidence['path'])
    if not path.is_absolute() or not path.is_file():
        raise ValueError('Source evidence must identify an existing absolute file')
    data = path.read_bytes()
    if hashlib.sha256(data).hexdigest() != evidence['sha256']:
        raise ValueError('Source changed after planning; reread and review it')
    text = data.decode('utf-8')
    if evidence['quote'] not in text:
        raise ValueError('Source quote is not present verbatim in the declared file')
    return text


def approved_override(spec, key):
    overrides = spec.get('overrides', {})
    override = overrides.get(key) if isinstance(overrides, dict) else None
    if not isinstance(override, dict) or not isinstance(override.get('reason'), str) or not override['reason'].strip():
        return False
    try:
        source_text(override.get('evidence'))
    except (ValueError, OSError, UnicodeError):
        return False
    # The excerpt must actually state a property/value or an equivalent explicit
    # layout decision. Merely requiring the field is not a layout exception.
    quote = override['evidence']['quote']
    value = at(spec.get('props', {}), key)
    rendered = json.dumps(value, ensure_ascii=False, separators=(',', ':'))
    literal = re.escape(rendered) if not isinstance(value, str) else r'(?:["\x27])?' + re.escape(value) + r'(?:["\x27])?'
    direct = bool(re.search(r'(?<![\w.])' + re.escape(key) + r'["\x27]?\s*[:=]\s*' + literal + r'(?![\w.])', quote, re.I))
    natural = {
        'colSpan': {4: r'六列|每行\s*6\s*(?:列|个)|six.columns',
                    8: r'三列|每行\s*3\s*(?:列|个)|three.columns',
                    12: r'两列|每行\s*(?:两|2)\s*(?:列|个)|two.columns',
                    24: r'单列|每行\s*(?:一|1)\s*(?:列|个)|one.column'},
        'span': {12: r'跨\s*(?:两|2)\s*列|占\s*(?:两|2)\s*列'},
        'minRows': {2: r'(?:常驻|固定|始终显示)\s*(?:两|2)\s*行'},
        'collapsed': {False: r'初始展开|默认展开|initially.expanded'},
        'trigger': {'click': r'点击(?:打开|触发)|click.operated|触屏|touch', 'contextMenu': r'右键|right.click'},
        'dropdownProps.trigger': {},
    }
    natural_key = 'trigger' if key == 'dropdownProps.trigger' else key
    natural_value = value[0] if key == 'dropdownProps.trigger' and isinstance(value, list) and len(value) == 1 else value
    if isinstance(natural_value, (str, int, float, bool)):
        pattern = natural.get(natural_key, {}).get(natural_value)
        return direct or bool(pattern and re.search(pattern, quote, re.I))
    return direct


def search_form_span(spec):
    """Accept the reviewed three/four-column mode, or a requirement exception.

    Whether a draft actually shows multiple three-column rows is a visual/source
    review, not something this static prop checker can infer.
    """
    value = at(spec.get('props', {}), 'colSpan', 6)
    return value if any(same(value, allowed) for allowed in (6, 8)) or approved_override(spec, 'colSpan') else 6


def policy_errors(spec, values, inherited_span=6):
    key = re.sub(r'[^a-z0-9]', '', spec.get('component', '').lower())
    errors = []
    for prop, default in BASELINES.get(key, {}).items():
        if key == 'plasmicoverseassearchform' and prop == 'colSpan':
            expected = search_form_span(spec)
            if not same(at(values, prop, 6), expected):
                errors.append({'check': 'componentPolicy', 'node': spec.get('nodeName'), 'property': prop,
                               'expectedColSpan': expected,
                               'message': 'SearchForm uses reviewed four-column (colSpan=6) or three-column (colSpan=8) mode; other spans require an explicit requirement-document override'})
            continue
        actual = at(values, prop, default)
        if not same(actual, default) and not (same(actual, at(spec.get('props', {}), prop)) and approved_override(spec, prop)):
            errors.append({'check': 'componentPolicy', 'node': spec.get('nodeName'), 'property': prop,
                           'requiredDefault': default,
                           'message': 'Nondefault composition requires an explicit, source-backed requirement override; matching generated expectations is insufficient'})
    if key == 'plasmicoverseassearchformitem' and at(values, 'span') is not None:
        if not same(at(values, 'span'), inherited_span) and not (same(at(values, 'span'), at(spec.get('props', {}), 'span')) and approved_override(spec, 'span')):
            errors.append({'check': 'componentPolicy', 'node': spec.get('nodeName'), 'property': 'span',
                           'message': 'SearchForm.Item inherits the standard grid; a field requirement or long placeholder does not authorize widening'})
    return errors


def plan_errors(plan):
    errors = []
    components = plan.get('components', [])
    contracts = plan.get('actionContracts', [])
    if not isinstance(components, list) or any(not isinstance(c, dict) for c in components):
        return [{'check': 'componentPolicy', 'pointer': '/components', 'message': 'components must be an array of native component declarations'}]
    if not isinstance(contracts, list) or any(not isinstance(c, dict) for c in contracts):
        return [{'check': 'actionContract', 'pointer': '/actionContracts', 'message': 'actionContracts must be an array of action declarations'}]
    by_name = {s.get('nodeName'): s for s in components}
    for i, spec in enumerate(components):
        owner_ref = spec.get('owner')
        owner = by_name.get(owner_ref.get('nodeName'), {}) if isinstance(owner_ref, dict) else {}
        inherited = search_form_span(owner) if re.sub(r'[^a-z0-9]', '', owner.get('component', '').lower()) == 'plasmicoverseassearchform' else 6
        errors.extend({'pointer': f'/components/{i}/props/' + error['property'].replace('.', '/'), **error}
                      for error in policy_errors(spec, spec.get('props', {}), inherited))
    shells = [s for s in plan.get('components', []) if s.get('role') == 'shell']
    context = plan.get('appContext')
    if shells:
        if not isinstance(context, dict) or type(context.get('required')) is not bool:
            errors.append({'check': 'appContext', 'pointer': '/appContext', 'message': 'Declare appContext.required and its source evidence before shell composition'})
        else:
            try:
                text = source_text(context.get('evidence'))
                quote = context['evidence']['quote']
                if not context['required'] and APP_SOURCE.search(text):
                    if not (re.search(r'顶部|全局|AppShell|header|global', quote, re.I)
                            and re.search(r'不提供|隐藏|禁用|不要|disable|omit', quote, re.I)):
                        raise ValueError('App-source semantics require the shell switcher; excluding a filter/form field does not disable global context')
                if context['required'] and (context.get('shell') not in {s.get('nodeName') for s in shells}
                                           or not isinstance(context.get('binding'), str) or not context['binding'].strip()
                                           or not context.get('consumers')):
                    raise ValueError('Required App context needs its shell, shared binding and data/action consumers')
                consumers = context.get('consumers', [])
                if not isinstance(consumers, list) or any(not isinstance(c, dict) or not c.get('nodeName') or not c.get('property') for c in consumers):
                    raise ValueError('appContext.consumers must identify native nodeName/property pairs')
            except (ValueError, OSError, UnicodeError) as ex:
                errors.append({'check': 'appContext', 'pointer': '/appContext', 'message': str(ex)})
    for index, contract in enumerate(contracts):
        location = {'pointer': f'/actionContracts/{index}', 'node': contract.get('nodeName'), 'key': contract.get('key')}
        if not isinstance(contract, dict) or not all(contract.get(k) for k in ('nodeName', 'key', 'evidence', 'cases')):
            errors.append({'check': 'actionContract', **location,
                           'required': ['nodeName', 'key', 'evidence', 'cases'],
                           'missing': [k for k in ('nodeName', 'key', 'evidence', 'cases') if not contract.get(k)],
                           'message': 'Action contracts need native owner/key, source evidence and cases'})
            continue
        try:
            source_text(contract['evidence'])
        except (ValueError, OSError, UnicodeError) as ex:
            errors.append({'check': 'actionContract', **location, 'pointer': location['pointer'] + '/evidence', 'message': str(ex)})
        if type(contract.get('confirm')) is not bool or not isinstance(contract.get('transitions'), list):
            errors.append({'check': 'actionContract', **location, 'requiredTypes': {'confirm': 'boolean', 'transitions': 'array'},
                           'message': 'Explicit confirm:true/false and transitions:[] (or source-derived transitions) are required; omissions are not reviewed decisions'})
            continue
        cases = contract['cases']
        kinds = {c['kind'] for c in cases if isinstance(c, dict) and isinstance(c.get('kind'), str)} if isinstance(cases, list) else set()
        required = {'permission-allowed', 'permission-denied'}
        if contract.get('confirm') is True:
            required.update({'confirm-cancel', 'confirm-accept'})
        if contract.get('transitions'):
            required.add('state-transition')
        if not required.issubset(kinds):
            errors.append({'check': 'actionContract', **location, 'pointer': location['pointer'] + '/cases',
                           'requiredKinds': sorted(required - kinds),
                           'message': 'Missing source-derived cases: ' + ', '.join(sorted(required - kinds))})
        for j, transition in enumerate(contract.get('transitions', [])):
            if not isinstance(transition, dict) or not all(transition.get(k) for k in ('from', 'to', 'text')):
                errors.append({'check': 'actionContract', **location, 'pointer': location['pointer'] + f'/transitions/{j}',
                               'required': ['from', 'to', 'text'], 'message': 'Each transition needs source state, target state and displayed text'})
    row_owners = {s['nodeName'] for s in plan.get('components', []) if s.get('role') == 'row-actions'}
    declared = {s.get('nodeName') for s in plan.get('actionContracts', []) if isinstance(s, dict)}
    for owner in row_owners - declared if plan.get('path') else []:
        errors.append({'check': 'actionContract', 'pointer': '/actionContracts', 'node': owner,
                       'declaredOwners': sorted(n for n in declared if isinstance(n, str)),
                       'message': 'Inventory row actions and their permission/confirmation/state cases before writing handlers'})
    if plan.get('path'):
        try:
            groups = case_groups(plan)
            entries = [(f'{pointer}/{i}', case, evidence) for pointer, group, evidence in groups for i, case in enumerate(group)]
            cases = runtime_cases(plan)
        except ValueError as ex:
            errors.append({'check': 'runtimePlan', 'pointer': str(ex).split(':', 1)[0] if str(ex).startswith('/') else '/actionContracts', 'message': str(ex)})
            cases, entries = [], []
        ids = {}
        for pointer, case, inherited in entries:
            if isinstance(case, dict) and isinstance(case.get('id'), str) and case['id'].strip():
                ids.setdefault(case['id'], []).append(pointer + '/id')
            else:
                errors.append({'check': 'runtimePlan', 'pointer': pointer + '/id', 'message': 'Runtime case ID must be a nonempty string'})
        for case_id, pointers in ids.items():
            if len(pointers) > 1:
                errors.append({'check': 'runtimePlan', 'case': case_id, 'pointer': pointers[0], 'relatedPointers': pointers[1:],
                               'message': 'Runtime cases require distinct IDs'})
        for pointer, raw, inherited in entries:
            case = {**raw, 'evidence': raw.get('evidence', inherited)} if isinstance(raw, dict) else raw
            location = {'pointer': pointer, 'case': case.get('id') if isinstance(case, dict) else None,
                        'node': case.get('nodeName') if isinstance(case, dict) else None}
            if pointer.startswith('/actionContracts/'):
                location['key'] = contracts[int(pointer.split('/')[2])].get('key')
            if not isinstance(case, dict) or not all(case.get(k) for k in ('id', 'kind', 'nodeName', 'given', 'checks')):
                errors.append({'check': 'runtimePlan', **location, 'required': ['id', 'kind', 'nodeName', 'given', 'checks'],
                               'missing': [k for k in ('id', 'kind', 'nodeName', 'given', 'checks') if not isinstance(case, dict) or not case.get(k)],
                               'message': 'Each runtime case needs id, kind, native owner, preconditions and native Preview checks'})
            else:
                for key in ('id', 'kind', 'nodeName'):
                    if not isinstance(case[key], str) or not case[key].strip():
                        errors.append({'check': 'runtimePlan', **location, 'pointer': pointer + '/' + key,
                                       'requiredType': 'nonempty string', 'message': 'Runtime identity and kind fields must be strings'})
                if not isinstance(case['checks'], list):
                    errors.append({'check': 'runtimePlan', **location, 'pointer': pointer + '/checks',
                                   'requiredType': 'array', 'message': 'Native Preview checks must be an array'})
                else:
                    for j, assertion in enumerate(case['checks']):
                        if not isinstance(assertion, dict) or not isinstance(assertion.get('kind'), str) or assertion['kind'] not in {'text', 'visible', 'count', 'value'}:
                            errors.append({'check': 'runtimePlan', **location, 'pointer': pointer + f'/checks/{j}' + ('/kind' if isinstance(assertion, dict) else ''),
                                           'allowedKinds': ['text', 'visible', 'count', 'value'], 'message': 'Case checks must use native Preview assert contracts'})
            if isinstance(case, dict):
                try:
                    source_text(case.get('evidence'))
                except (ValueError, OSError, UnicodeError) as ex:
                    evidence_pointer = pointer + '/evidence' if 'evidence' in raw or inherited is None else pointer.rsplit('/cases/', 1)[0] + '/evidence'
                    errors.append({'check': 'runtimePlan', **location, 'pointer': evidence_pointer, 'message': str(ex)})
        def require(owner, kinds):
            present = {c['kind'] for c in cases if isinstance(c, dict) and c.get('nodeName') == owner and isinstance(c.get('kind'), str)}
            if not kinds.issubset(present):
                errors.append({'check': 'runtimePlan', 'pointer': '/runtimeCases', 'node': owner, 'requiredKinds': sorted(kinds - present),
                               'message': 'Missing runtime cases: ' + ', '.join(sorted(kinds - present))})
        if isinstance(context, dict) and context.get('required') is True:
            require(context.get('shell'), {'app-switch'})
            consumers = context.get('consumers', [])
            for consumer in consumers if isinstance(consumers, list) else []:
                if isinstance(consumer, dict) and isinstance(consumer.get('kind', 'data'), str):
                    require(consumer.get('nodeName'), {'context-' + consumer.get('kind', 'data')})
        for spec in plan.get('components', []):
            if spec.get('role') == 'query':
                require(spec.get('nodeName'), {'query', 'reset'})
            if spec.get('role') == 'pagination':
                prefix = 'pagination.' if 'table' in spec.get('component', '').lower() else ''
                values = spec.get('props', {})
                options = at(values, prefix + 'pageSizeOptions')
                required = {'page-change'}
                adjustable = bool(options) and (not isinstance(options, list) or len(options) > 1)
                if at(values, prefix + 'showSizeChanger') is True or adjustable:
                    required.add('page-size')
                require(spec.get('nodeName'), required)
        for index, contract in enumerate(contracts):
            transitions, action_cases = contract.get('transitions', []), contract.get('cases', [])
            for j, transition in enumerate(transitions if isinstance(transitions, list) else []):
                if not isinstance(transition, dict) or not isinstance(action_cases, list):
                    continue
                matching = [c for c in action_cases if isinstance(c, dict) and c.get('kind') == 'state-transition' and c.get('transition') == transition]
                if not any({'kind': 'text', 'text': transition.get('text'), 'present': True} in c.get('checks', []) for c in matching):
                    errors.append({'check': 'runtimePlan', 'pointer': f'/actionContracts/{index}/transitions/{j}',
                                   'node': contract.get('nodeName'), 'key': contract.get('key'),
                                   'message': 'Every declared transition needs its own expected target/text assertion, including re-enable failure recovery'})
    return errors


def check_page(plan, page):
    errors = []
    declarations = {s.get('nodeName'): s for s in plan.get('components', [])}
    root = TextTree(page.get('baseVariantTplTree', '')).root
    nodes = [n for n in walk(root) if n.get('tag') == 'plasmic-component']
    inherited = {}
    def visit(node, span=6):
        if identity(node) == 'plasmicoverseassearchform':
            span = at(props(node), 'colSpan', 6)
        if identity(node) == 'plasmicoverseassearchformitem':
            inherited[id(node)] = span
        for child in node.get('children', []):
            visit(child, span)
    visit(root)
    by_name = {node_name(n): n for n in nodes if node_name(n)}
    for node in nodes:
        spec = declarations.get(node_name(node), {'nodeName': node_name(node), 'component': identity(node)})
        errors.extend(policy_errors(spec, props(node), inherited.get(id(node), 6)))
        values = props(node)
        if identity(node) == 'plasmicantd6table':
            options = at(values, 'pagination.pageSizeOptions')
            if isinstance(options, list) and len(options) > 1 and at(values, 'pagination.showSizeChanger') is not True:
                errors.append({'check': 'paginationControls', 'node': node_name(node), 'message': 'Explicit multiple page sizes require a visible native size changer; exercise page-size and page-change cases separately'})
    context = plan.get('appContext', {})
    if isinstance(context, dict) and context.get('required') is True:
        shell = by_name.get(context.get('shell'))
        values = props(shell) if shell else {}
        options = at(values, 'appSources')
        binding = context.get('binding', '')
        if not shell or identity(shell) != 'plasmicoverseasappshell' or not options:
            errors.append({'check': 'appContext', 'message': 'Required AppSource switcher must use the real shell with nonempty source options'})
        implicit = bool(shell and any(state.get('elementUuid') == shell['attrs'].get('id')
            and '$state.' + state.get('name', '') == binding and state.get('name', '').endswith('.appSource')
            for state in page.get('states', [])))
        if not implicit and (not uses_binding(values.get('appSource'), binding) or '{{' not in str(values.get('appSource', ''))):
            errors.append({'check': 'appContext', 'message': 'AppShell.appSource must bind the reviewed shared App context'})
        handler = [values.get('onAppSourceChange'), [
            i for i in page.get('interactions', []) if shell and i.get('elementUuid') == shell['attrs'].get('id')
            and i.get('eventName') == 'onAppSourceChange' and i.get('conditionalMode') != 'never']]
        if not implicit and not uses_binding(handler, binding):
            errors.append({'check': 'appContext', 'message': 'AppSource change must update the same shared context, not only shell-local display'})
        for consumer in context.get('consumers', []):
            node = by_name.get(consumer.get('nodeName'))
            value = at(props(node), consumer.get('property', '')) if node else None
            interactions = [i for i in page.get('interactions', []) if node and i.get('elementUuid') == node['attrs'].get('id')
                            and i.get('eventName') == consumer.get('property') and i.get('conditionalMode') != 'never']
            query = next((q for q in page.get('dataQueries', []) if q.get('name') == consumer.get('queryName')), None)
            via_query = bool(query and uses_binding(query, binding) and query.get('reference')
                             and uses_binding(value, query['reference']) and '{{' in str(value))
            if not (uses_binding(value, binding) and '{{' in str(value) or uses_binding(interactions, binding) or via_query):
                errors.append({'check': 'appContext', 'node': consumer.get('nodeName'), 'message': 'Required data/action consumer must use the same shared App context'})
    for contract in plan.get('actionContracts', []):
        owner = by_name.get(contract.get('nodeName'))
        items = at(props(owner), 'items') if owner else None
        if not isinstance(items, list):
            # Dynamic row expressions require real per-row runtime cases.
            continue
        item = next((v for v in items if isinstance(v, dict) and v.get('key') == contract.get('key')), None)
        if not item or contract.get('confirm') is True and not item.get('confirm'):
            errors.append({'check': 'actionConfirmation', 'node': contract.get('nodeName'), 'key': contract.get('key'),
                           'message': 'Required native action/confirmation is missing; Message after mutation is not confirmation'})
    return errors
