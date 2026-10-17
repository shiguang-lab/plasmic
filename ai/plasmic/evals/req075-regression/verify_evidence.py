#!/usr/bin/env python3
"""Check REQ075 saved visual evidence integrity and model/build applicability.

This does not execute Preview or grant a new visual-quality result. Current
layouts and required runtime interactions remain separate acceptance evidence.
"""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
sys.path.insert(0, str(HERE.parents[1] / 'scripts'))
from verify_all import capture_errors, read_capture, read_json, same_json

# Source-reviewed hidden states from scope.md; these are not inferred from the
# submitted manifest or a previous passed report.
STATES = {
    ('/req-075/groups', 'CreateOnetimeGroupModal'): {'default', 'validation'},
    ('/req-075/groups', 'MetadataModal'): {'default'},
    ('/req-075/groups', 'ExportModal'): {'default'},
    ('/req-075/regular', 'PreflightModal'): {'running', 'failure', 'success-top', 'success-bottom'},
    ('/req-075/onetime', 'PreflightModal'): {'running', 'failure', 'success-top', 'success-bottom'},
    ('/req-075/detail', 'ViewSQLModal'): {'default'},
    ('/req-075/detail', 'RecordDrawer'): {'selection-failure', 'application-failure'},
    ('/req-075/detail', 'ApplicationModal'): {'default', 'validation', 'busy', 'success'},
    ('/req-075/groups', 'disable'): {'confirmation'},
    ('/req-075/groups', 'enable'): {'confirmation'},
    ('/req-075/groups', 'delete'): {'confirmation'},
    ('/req-075/groups', 'launch'): {'confirmation'},
    ('/req-075/detail', 'retry'): {'confirmation', 'result'},
}


def load_capture(directory, project_id):
    capture, hashes, overview, models, _ = read_capture(directory)
    errors = capture_errors(directory, project_id, capture, overview, models['results'], hashes)
    if errors:
        raise ValueError('; '.join(errors))
    return capture, models


def check(manifest, current, root=ROOT):
    project_id = manifest['projectId']
    recorded, original = load_capture(root / manifest['modelCapture']['path'], project_id)
    live, models = load_capture(current, project_id)
    errors = []
    if (recorded['files']['pages.json'] != manifest['modelCapture']['pagesSha256']
            or not same_json(original, models) or not same_json(recorded['build'], live['build'])
            or not same_json(manifest['build'], recorded['build'])
            or manifest['desktopVersion'] != recorded['desktopVersion']
            or manifest['desktopVersion'] != live['desktopVersion']
            or manifest['revision'] != recorded['after']['revision']
            or manifest['revision'] != live['after']['revision']
            or recorded['after']['branchId'] != live['after']['branchId']):
        errors.append('Model/build/revision differs; saved screenshots need a new applicability review')
    source = manifest['source']
    if hashlib.sha256(Path(source['path']).read_bytes()).hexdigest() != source['sha256']:
        errors.append('Requirement source changed; review acceptance scope again')
    overlays = {(page['path'], overlay['name']) for page in read_json(HERE / 'overlays.json')['pages']
                for overlay in page['overlays']}
    if overlays != {key for key in STATES if key[1].endswith(('Modal', 'Drawer'))}:
        errors.append('Reviewed hidden-state inventory differs from the full overlay inventory')
    if (manifest.get('passed') is not True or manifest.get('modalDrawerCount') != len(overlays)
            or manifest.get('confirmationCount') != len(STATES) - len(overlays)):
        errors.append('Incomplete or inconsistent reviewed visual result')
    cases = manifest['cases']
    keys = [(case['page'], case.get('overlay') or case.get('action')) for case in cases]
    if Counter(keys) != Counter(STATES.keys()):
        errors.append('Missing, extra or duplicate visual surfaces')
    paths, hashes = set(), set()
    for case, key in zip(cases, keys):
        captures = case['captures']
        states = [capture['state'] for capture in captures]
        if Counter(states) != Counter(STATES.get(key, set())):
            errors.append(f'Missing, extra or duplicate required states: {key}')
        if case['passed'] is not True or not case['observation'].strip() or case['viewport'] != {'width': 1440, 'height': 720}:
            errors.append(f'Incomplete reviewed short-screen observation: {key}')
        for capture in captures:
            path = (root / capture['path']).resolve()
            if (not path.is_relative_to(root.resolve()) or path in paths or capture['sha256'] in hashes
                    or hashlib.sha256(path.read_bytes()).hexdigest() != capture['sha256']):
                errors.append(f'Missing, duplicate or changed screenshot: {capture["path"]}')
            paths.add(path)
            hashes.add(capture['sha256'])
    return {'passed': not errors, 'scope': 'artifact integrity and applicability; not a new Preview execution',
            'projectId': project_id, 'revision': live['after']['revision'],
            'surfaces': len(cases), 'captures': len(paths), 'errors': errors}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('capture', type=Path)
    parser.add_argument('--manifest', type=Path, default=HERE / 'short-screen-evidence.json')
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    try:
        result = check(read_json(args.manifest), args.capture)
    except (OSError, ValueError, KeyError, TypeError) as error:
        result = {'passed': False, 'errors': [str(error)]}
    inputs = [Path(__file__), args.manifest, HERE / 'overlays.json',
              *sorted((HERE.parents[1] / 'scripts').glob('verify_*.py'))]
    result['checkedInputs'] = {str(path.resolve()): hashlib.sha256(path.read_bytes()).hexdigest()
                               for path in inputs if path.is_file()}
    if args.report:
        args.report.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({key: value for key, value in result.items() if key != 'checkedInputs'}, ensure_ascii=False))
    raise SystemExit(0 if result['passed'] else 1)


if __name__ == '__main__':
    main()
