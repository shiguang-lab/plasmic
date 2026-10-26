#!/usr/bin/env python3
"""Match source-planned cases to actual native Preview assertions, read-only.

Consumes the monitoring JSONL's {input, result} Preview records. Does not open
Preview, execute JS, repair a prototype, or certify source/pixel interpretation.
"""
import argparse
import hashlib
import json
from pathlib import Path
from verify_component_policy import plan_errors, runtime_cases, same
from verify_all import valid_identity


def planned_cases(plan):
    errors, wanted, paths = [], {}, set()
    for page in plan.get('pages', []):
        path = page.get('path')
        if not isinstance(path, str) or not path.startswith('/') or path.startswith('//') or any(c.isspace() for c in path):
            errors.append({'message': 'Each runtime Page needs its exact local route'})
            continue
        if path in paths:
            errors.append({'message': 'Duplicate runtime Page route', 'path': path})
        paths.add(path)
        errors.extend(plan_errors(page))
        for case in runtime_cases(page):
            if not isinstance(case, dict) or not isinstance(case.get('id'), str):
                continue  # plan_errors retains the invalid declaration.
            key = (path, case.get('id'))
            if key in wanted:
                errors.append({'message': 'Duplicate case identity', 'case': key})
            wanted[key] = case
    if not wanted:
        errors.append({'message': 'Nonempty source-planned runtime cases required'})
    errors.extend(record_case_errors(plan))
    return wanted, errors



def record_case_errors(plan):
    """Every record Page needs two executed cases that differ by record and expect different content."""
    errors = []
    for page in plan.get('pages', []):
        if not page.get('recordPage'):
            continue
        # Record cases live in the Page's native case collections (runtimeCases and owner cases).
        cases = [c for c in runtime_cases(page)
                 if isinstance(c, dict) and isinstance(c.get('given'), dict)
                 and isinstance(c['given'].get('routeParams'), dict) and c['given']['routeParams']]
        if len(cases) < 2:
            errors.append({'message': 'Record Page needs at least two record cases (distinct identities)',
                           'path': page.get('path')})
            continue
        resolved = []
        for case in cases:
            texts = frozenset(a['text'] for a in (case.get('checks') or [])
                              if isinstance(a, dict) and a.get('kind') == 'text' and a.get('present') is True
                              and isinstance(a.get('text'), str) and a['text'].strip())
            if texts:
                resolved.append((json.dumps(case['given']['routeParams'], sort_keys=True), texts))
        if len(resolved) < 2:
            errors.append({'message': 'Record Page needs at least two cases with positive destination-content text checks; absence alone cannot prove record resolution',
                           'path': page.get('path')})
        if len({params for params, _ in resolved}) < 2:
            errors.append({'message': 'Record cases must use distinct route params', 'path': page.get('path')})
        if not any(first_params != second_params and first_texts != second_texts
                   for first_params, first_texts in resolved for second_params, second_texts in resolved):
            errors.append({'message': 'Record cases must assert different destination content', 'path': page.get('path')})
    return errors


def make_manifest(plan, capture, plan_hash, pages_hash):
    """Prepare the existing evidence index, leaving every execution unclaimed."""
    wanted, errors = planned_cases(plan)
    if errors:
        raise ValueError('Repair runtime plan before preparing evidence: ' + json.dumps(errors, ensure_ascii=False))
    if (not valid_identity(capture.get('after')) or capture.get('before') != capture.get('after')
            or capture.get('files', {}).get('pages.json') != pages_hash):
        raise ValueError('Stable capture identity and matching saved pages hash required')
    return {'planSha256': plan_hash, 'pagesSha256': pages_hash,
            'cases': [{'path': path, 'id': case_id, 'assertLine': None} for path, case_id in wanted]}


