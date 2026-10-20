#!/usr/bin/env python3
"""Audit actual Desktop prototype_task events/evidence, without running a model.

Input is a Desktop prototype-runs/RUN_ID directory, not a model-written timeline.
The controller enforces transitions before writes. This checks its recorded
sequence and files; visual judgments still require independent review.
"""
import argparse
import hashlib
import json
from pathlib import Path


def check(task, events):
    errors = []
    if not events or [e.get('seq') for e in events] != list(range(1, len(events) + 1)) or task.get('seq') != len(events):
        raise ValueError('Complete sequential Desktop event recording required')
    paths = [page['path'] for page in task['pages']]
    if not paths or len(set(paths)) != len(paths):
        raise ValueError('Distinct source-reviewed routes required')
    states = {route: set() for route in paths}
    active, current_case, cancelled = None, None, False
    images = {}

    def invalidate_targets(routes):
        for spec in task['pages']:
            for case in spec['runtimeCases']:
                if case.get('targetPath') in routes:
                    states[spec['path']].discard('case:' + case['id'])

    for event in events:
        kind, page = event['kind'], event.get('page')
        if kind == 'cancelled':
            cancelled = True
        elif kind == 'resumed':
            cancelled = False
        elif kind == 'plan_revised':
            affected = event.get('pages', paths)
            for route in affected:
                states[route] = {'begun'} if route == active else set()
            invalidate_targets(affected)
            current_case = None
        elif kind == 'begin_page':
            if page not in states:
                raise ValueError('Unknown Page in Desktop event stream')
            if active and active != page and 'complete' not in states[active]:
                errors.append(f'{page}: advanced before {active} completed')
            active = page
            states[page].add('begun')
        elif kind in {'reopened', 'external_change', 'build_changed'}:
            states = {route: set() for route in paths}
            current_case = None
            if kind == 'reopened':
                active = None
        elif kind == 'reference_changed':
            for route in event['pages']:
                states[route] = {'begun'} if route == active else set()
            invalidate_targets(event['pages'])
            current_case = None
        elif kind == 'mutation':
            if cancelled:
                errors.append('Design mutation after task cancellation without resuming its baseline')
            if event.get('emptyPagesOnly'):
                continue
            if event.get('global'):
                states = {route: ({'begun'} if route == active else set()) for route in paths}
            elif page:
                if page != active or 'begun' not in states[page]:
                    errors.append(f'{page}: mutation before its plan/reference gate')
                states[page] = {'begun'}
            current_case = None
            for spec in task['pages']:
                for case in spec['runtimeCases']:
                    if event.get('global') or case.get('targetPath') == page:
                        states[spec['path']].discard('case:' + case['id'])
        elif kind == 'structural_check':
            if page != active or 'begun' not in states.get(page, set()):
                errors.append(f'{page}: invalid structural checkpoint order')
            report = event['report']
            if hashlib.sha256(Path(report['reportPath']).read_bytes()).hexdigest() != report['sha256']:
                errors.append(f'{page}: structural report changed')
            states[page] = {'begun', 'structure'}
        elif kind == 'image':
            images[event['evidence']['id']] = event['evidence']
        elif kind == 'visual_review':
            if 'structure' not in states.get(page, set()) or event.get('status') != 'review_recorded':
                errors.append(f'{page}: visual review without structural evidence')
            for note in event['observations']:
                image = images.get(note['generatedEvidenceId'])
                if not image or image['page'] != page or note['result'] == 'failed':
                    errors.append(f'{page}: missing/wrong-Page image comparison')
            states[page].add('visual')
        elif kind == 'begin_case':
            if 'structure' not in states.get(page, set()):
                errors.append(f'{page}: runtime case before structural evidence')
            current_case = (page, event['caseId'])
        elif kind == 'case_cancelled':
            current_case = None
        elif kind == 'preview' and event.get('caseCompleted'):
            if not current_case or current_case[1] != event.get('caseId') or event.get('passed') is not True or not event.get('checks') or not all(c.get('passed') is True for c in event['checks']):
                errors.append('Runtime completion lacks actual successful Preview assertions')
            else:
                states[current_case[0]].add('case:' + current_case[1])
                current_case = None
        elif kind == 'complete_page':
            spec = next(p for p in task['pages'] if p['path'] == page)
            required = {'structure', 'visual', *('case:' + c['id'] for c in spec['runtimeCases'] if not c.get('deferred'))}
            if not required.issubset(states[page]):
                errors.append(f'{page}: completed with missing checkpoints')
            states[page].add('complete')
        elif kind == 'finished':
            if hashlib.sha256(Path(event['reportPath']).read_bytes()).hexdigest() != event.get('sha256'):
                errors.append('Final full-project report changed')
    for spec in task['pages']:
        if 'complete' not in states[spec['path']] or any('case:' + c['id'] not in states[spec['path']] for c in spec['runtimeCases']):
            errors.append(spec['path'] + ': incomplete final Page/runtime evidence')
    for image in task['images'].values():
        if hashlib.sha256(Path(image['file']).read_bytes()).hexdigest() != image['sha256']:
            errors.append('Collected screenshot changed: ' + image['file'])
    for file, digest in task['pinned'].items():
        if hashlib.sha256(Path(file).read_bytes()).hexdigest() != digest:
            errors.append('Source/plan changed: ' + file)
        archived = task.get('baseline', {}).get(file)
        if archived and hashlib.sha256(Path(archived['file']).read_bytes()).hexdigest() != digest:
            errors.append('Archived reviewed baseline changed: ' + file)
    if task.get('ended') != 'complete' or events[-1]['kind'] != 'finished':
        errors.append('Desktop task has not completed save/reopen and final verification')
    return {'passed': not errors, 'deliveryStatus': 'recorded_checks_complete' if not errors else 'incomplete',
            'scope': 'actual Desktop event/evidence consistency; visual quality remains independent review', 'errors': errors, 'runId': task['id'], 'metrics': task.get('metrics', {}), 'pageMetrics': task.get('pageMetrics', {})}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('task_directory', type=Path)
    parser.add_argument('--report', type=Path, required=True)
    args = parser.parse_args()
    try:
        task = json.loads((args.task_directory / 'task.json').read_text(encoding='utf-8'))
        events = [json.loads(line) for line in (args.task_directory / 'events.jsonl').read_text(encoding='utf-8').splitlines() if line]
        report = check(task, events)
    except (OSError, ValueError, KeyError, TypeError) as error:
        report = {'passed': False, 'errors': [str(error)]}
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'passed': report['passed'], 'errors': report['errors'], 'report': str(args.report)}))
    raise SystemExit(0 if report['passed'] else 1)


if __name__ == '__main__':
    main()
