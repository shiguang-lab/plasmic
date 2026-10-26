#!/usr/bin/env python3
"""Grade the design-time decisions of a Page plan against a page-type case.

Usage:
  python3 check_plan.py CASE_ID /run/structure-expectation.json [--forms /run/forms.json]

Checks only what the plan decides before markup: page type, wireframe coverage,
component identities and counts, decided props and plan fields (Card header),
ownership exclusions and the Form layout inventory. It does not grade source
meaning, saved models, pixels or Preview behavior.
"""
import argparse
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def norm(value):
    return re.sub(r'[^a-z0-9]', '', str(value).lower())


def path_value(values, dotted):
    for key in dotted.split('.'):
        if not isinstance(values, dict) or key not in values:
            return None
        values = values[key]
    return values


def check(case, plan, forms=None):
    failures = []
    pages = [p for p in plan.get('pages', []) if p.get('path') == case['route']]
    if len(pages) != 1:
        return [f"Expected one planned Page {case['route']}, found {len(pages)}"]
    page = pages[0]
    components = [c for c in page.get('components', []) if isinstance(c, dict)]
    by_name = {c.get('nodeName'): c for c in components}
    of = lambda key: [c for c in components if norm(c.get('component')) == norm(key)]
    if page.get('pageType') != case['pageType']:
        failures.append(f"pageType is {page.get('pageType')!r}, expected {case['pageType']!r}")
    for expectation in case.get('components', []):
        found = of(expectation['component'])
        if 'count' in expectation and len(found) != expectation['count']:
            failures.append(f"{expectation['component']}: {len(found)} planned, expected {expectation['count']}")
        if 'min' in expectation and len(found) < expectation['min']:
            failures.append(f"{expectation['component']}: {len(found)} planned, expected at least {expectation['min']}")
        for spec in found:
            props = spec.get('props') if isinstance(spec.get('props'), dict) else {}
            for key, value in expectation.get('props', {}).items():
                if props.get(key) != value:
                    failures.append(f"{spec.get('nodeName')}: props.{key} is {props.get(key)!r}, expected {value!r}")
            for key, value in expectation.get('propPaths', {}).items():
                if path_value(props, key) != value:
                    failures.append(f"{spec.get('nodeName')}: props.{key} is {path_value(props, key)!r}, expected {value!r}")
            for key, value in expectation.get('fields', {}).items():
                if spec.get(key) != value:
                    failures.append(f"{spec.get('nodeName')}: {key} is {spec.get(key)!r}, expected {value!r}")
    for group in case.get('anyOf', []):
        if not any(of(key) for key in group):
            failures.append(f"Expected one of {group}")
    for key in case.get('absent', []):
        if of(key):
            failures.append(f"{key} is planned but this page type does not use it: {[c.get('nodeName') for c in of(key)]}")
    for rule in case.get('notOwnedBy', []):
        for spec in of(rule['component']):
            owner = by_name.get((spec.get('owner') or {}).get('nodeName'))
            while owner is not None:
                if norm(owner.get('component')) == norm(rule['owner']):
                    failures.append(f"{spec.get('nodeName')} must not sit inside {rule['owner']} ({owner.get('nodeName')})")
                    break
                owner = by_name.get((owner.get('owner') or {}).get('nodeName'))
    tokens = case.get('wireframeTokens')
    if tokens:
        wireframe = page.get('wireframe')
        texts = ''.join(re.sub(r'\s+', '', i.get('text', '')) for i in (wireframe or {}).get('items', []) if isinstance(i, dict))
        if not isinstance(wireframe, dict) or 'items' not in wireframe:
            failures.append('The Page has a text wireframe; wireframe.items is missing')
        else:
            failures.extend(f'Wireframe element {t} is not inventoried' for t in tokens if re.sub(r'\s+', '', t) not in texts)
    for expectation in case.get('forms', []):
        if forms is None:
            failures.append('Form layout expectations need --forms')
            continue
        entries = [f for p in forms.get('pages', []) if p.get('path') == case['route'] for f in p.get('forms', [])]
        if len(entries) != 1:
            failures.append(f'Expected one inventoried Form, found {len(entries)}')
            continue
        form = entries[0]
        layout = form.get('layout') if isinstance(form.get('layout'), dict) else {}
        if form.get('formLayout') != expectation.get('formLayout', form.get('formLayout')):
            failures.append(f"formLayout is {form.get('formLayout')!r}")
        if layout.get('columns') != expectation['layout']['columns']:
            failures.append(f"layout.columns is {layout.get('columns')!r}, expected {expectation['layout']['columns']}")
        containers = layout.get('container')
        count = len(containers) if isinstance(containers, list) else 1 if containers else 0
        if count != expectation['layout'].get('containerCount', 1):
            failures.append(f"{count} field Rows, expected {expectation['layout'].get('containerCount', 1)}")
        if expectation.get('labelWidth') and not isinstance(form.get('labelWidth'), dict):
            failures.append('Horizontal Form has no measured labelWidth')
        if 'fullRowFields' in expectation:
            full = sum(1 for f in form.get('fields', []) if f.get('span') == layout.get('columns'))
            if full != expectation['fullRowFields']:
                failures.append(f'{full} full-row fields, expected {expectation["fullRowFields"]}')
    return failures


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('case')
    parser.add_argument('plan', type=Path)
    parser.add_argument('--forms', type=Path)
    args = parser.parse_args()
    cases = {c['id']: c for c in json.loads((HERE / 'expected.json').read_text(encoding='utf-8'))['cases']}
    if args.case not in cases:
        parser.error(f'Unknown case; choose from {sorted(cases)}')
    plan = json.loads(args.plan.read_text(encoding='utf-8'))
    forms = json.loads(args.forms.read_text(encoding='utf-8')) if args.forms else None
    failures = check(cases[args.case], plan, forms)
    print(json.dumps({'case': args.case, 'passed': not failures, 'failures': failures}, ensure_ascii=False, indent=2))
    sys.exit(0 if not failures else 1)


if __name__ == '__main__':
    main()
