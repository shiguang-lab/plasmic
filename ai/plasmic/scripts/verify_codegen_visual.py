#!/usr/bin/env python3
"""Prepare and check paired design/implementation visual acceptance evidence.

This gate proves recorded coverage and artifact freshness, not pixel semantics or
that a running app actually served the recorded source snapshot.
"""
import argparse
import copy
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

import verify_visual_scenarios as visual
from verify_review import captured_file, page_models, plan_digest, project_model

RULE = 'references/codegen/visual-acceptance.md'


def source_snapshot(plan):
    scope = plan.get('implementation')
    if not isinstance(scope, dict) or not visual.text(scope.get('root')):
        raise ValueError('implementation needs an absolute root and paths covering the reviewed application')
    root = Path(scope['root'])
    paths = scope.get('paths')
    if (not root.is_absolute() or not root.is_dir() or not isinstance(paths, list) or not paths
            or not all(visual.text(path) for path in paths) or len(set(paths)) != len(paths)):
        raise ValueError('implementation root must exist; paths must be unique nonempty relative files/directories')
    root = root.resolve()
    files = {}
    for name in paths:
        relative = Path(name)
        if relative.is_absolute() or '..' in relative.parts:
            raise ValueError('Implementation paths must stay within root')
        target = root / relative
        if not target.exists():
            raise ValueError(f'Implementation input does not exist: {name}')
        candidates = [target, *target.rglob('*')] if target.is_dir() else [target]
        for path in candidates:
            if path.is_symlink() or root not in (path.resolve(), *path.resolve().parents):
                raise ValueError(f'Capture real implementation files, not symlinks or external paths: {path}')
            if path.is_file():
                files[path.relative_to(root).as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
    if not files:
        raise ValueError('Implementation scope contains no files')
    snapshot = {'root': str(root), 'paths': sorted(paths), 'files': dict(sorted(files.items()))}
    return {**snapshot, 'sha256': plan_digest(snapshot)}


def planned_pages(plan):
    pages = plan.get('pages') if isinstance(plan, dict) else None
    if not isinstance(pages, list) or not pages:
        raise ValueError('A nonempty pages inventory is required')
    routes = set()
    for page in pages:
        route = page.get('path') if isinstance(page, dict) else None
        if (not visual.text(route) or not route.startswith('/') or route in routes
                or not isinstance(page.get('visualScenarios'), list)):
            raise ValueError('Each Page needs a unique path and explicit visualScenarios array')
        routes.add(route)
    return pages


def design_inputs(plan, capture, readback, overview):
    pages = planned_pages(plan)
    state = capture.get('after') if isinstance(capture, dict) else None
    if not visual.valid_state(state) or capture.get('before') != state:
        raise ValueError('Design capture must have a stable complete before/after identity')
    scope = capture.get('pagePath')
    if scope is not None and [page['path'] for page in pages] != [scope]:
        raise ValueError('Scoped design capture must match the complete planned Page scope')
    models = page_models(readback)
    for page in pages:
        if page['path'] not in models:
            raise ValueError(f"Missing complete design Page: {page['path']}")
    project = project_model(overview, state)
    return pages, models, project, state


def skeleton(plan, capture, readback, overview):
    pages, models, project, state = design_inputs(plan, capture, readback, overview)
    return {'checkedPlanSha256': plan_digest(plan), 'checkedState': state,
            'checkedImplementation': source_snapshot(plan),
            'pages': [{'path': page['path'],
                       'sourceCoverage': {'reviewed': False, 'sources': [], 'notes': visual.PENDING},
                       'visualScenarios': [{**scene, 'context': {
                           'viewport': {'width': visual.PENDING, 'height': visual.PENDING},
                           'contentWidth': visual.PENDING, 'fixture': visual.PENDING,
                           'role': visual.PENDING, 'locale': visual.PENDING, 'scroll': visual.PENDING},
                           'attempts': []}
                          for scene in visual.skeleton(page, models[page['path']], project)]}
                      for page in pages]}


def valid_context(context):
    if not isinstance(context, dict):
        return False
    viewport = context.get('viewport')
    return (isinstance(viewport, dict) and set(viewport) == {'width', 'height'}
            and all(type(viewport[k]) is int and viewport[k] > 0 for k in viewport)
            and type(context.get('contentWidth')) is int and 0 < context['contentWidth'] <= viewport['width']
            and all(visual.text(context.get(k)) for k in ('fixture', 'role', 'locale', 'scroll')))


def check(plan, review, capture, readback, overview):
    errors = []

    def issue(message, page=None, scenario=None):
        errors.append({'check': 'codegenVisual', 'rule': RULE, 'page': page,
                       'scenario': scenario, 'message': message})

    try:
        pages, models, project, state = design_inputs(plan, capture, readback, overview)
        current_source = source_snapshot(plan)
    except (ValueError, OSError, TypeError) as error:
        issue(str(error))
        return {'passed': False, 'errors': errors}
    if not isinstance(review, dict):
        review = {}
    if review.get('checkedPlanSha256') != plan_digest(plan):
        issue('Plan changed or digest is missing; reconcile the complete inventory again')
    if review.get('checkedState') != state:
        issue('Review design state differs from the captured design')
    if review.get('checkedImplementation') != current_source:
        issue('Implementation files changed or snapshot is missing; recapture and compare current code')
    reviewed_pages = review.get('pages')
    if not isinstance(reviewed_pages, list):
        reviewed_pages = []
    expected = {page['path']: page for page in pages}
    seen = set()
    # A design baseline may recur only for its own scene/context. Implementation
    # observations must be distinct, including from every design capture.
    design_paths, implementation_paths = {}, set()
    for record in reviewed_pages:
        route = record.get('path') if isinstance(record, dict) else None
        if not isinstance(route, str) or route not in expected or route in seen:
            issue('Unknown, malformed or duplicate Page review')
            continue
        seen.add(route)
        normalized = copy.deepcopy(record)
        scenes = record.get('visualScenarios')
        if not isinstance(scenes, list):
            scenes = []
        for scene_index, scene in enumerate(scenes):
            if not isinstance(scene, dict):
                continue  # Shared coverage checker reports malformed records.
            scene_id = scene.get('id')
            context = scene.get('context')
            if not valid_context(context):
                issue('Record viewport, contentWidth, fixture, role, locale and scroll context', route, scene_id)
            attempts = scene.get('attempts')
            if not isinstance(attempts, list):
                continue
            for index, attempt in enumerate(attempts):
                if not isinstance(attempt, dict):
                    continue
                pair = {}
                for side in ('design', 'implementation'):
                    observation = attempt.get(side)
                    observation = observation if isinstance(observation, dict) else {}
                    pair[side] = observation
                    if not valid_context(observation.get('context')) or observation['context'] != context:
                        issue(f'{side} capture context must match this scene and its paired capture', route, scene_id)
                    steps = observation.get('steps')
                    if not isinstance(steps, list) or not steps or not all(visual.text(step) for step in steps):
                        issue(f'{side} capture needs its actual entry steps', route, scene_id)
                    try:
                        path = visual.verified_screenshot_path(observation.get('screenshot'))
                        owner = (route, scene_id)
                        if side == 'design':
                            if path in implementation_paths or (path in design_paths and design_paths[path] != owner):
                                issue('Design capture reused for another scene or as implementation evidence', route, scene_id)
                            design_paths[path] = owner
                        else:
                            if path in design_paths or path in implementation_paths:
                                issue('Implementation needs a fresh capture distinct from all other observations', route, scene_id)
                            implementation_paths.add(path)
                    except (ValueError, OSError, TypeError) as error:
                        issue(f'{side}: {error}', route, scene_id)
                if pair['design'].get('checkedState') != state:
                    issue('Design baseline must match the frozen captured design state', route, scene_id)
                implementation = pair['implementation']
                digest = implementation.get('sourceSha256')
                if not isinstance(digest, str) or not re.fullmatch('[0-9a-f]{64}', digest):
                    issue('Implementation observation needs its captured sourceSha256', route, scene_id)
                if index == len(attempts) - 1 and digest != current_source['sha256']:
                    issue('Final comparison must observe the current implementation snapshot', route, scene_id)
                url = implementation.get('url')
                try:
                    parsed = urlsplit(url) if visual.text(url) else None
                    if parsed is None or parsed.scheme not in ('http', 'https') or not parsed.netloc:
                        raise ValueError('missing URL')
                except ValueError:
                    issue('Implementation capture needs the actual application HTTP(S) URL', route, scene_id)
                # Reuse scene coverage, concrete analysis and issue/repair/retest
                # validation with implementation captures as the changing surface.
                normalized['visualScenarios'][scene_index]['attempts'][index] = {
                    **attempt, 'checkedState': pair['design'].get('checkedState'),
                    'screenshot': implementation.get('screenshot')}
        errors.extend({**error, 'check': 'codegenVisual', 'rule': RULE} for error in
                      visual.check(expected[route], normalized, models[route], state, project))
    for route in sorted(set(expected) - seen):
        issue('Planned Page has no paired visual review', route)
    return {'passed': not errors, 'errors': errors}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=('skeleton', 'snapshot', 'check'))
    parser.add_argument('plan', type=Path)
    parser.add_argument('--capture', type=Path)
    parser.add_argument('--pages', type=Path)
    parser.add_argument('--overview', type=Path)
    parser.add_argument('--review', type=Path)
    parser.add_argument('--output', type=Path, help='New JSON file; existing evidence is never overwritten')
    args = parser.parse_args()
    try:
        plan = json.loads(args.plan.read_text(encoding='utf-8'))
        if not isinstance(plan, dict):
            raise ValueError('Plan must be an object')
        if args.command == 'snapshot':
            result = source_snapshot(plan)
        else:
            if any(value is None for value in (args.capture, args.pages, args.overview)):
                raise ValueError('--capture, --pages and --overview are required')
            capture = json.loads(args.capture.read_text(encoding='utf-8'))
            readback = captured_file(capture, args.pages, 'pages.json')
            overview = captured_file(capture, args.overview, 'overview.json')
            if args.command == 'skeleton':
                result = skeleton(plan, capture, readback, overview)
            else:
                if args.review is None:
                    raise ValueError('--review is required for check')
                review = json.loads(args.review.read_text(encoding='utf-8'))
                result = check(plan, review, capture, readback, overview)
        output = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
        if args.output:
            with args.output.open('x', encoding='utf-8') as stream:
                stream.write(output)
        else:
            print(output, end='')
    except (ValueError, OSError, TypeError) as error:
        parser.error(str(error))
    raise SystemExit(1 if args.command == 'check' and not result['passed'] else 0)


if __name__ == '__main__':
    main()
