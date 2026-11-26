#!/usr/bin/env python3
"""Capture live template models through public reads and verify planned sources.

Never opens, saves, installs or edits a project. Acquisition is not proof that
the agent understood the source, instantiated it or adapted it correctly.
"""
import argparse
import base64
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path


OVERSEAS_TEMPLATE_ID = 'pDf4kvKBxRRLAHnjbGRwGu'
IDENTITY = ('projectId', 'branchId', 'sessionId', 'revision', 'changeCounter')
FULL_FIELDS = {'baseVariantTplTree', 'props', 'states', 'interactions', 'variants', 'variantGroups'}


def context(state):
    value = {**state.get('editorContext', {}), 'projectId': state.get('projectId')}
    if (not state.get('ready') or not state.get('buildId')
            or any(key not in value for key in IDENTITY)
            or not value.get('projectId') or not value.get('sessionId')):
        raise ValueError('A ready editor with complete identity is required')
    identity = {key: value[key] for key in IDENTITY}
    if value.get('publishedTemplateVersion'):
        identity.update(publishedTemplateVersion=value['publishedTemplateVersion'], canEdit=value.get('canEdit'))
    return identity


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


def page_descriptions(desktop, project_id):
    pages, sections = [], []
    offset = 0
    while True:
        result = desktop.execute('read', {'fromProject': project_id, 'collection': 'components',
            'fields': ['uuid', 'name', 'type', 'pageMeta', 'description'], 'offset': offset, 'limit': 100})
        source, = result['results']
        if source.get('id') != project_id:
            raise ValueError('Page descriptions came from another project')
        for item in source['components']:
            if item['type'] == 'page':
                meta = item['pageMeta']
                pages.append({'uuid': item['uuid'], 'name': item['name'], 'path': meta.get('path'),
                              'description': meta.get('description')})
            elif project_id != OVERSEAS_TEMPLATE_ID and item.get('type') == 'component':
                sections.append({'uuid': item['uuid'], 'name': item['name'], 'type': 'component',
                                 'description': item.get('description')})
        following = result.get('nextOffset')
        if following is None:
            return (pages, sections)
        if not isinstance(following, int) or following <= offset:
            raise ValueError('Page inventory pagination did not advance')
        offset = following


def capture(desktop, project_id, names=()):
    before = desktop.call('get_app_state', {})
    identity = context(before)
    is_published_canvas = (
        identity['projectId'] == project_id
        and bool(identity.get('publishedTemplateVersion'))
        and identity.get('canEdit') is False
    )
    published = project_id == OVERSEAS_TEMPLATE_ID or is_published_canvas
    if published and not is_published_canvas:
        raise ValueError('Open the current read-only publication with open_template first')
    if names:
        data = capture_models(desktop, project_id, list(dict.fromkeys(names)), published)
    elif published:
        pages, sections = page_descriptions(desktop, project_id)
        data = {'pages': pages, **({'sections': sections} if sections else {})}
    else:
        raise ValueError('Specify component names for an imported template source')

    after = desktop.call('get_app_state', {})
    if context(after) != identity or after.get('buildId') != before['buildId']:
        raise ValueError('Editor identity changed during template acquisition')
    if published:
        data['sourceVersion'] = identity['publishedTemplateVersion']
    return {**data, 'sourceProjectId': project_id, 'before': identity, 'after': context(after),
            'collectedAt': datetime.now(timezone.utc).isoformat(), 'buildId': before['buildId'],
            'screenshotCount': len(data.get('screenshots', {}))}


def capture_models(desktop, project_id, names, published):
    screenshots = {}
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
        model = full_model(result, project_id, name)
        models.append(model)
        if published:
            valid_types = ('page',) if project_id == OVERSEAS_TEMPLATE_ID else ('page', 'component')
            if model.get('type') not in valid_types:
                raise ValueError('Select an actual published Page' + (' or component' if project_id != OVERSEAS_TEMPLATE_ID else '') + ': ' + name)
            page_uuid = model['uuid']
            target = desktop.execute('navigate', {'componentUuid': page_uuid})
            frame = target.get('frameUuid')
            if target.get('componentUuid') != page_uuid or not isinstance(frame, str) or not frame.strip():
                raise ValueError('Navigation did not resolve the published artboard for ' + name)
            image = desktop.call('get_screenshot', {'frameUuid': frame, 'liveCanvas': True})
            screenshots[page_uuid] = {**image, 'frameUuid': frame}
        full_reads[name] = result
    contracts = []
    for offset in range(0, len(models), 30):
        contracts.append(desktop.execute('read', {'fromProject': project_id,
            'componentUuids': [model['uuid'] for model in models[offset:offset + 30]], 'view': 'contract'}))
    imports = consumer['results'][0].get('importedProjects', [])
    return {'sourceVersion': next((item.get('version') for item in imports if item.get('id') == project_id), None),
            'source': source, 'consumer': consumer, **({'screenshots': screenshots} if published else {}),
            'fullReads': full_reads, 'contracts': contracts}


