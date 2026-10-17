#!/usr/bin/env python3
"""Supplemental REQ075 model checks. Input is a verify_all capture directory."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'scripts'))
from verify_forms import TextTree, node_name, props
from verify_slots import walk
from verify_all import capture_errors, read_capture, read_json

capture_dir, output = map(Path, sys.argv[1:3])
capture, hashes, overview, readback, _ = read_capture(capture_dir)
errors = capture_errors(capture_dir, capture['projectId'], capture, overview, readback['results'], hashes)
if errors:
    raise ValueError('; '.join(errors))
models = {}
for model in readback['results']:
    if 'baseVariantTplTree' not in model:
        continue
    nodes = {}
    for node in walk(TextTree(model['baseVariantTplTree']).root):
        name = node_name(node)
        if name:
            if name in nodes:
                raise ValueError(f'Duplicate node name: {name}')
            nodes[name] = {**props(node), '__text': ''.join(child.get('text', '') for child in node['children'] if child['tag'] == 'text').strip()}
    route = model['pageMeta']['path']
    if route in models:
        raise ValueError(f'Duplicate Page path: {route}')
    models[route] = nodes
expected_paths = {page['path'] for page in read_json(HERE / 'structure.json')['pages']}
if len(models) != 4 or set(models) != expected_paths:
    raise ValueError('Full four-page capture at the reviewed REQ075 routes required')
output.mkdir(parents=True, exist_ok=False)
model_file = output / 'model.json'
model_file.write_text(json.dumps(models, ensure_ascii=False))
run = subprocess.run(['node', str(HERE / 'check-behavior.cjs'), str(model_file)], capture_output=True, text=True)
if not run.stdout:
    raise RuntimeError(run.stderr)
report = json.loads(run.stdout)
report['capture'] = capture
inputs = [Path(__file__), HERE / 'check-behavior.cjs', HERE / 'structure.json',
          *sorted((HERE.parents[1] / 'scripts').glob('verify_*.py'))]
report['checkedInputs'] = {str(path.resolve()): hashlib.sha256(path.read_bytes()).hexdigest() for path in inputs}
(output / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(json.dumps({'passed': report['passed'], 'cases': len(report['cases']), 'report': str(output / 'report.json')}))
sys.exit(run.returncode)