def check(plan, manifest, trace, capture, plan_hash, pages_hash):
    wanted, errors = planned_cases(plan)
    binding_errors = []
    if manifest.get('planSha256') != plan_hash or manifest.get('pagesSha256') != pages_hash or capture.get('files', {}).get('pages.json') != pages_hash:
        binding_errors.append({'message': 'Runtime evidence must bind the exact expectation and saved model hashes'})
    identity = capture.get('after', {})
    required_identity = ('projectId', 'branchId', 'sessionId', 'revision', 'changeCounter')
    if not valid_identity(identity) or capture.get('before') != identity:
        binding_errors.append({'message': 'Stable native collection identity required'})
    errors.extend(binding_errors)
    outcomes = {key: {'path': key[0], 'id': key[1], 'kind': case.get('kind'),
                      'nodeName': case.get('nodeName'), 'assertPath': case.get('assertPath', key[0]),
                      'status': 'unexecuted'} for key, case in wanted.items()}
    assigned, lines = set(), set()
    for record in manifest.get('cases', []):
        key = (record.get('path'), record.get('id'))
        case = wanted.get(key)
        if not case or key in assigned:
            errors.append({'message': 'Unknown or duplicate executed case', 'case': key})
            if key in outcomes:
                outcomes[key]['status'] = 'invalid_evidence'
            continue
        assigned.add(key)
        line = record.get('assertLine')
        if line is None:
            continue
        outcome = outcomes[key]
        outcome['status'] = 'invalid_evidence'
        if type(line) is not int or line < 1 or line > len(trace):
            errors.append({'message': 'Each case needs its own existing native assert trace line', 'case': key})
            continue
        outcome['assertLine'] = line
        if line in lines:
            errors.append({'message': 'One native assertion cannot prove two cases', 'case': key})
            for other in outcomes.values():
                if other.get('assertLine') == line:
                    other['status'] = 'invalid_evidence'
            continue
        lines.add(line)
        call = trace[line - 1]
        request, result = call.get('input', {}), call.get('result', {})
        context = result.get('context', {})
        if (binding_errors or request.get('action') != 'assert'
                or not same(request.get('checks'), case.get('checks'))
                or not isinstance(result.get('checks'), list)
                or not same([c.get('check') for c in result.get('checks', [])], case.get('checks'))
                or type(result.get('passed')) is not bool
                or any(type(c.get('passed')) is not bool for c in result.get('checks', []))
                or result.get('passed') != all(c['passed'] for c in result.get('checks', []))
                or any(context.get(k) != identity.get(k) for k in required_identity)
                or context.get('mode') != 'preview'
                or context.get('previewContext', {}).get('path') != outcome['assertPath']):
            errors.append({'message': 'Native assertion evidence is incomplete, differs from the plan, or belongs to another model/session/page', 'case': key})
            continue
        outcome['status'] = 'passed' if result['passed'] else 'failed'
        if not result['passed']:
            errors.append({'message': 'Actual native Preview assertion failed', 'case': key,
                           'checks': [c for c in result['checks'] if not c['passed']]})
    for key, outcome in outcomes.items():
        if outcome['status'] == 'unexecuted':
            errors.append({'message': 'Runtime case was not executed', 'case': key})
    counts = {status: sum(c['status'] == status for c in outcomes.values())
              for status in ('passed', 'failed', 'unexecuted', 'invalid_evidence')}
    return {'passed': not errors, 'scope': 'planned native Preview assertions only', 'caseCount': len(wanted),
            'executedCaseCount': counts['passed'] + counts['failed'], 'counts': counts,
            'cases': list(outcomes.values()), 'errors': errors,
            'notChecked': ['source meaning and completeness', 'fixture/precondition authenticity', 'visual fidelity', 'unasserted business effects', 'save/reopen persistence']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--expectations', type=Path, required=True)
    parser.add_argument('--manifest', type=Path, required=True)
    parser.add_argument('--trace', type=Path, required=True)
    parser.add_argument('--capture', type=Path, required=True)
    parser.add_argument('--pages', type=Path, required=True)
    parser.add_argument('--report', type=Path)
    parser.add_argument('--full', action='store_true', help='Print full diagnostics even when --report is supplied')
    args = parser.parse_args()
    try:
        raw = {name: getattr(args, name).read_bytes() for name in ('expectations', 'manifest', 'trace', 'capture', 'pages')}
        report = check(json.loads(raw['expectations']), json.loads(raw['manifest']),
                       [json.loads(line) if line.strip() else {} for line in raw['trace'].splitlines()], json.loads(raw['capture']),
                       hashlib.sha256(raw['expectations']).hexdigest(), hashlib.sha256(raw['pages']).hexdigest())
        if any(getattr(args, name).read_bytes() != data for name, data in raw.items()):
            report['passed'] = False
            report['errors'].append({'message': 'Runtime evidence changed during verification'})
    except (OSError, ValueError, KeyError, TypeError, AttributeError) as ex:
        report = {'passed': False, 'errors': [{'message': str(ex)}]}
    output = json.dumps(report, ensure_ascii=False, indent=2) + '\n'
    if args.report:
        args.report.write_text(output, encoding='utf-8')
    if args.report and not args.full:
        print(json.dumps({**{key: report[key] for key in ('passed', 'scope', 'caseCount', 'executedCaseCount', 'counts', 'notChecked') if key in report},
                          'errorCount': len(report.get('errors', [])), 'report': str(args.report.resolve()),
                          'errors': report.get('errors', [])[:8]}, ensure_ascii=False, indent=2))
    else:
        print(output, end='')
    raise SystemExit(0 if report['passed'] else 1)


if __name__ == '__main__':
    main()
