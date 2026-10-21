#!/usr/bin/env python3
"""Capture live template models through public reads and verify planned sources.

Never opens, saves, installs or edits a project. Acquisition is not proof that
the agent understood the source, instantiated it or adapted it correctly.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path


CATALOG = Path(__file__).resolve().parent.parent / 'references/templates/admin/catalog.json'
IDENTITY = ('projectId', 'branchId', 'sessionId', 'revision', 'changeCounter')
FULL_FIELDS = {'baseVariantTplTree', 'props', 'states', 'interactions', 'variants', 'variantGroups'}


def source_names(project_id, names):
    """Include catalog-owned nested compositions, without copying catalog props."""
    catalog = json.loads(CATALOG.read_text(encoding='utf-8'))
    by_name = {item['componentName']: item for item in catalog['templates']}
    result = list(dict.fromkeys(names))
    if project_id == catalog['projectId']:
        for name in result:
            if name not in by_name:
                raise ValueError('Selected component is absent from the template catalog: ' + name)
            result.extend(child for child in by_name[name].get('nestedTemplates', []) if child not in result)
    return result


def context(state):
    value = {**state.get('editorContext', {}), 'projectId': state.get('projectId')}
    if (not state.get('ready') or not state.get('buildId')
            or any(key not in value for key in IDENTITY)
            or not value.get('projectId') or not value.get('sessionId')):
        raise ValueError('A ready editor with complete identity is required')
    return {key: value[key] for key in IDENTITY}


def full_model(response, project_id, name):
    read = response.get('read', {})
    projects = response.get('results', [])
    if (len(projects) != 1 or projects[0].get('id') != project_id
            or read.get('itemDepth') != 'all' or not FULL_FIELDS.issubset(read.get('itemFields', []))):
        raise ValueError('Complete native collection read required for ' + name)
    matches = [model for model in projects[0].get('components', []) if model.get('name') == name]
    if len(matches) != 1:
        raise ValueError('Exactly one live template definition required: ' + name)
    model = matches[0]
    if (not model.get('uuid') or not isinstance(model.get('baseVariantTplTree'), str)
            or not model['baseVariantTplTree'].strip() or '<plasmic-node-ref' in model['baseVariantTplTree']
            or any(not isinstance(model.get(key), list) for key in FULL_FIELDS - {'baseVariantTplTree'})):
        raise ValueError('Template read is incomplete: ' + name)
    return model


def capture(desktop, project_id, names):
    names = source_names(project_id, names)
    before = desktop.call('get_app_state', {})
    identity = context(before)
    # fromProject resolves only the open source or an existing dependency.
    # A missing dependency must be acquired explicitly by the caller.
    source = desktop.execute('read', {'fromProject': project_id, 'fields': ['__type', 'id', 'importedProjects']})
    if len(source.get('results', [])) != 1 or source['results'][0].get('id') != project_id:
        raise ValueError('Live source project identity differs from the selection')
    consumer = desktop.execute('read', {'fields': ['__type', 'id', 'importedProjects']})
    full_reads, models = {}, []
    for name in names:
        result = desktop.execute('read', {'fromProject': project_id, 'collection': 'components',
            'nameContains': name, 'view': 'full', 'depth': 'all', 'limit': 100})
        models.append(full_model(result, project_id, name))
        full_reads[name] = result
    contracts = []
    for offset in range(0, len(models), 30):
        contracts.append(desktop.execute('read', {'fromProject': project_id,
            'componentUuids': [model['uuid'] for model in models[offset:offset + 30]], 'view': 'contract'}))
    after = desktop.call('get_app_state', {})
    if context(after) != identity or after.get('buildId') != before['buildId']:
        raise ValueError('Editor identity changed during template acquisition')
    imports = consumer['results'][0].get('importedProjects', [])
    version = next((item.get('version') for item in imports if item.get('id') == project_id), None)
    return {'sourceProjectId': project_id, 'sourceVersion': version,
            'collectedAt': datetime.now(timezone.utc).isoformat(), 'buildId': before['buildId'],
            'before': identity, 'after': context(after), 'source': source, 'consumer': consumer,
            'fullReads': full_reads, 'contracts': contracts}


def check_page(plan):
    errors, records = [], []
    selections = plan.get('templates')
    reason = plan.get('templatesNotApplicable')
    if not isinstance(selections, list):
        return {'passed': False, 'errors': ['Declare templates before composition, or templates:[] with a reviewed templatesNotApplicable reason'], 'sources': []}
    if not selections:
        valid = isinstance(reason, str) and bool(reason.strip())
        return {'passed': valid, 'errors': [] if valid else ['Empty templates requires a source-reviewed scenario mismatch reason'],
                'sources': [], 'status': 'not_applicable' if valid else 'unverified',
                'reason': reason, 'notChecked': ['correctness of the no-template-fit decision']}
    if reason is not None:
        errors.append('Selected templates cannot also declare templatesNotApplicable')
    seen = set()
    for item in selections:
        try:
            if (not isinstance(item, dict) or any(not isinstance(item.get(key), str) or not item[key].strip()
                    for key in ('sourceProjectId', 'componentName', 'adaptation'))
                    or item.get('mode') not in ('reference', 'import')):
                raise ValueError('Template selection needs sourceProjectId, componentName, mode:reference/import and adaptation')
            key = (item['sourceProjectId'], item['componentName'])
            if key in seen:
                raise ValueError('Duplicate template selection')
            seen.add(key)
            evidence = item.get('evidence', {})
            path = Path(evidence.get('path', ''))
            if not path.is_absolute() or not path.is_file():
                raise ValueError('Original template capture requires an existing absolute evidence path')
            raw = path.read_bytes()
            if hashlib.sha256(raw).hexdigest() != evidence.get('sha256'):
                raise ValueError('Template capture changed; reread and review the source')
            data = json.loads(raw)
            before = data.get('before', {})
            if (data.get('sourceProjectId') != item['sourceProjectId'] or not data.get('buildId')
                    or not before.get('projectId') or not before.get('sessionId')
                    or any(key not in before for key in IDENTITY) or data.get('after') != before):
                raise ValueError('Stable live template source/editor identity required')
            source = data.get('source', {}).get('results', [])
            if len(source) != 1 or source[0].get('id') != item['sourceProjectId']:
                raise ValueError('Native source Project read is missing or belongs to another project')
            contracts = {model.get('uuid'): model for response in data.get('contracts', [])
                         if 'props' in response.get('read', {}).get('fields', [])
                         for model in response.get('results', [])}
            models = []
            for name in source_names(item['sourceProjectId'], [item['componentName']]):
                model = full_model(data.get('fullReads', {}).get(name, {}), item['sourceProjectId'], name)
                contract = contracts.get(model['uuid'], {})
                if contract.get('name') != name or not isinstance(contract.get('props'), list):
                    raise ValueError('Live template contract missing or mismatched: ' + name)
                models.append({'name': name, 'uuid': model['uuid']})
            records.append({'sourceProjectId': item['sourceProjectId'], 'sourceVersion': data.get('sourceVersion'),
                            'models': models, 'sourceRead': 'passed', 'plannedMode': item['mode'],
                            'actualReuse': 'unverified'})
        except (OSError, ValueError, TypeError, KeyError, AttributeError) as error:
            errors.append(str(error))
    return {'passed': not errors, 'errors': errors, 'sources': records,
            'notChecked': ['source interpretation', 'actual template insertion/detachment', 'adaptation quality']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--profile', type=Path, required=True)
    parser.add_argument('--source-project-id', required=True)
    parser.add_argument('--names', nargs='+', required=True, help='Selected live component names, not UUID guesses')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    try:
        from verify_all import Desktop
        data = capture(Desktop(args.profile), args.source_project_id, args.names)
        raw = (json.dumps(data, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
        with args.output.open('xb') as stream:
            stream.write(raw)
        print(json.dumps({'path': str(args.output.resolve()), 'sha256': hashlib.sha256(raw).hexdigest(),
                          'sourceProjectId': data['sourceProjectId'], 'sourceVersion': data['sourceVersion'],
                          'components': list(data['fullReads']), 'next': 'Read and interpret the captured model before composition'}, ensure_ascii=False))
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(json.dumps({'passed': False, 'error': str(error),
              'next': 'Explicitly open the source safely or acquire a compatible library, then retry; this script never navigates or installs'}, ensure_ascii=False))
        raise SystemExit(1)


if __name__ == '__main__':
    main()
