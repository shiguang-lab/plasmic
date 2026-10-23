#!/usr/bin/env python3
"""Load rule owners from references/libraries/*/rules.json and references/gate-rules.json.

One source of truth for: registration -> owning document, required plan
decisions, and the reference anchor that every gate diagnostic points back to.
"""
import json
import re
from functools import lru_cache
from pathlib import Path

RESOURCE_ROOT = Path(__file__).resolve().parent.parent
PENDING = '__DECIDE__'
STAGE_SECTIONS = {'plan': 'plan-decisions', 'generation': 'generation-rules', 'acceptance': 'acceptance-checks'}


def norm(value):
    return re.sub(r'[^a-z0-9]', '', str(value).lower())


@lru_cache(maxsize=None)
def manifest():
    """{'registrations': {norm(key): {...}}, 'prefixes': [...], 'checks': {...}, 'gates': {...}, 'pageDecisions': {...}}"""
    shared = json.loads((RESOURCE_ROOT / 'references/gate-rules.json').read_text(encoding='utf-8'))
    registrations, prefixes, checks = {}, [], {}
    for path in sorted((RESOURCE_ROOT / 'references/libraries').glob('*/rules.json')):
        data = json.loads(path.read_text(encoding='utf-8'))
        base = path.parent.relative_to(RESOURCE_ROOT).as_posix()
        for document, entry in data.get('documents', {}).items():
            for key in entry.get('registrations', []):
                registrations[norm(key)] = {
                    'key': key, 'library': data['library'], 'document': f'{base}/{document}',
                    'decisions': entry.get('decisions', {}).get(key, [])}
        for prefix, document in data.get('prefixes', {}).items():
            prefixes.append((norm(prefix), f'{base}/{document}'))
        for check, target in data.get('checks', {}).items():
            checks[check] = f'{base}/{target}'
    return {'registrations': registrations, 'prefixes': prefixes, 'libraryChecks': checks, 'checks': shared['checks'],
            'gates': shared['gates'], 'pageDecisions': shared['pageDecisions']}


def registration(key):
    return manifest()['registrations'].get(norm(key))


def document_for(key):
    entry = registration(key)
    if entry:
        return entry['document']
    normalized = norm(key)
    return next((document for prefix, document in manifest()['prefixes'] if normalized.startswith(prefix)), None)


def decisions_for(key):
    entry = registration(key)
    return entry['decisions'] if entry else []


def decision_rule(key, item):
    return f"{document_for(key)}#{item['rule']}"


def rule_for(error, gate=None, plan_components=None):
    """Most specific owner: library check, registration/node, shared check, then gate."""
    data = manifest()
    check = error.get('check') if isinstance(error, dict) else None
    if isinstance(error, dict):
        if check in data['libraryChecks']:
            return data['libraryChecks'][check]
        for key in ('registration', 'component'):
            if isinstance(error.get(key), str) and document_for(error[key]):
                return document_for(error[key])
        node = error.get('column') or error.get('node')
        for spec in plan_components or []:
            if isinstance(spec, dict) and spec.get('nodeName') == node and document_for(spec.get('component', '')):
                return document_for(spec['component'])
        if check in data['checks']:
            return data['checks'][check]
    return data['gates'].get(gate) if gate else None


def annotate(value, gate=None, plan_components=None):
    """Add `rule` to every dict diagnostic inside errors lists, recursively."""
    if isinstance(value, dict):
        for key, child in value.items():
            if key == 'errors' and isinstance(child, list):
                for error in child:
                    if isinstance(error, dict) and 'rule' not in error:
                        rule = rule_for(error, gate, plan_components)
                        if rule:
                            error['rule'] = rule
            annotate(child, gate, plan_components)
    elif isinstance(value, list):
        for child in value:
            annotate(child, gate, plan_components)
    return value


def stage_sections(document):
    """Template stage anchors present in a document, in reading order."""
    from read_reference import sections
    _, headings = sections((RESOURCE_ROOT / document).read_text(encoding='utf-8'))
    anchors = {heading['anchor'] for heading in headings if heading['level'] == 2}
    return [anchor for anchor in STAGE_SECTIONS.values() if anchor in anchors]
