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


def check(plan, manifest, trace, capture, plan_hash, pages_hash):
    errors, wanted = [], {}
    for page in plan.get('pages', []):
        errors.extend(plan_errors(page))
        for case in runtime_cases(page):
            key = (page.get('path'), case.get('id'))
            if key in wanted:
                errors.append({'message': 'Duplicate case identity', 'case': key})
            wanted[key] = case
    if not wanted:
        errors.append({'message': 'Nonempty source-planned runtime cases required'})
    if manifest.get('planSha256') != plan_hash or manifest.get('pagesSha256') != pages_hash or capture.get('files', {}).get('pages.json') != pages_hash:
        errors.append({'message': 'Runtime evidence must bind the exact expectation and saved model hashes'})
    identity = capture.get('after', {})
    required_identity = ('projectId', 'branchId', 'sessionId', 'revision', 'changeCounter')
    if not valid_identity(identity) or capture.get('before') != identity:
        errors.append({'message': 'Stable native collection identity required'})
    assigned, lines = set(), set()
    for record in manifest.get('cases', []):
        key = (record.get('path'), record.get('id'))
        case = wanted.get(key)
        if not case or key in assigned:
            errors.append({'message': 'Unknown or duplicate executed case', 'case': key})
            continue
        assigned.add(key)
        line = record.get('assertLine')
        if type(line) is not int or line < 1 or line > len(trace) or line in lines:
            errors.append({'message': 'Each case needs its own existing native assert trace line', 'case': key})
            continue
        lines.add(line)
        call = trace[line - 1]
        request, result = call.get('input', {}), call.get('result', {})
        context = result.get('context', {})
        if (request.get('action') != 'assert' or result.get('passed') is not True
                or not same(request.get('checks'), case.get('checks'))
                or not isinstance(result.get('checks'), list)
                or not same([c.get('check') for c in result.get('checks', [])], case.get('checks'))
                or any(c.get('passed') is not True for c in result.get('checks', []))
                or any(context.get(k) != identity.get(k) for k in required_identity)
                or context.get('mode') != 'preview'
                or context.get('previewContext', {}).get('path') != key[0]):
            errors.append({'message': 'Actual native Preview assertion failed, differs from the planned checks, or belongs to another model/session/page', 'case': key})
    for key in wanted.keys() - assigned:
        errors.append({'message': 'Runtime case was not executed', 'case': key})
    return {'passed': not errors, 'scope': 'planned native Preview assertions only', 'caseCount': len(wanted),
            'executedCaseCount': len(assigned), 'errors': errors,
            'notChecked': ['source meaning and completeness', 'fixture/precondition authenticity', 'visual fidelity', 'unasserted business effects', 'save/reopen persistence']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--expectations', type=Path, required=True)
    parser.add_argument('--manifest', type=Path, required=True)
    parser.add_argument('--trace', type=Path, required=True)
    parser.add_argument('--capture', type=Path, required=True)
    parser.add_argument('--pages', type=Path, required=True)
    parser.add_argument('--report', type=Path)
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
    print(output, end='')
    raise SystemExit(0 if report['passed'] else 1)


if __name__ == '__main__':
    main()