def check_page(plan, *, overseas=False):
    errors, records = [], []
    selections = plan.get('templates')
    reason = plan.get('templatesNotApplicable')
    if not isinstance(selections, list):
        return {'passed': False, 'errors': ['Declare templates before composition, or templates:[] with a reviewed templatesNotApplicable reason'], 'sources': []}
    if overseas and (not selections or reason is not None):
        # A Page can reuse a reference for one region and compose another independently.
        if not isinstance(reason, list) or not reason or any(
                not isinstance(candidate, dict)
                or any(not isinstance(candidate.get(key), str) or not candidate[key].strip()
                       for key in ('componentName', 'missing'))
                for candidate in reason):
            errors.append('Record each reviewed candidate Page name and the missing structure or interaction in templatesNotApplicable')
        if not selections:
            return {'passed': not errors, 'errors': errors, 'sources': [],
                    'status': 'unverified' if errors else 'not_applicable',
                    'reviewedCandidates': reason,
                    'notChecked': ['correctness of the no-template-fit decision']}
    elif not selections:
        candidate_list = (
            isinstance(reason, list)
            and bool(reason)
            and all(
                isinstance(candidate, dict)
                and all(isinstance(candidate.get(key), str) and candidate[key].strip()
                        for key in ('componentName', 'missing'))
                for candidate in reason
            )
        )
        valid = (isinstance(reason, str) and bool(reason.strip())) or candidate_list
        return {'passed': valid, 'errors': [] if valid else ['Empty templates requires a source-reviewed scenario mismatch reason'],
                'sources': [], 'status': 'not_applicable' if valid else 'unverified',
                **({'reviewedCandidates': reason} if candidate_list else {'reason': reason}),
                'notChecked': ['correctness of the no-template-fit decision']}
    if not overseas and reason is not None:
        errors.append('Selected templates cannot also declare templatesNotApplicable')
    seen = set()
    for item in selections:
        try:
            if (not isinstance(item, dict) or any(not isinstance(item.get(key), str) or not item[key].strip()
                    for key in ('sourceProjectId', 'componentName', 'adaptation'))
                    or item.get('mode') not in ('reference', 'import')):
                raise ValueError('Template selection needs sourceProjectId, componentName, mode:reference/import and adaptation')
            if overseas and item['sourceProjectId'] != OVERSEAS_TEMPLATE_ID:
                raise ValueError('Select references from the published 海外 O 端 template')
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
            name = item['componentName']
            model = full_model(data.get('fullReads', {}).get(name, {}), item['sourceProjectId'], name)
            contract = contracts.get(model['uuid'], {})
            if contract.get('name') != name or not isinstance(contract.get('props'), list):
                raise ValueError('Live template contract missing or mismatched: ' + name)
            published_read = item['sourceProjectId'] == OVERSEAS_TEMPLATE_ID or bool(before.get('publishedTemplateVersion'))
            if published_read:
                valid_types = ('page',) if (overseas or item['sourceProjectId'] == OVERSEAS_TEMPLATE_ID) else ('page', 'component')
                if (item['mode'] != 'reference' or model.get('type') not in valid_types
                        or before['projectId'] != item['sourceProjectId'] or before.get('canEdit') is not False
                        or not data.get('sourceVersion') or before.get('publishedTemplateVersion') != data['sourceVersion']):
                    raise ValueError('A Page from the read-only template publication is required')
                image = data.get('screenshots', {}).get(model['uuid'], {})
                pixels = base64.b64decode(image.get('data', ''), validate=True)
                if (image.get('mimeType') != 'image/webp' or pixels[:4] != b'RIFF'
                        or pixels[8:12] != b'WEBP' or len(pixels) <= 12):
                    raise ValueError('Rendered screenshot missing for ' + name)
            models = [{'name': name, 'uuid': model['uuid']}]
            records.append({'sourceProjectId': item['sourceProjectId'], 'sourceVersion': data.get('sourceVersion'),
                            'models': models, 'sourceRead': 'passed', 'plannedMode': item['mode'],
                            'actualReuse': 'unverified'})
        except (OSError, ValueError, TypeError, KeyError, AttributeError) as error:
            errors.append(str(error))
    return {'passed': not errors, 'errors': errors, 'sources': records,
            **({'reviewedCandidates': reason} if overseas and reason else {}),
            'notChecked': ['source interpretation', 'actual template insertion/detachment', 'adaptation quality']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--profile', type=Path, required=True)
    parser.add_argument('--source-project-id', required=True)
    parser.add_argument('--names', nargs='+', help='Capture only these selected or ambiguous candidates; omit for the published Page descriptions')
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
                          'screenshotCount': data['screenshotCount'],
                          **({'pageCount': len(data['pages']), 'next': 'Read the descriptions in the output file'}
                             if 'pages' in data else {'components': list(data['fullReads'])})}, ensure_ascii=False))
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(json.dumps({'passed': False, 'error': str(error),
              'next': 'Open the published template or the intended source, then retry; the collector navigates only between artboards in the open publication'}, ensure_ascii=False))
        raise SystemExit(1)


if __name__ == '__main__':
    main()
