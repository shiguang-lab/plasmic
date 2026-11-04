#!/usr/bin/env python3
"""Compare public Page models; paired captures also check runtime environment continuity.

Capture comparison is required before carrying a prior runtime report across
save/reopen. Neither mode executes runtime cases or proves that reopen occurred.
"""
import argparse
import hashlib
import json
import re
from html import unescape
from html.parser import HTMLParser
from pathlib import Path


class ElementIds(HTMLParser):
    """Locate actual id attributes without touching text or data-* values."""
    def __init__(self, markup):
        super().__init__(convert_charrefs=False)
        self.starts, self.ids = [0], []
        for line in markup.splitlines(keepends=True):
            self.starts.append(self.starts[-1] + len(line))
        self.feed(markup)

    def handle_starttag(self, tag, attrs):
        raw = self.get_starttag_text()
        line, column = self.getpos()
        offset = self.starts[line - 1] + column
        # Consume complete attribute values so id="..." inside another
        # attribute's quoted value cannot become an identity match.
        for match in re.finditer(r'''\s+([^\s=/>]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?''', raw):
            if match[1].lower() != 'id' or match[2] is None:
                continue
            quoted = match[2][:1] in ('"', "'")
            start, end = match.span(2)
            start, end = start + int(quoted), end - int(quoted)
            self.ids.append((offset + start, offset + end, unescape(raw[start:end])))


def canonical(model):
    value = dict(model)
    html = value["baseVariantTplTree"]
    attributes = ElementIds(html).ids
    ids = list(dict.fromkeys(value for _, _, value in attributes))
    names = {node_id: f"element:{i}" for i, node_id in enumerate(ids)}
    names[model["uuid"]] = "page:" + model["pageMeta"]["path"]
    for field in ["states", "interactions", "props", "variants", "variantGroups"]:
        for entry in model.get(field, []):
            if "uuid" in entry:
                names[entry["uuid"]] = field + ":" + entry.get("name", str(len(names)))

    def normalize(node):
        if isinstance(node, dict):
            return {k: normalize(v) for k, v in node.items()}
        if isinstance(node, list):
            return [normalize(v) for v in node]
        if isinstance(node, str):
            if node in names:
                return names[node]
            if node == html:
                for start, end, value in reversed(attributes):
                    node = node[:start] + names[value] + node[end:]
                return node
        return node

    return normalize(value)


def pages_from(data):
    pages = {}
    for model in data["results"]:
        if model.get("type") != "page":
            continue
        route = model["pageMeta"]["path"]
        if not isinstance(route, str) or not route.strip() or route in pages:
            raise ValueError("Distinct nonempty Page paths required")
        pages[route] = canonical(model)
    return pages


def load(path):
    return pages_from(json.loads(path.read_text(encoding="utf-8")))


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, allow_nan=False).encode()).hexdigest()


def compare_captures(captures, page_bytes):
    from verify_all import same_json, valid_build, valid_identity
    errors = []
    for label, capture, raw in zip(('first', 'second'), captures, page_bytes):
        if not isinstance(capture, dict):
            errors.append(f'{label}: capture must be an object')
            continue
        before, after = capture.get('before'), capture.get('after')
        if not valid_identity(before) or not valid_identity(after) or not same_json(before, after):
            errors.append(f'{label}: stable capture identity required')
        if not isinstance(after, dict) or capture.get('projectId') != after.get('projectId'):
            errors.append(f'{label}: capture project must match its editor identity')
        files = capture.get('files')
        if not isinstance(files, dict) or files.get('pages.json') != hashlib.sha256(raw).hexdigest():
            errors.append(f'{label}: capture pages hash does not match the compared Page readback')
        if not valid_build(capture.get('build')):
            errors.append(f'{label}: complete runtime build hashes required')
        if not isinstance(capture.get('desktopVersion'), str) or not capture['desktopVersion'].strip():
            errors.append(f'{label}: Desktop version required')
        if capture.get('pagePath') is not None and (not isinstance(capture['pagePath'], str) or not capture['pagePath'].startswith('/')):
            errors.append(f'{label}: invalid capture Page scope')
    if not errors:
        first, second = captures
        for field in ('projectId', 'pagePath', 'desktopVersion', 'build'):
            if not same_json(first.get(field), second.get(field)):
                errors.append(f'Capture {field} changed; do not carry the prior runtime report forward')
        if not same_json(first['after']['branchId'], second['after']['branchId']):
            errors.append('Capture branch changed; do not carry the prior runtime report forward')
    return {'passed': not errors, 'errors': errors}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("first", type=Path)
    parser.add_argument("second", type=Path)
    parser.add_argument("--first-capture", type=Path, help="Exercised capture.json; requires --second-capture")
    parser.add_argument("--second-capture", type=Path, help="Fresh reopened capture.json; requires --first-capture")
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    if bool(args.first_capture) != bool(args.second_capture):
        parser.error('--first-capture and --second-capture must be supplied together')
    paths = [args.first, args.second]
    if args.first_capture:
        paths += [args.first_capture, args.second_capture]
    raw = [path.read_bytes() for path in paths]
    a, b = [pages_from(json.loads(data)) for data in raw[:2]]
    results = []
    for route in sorted(a.keys() | b.keys()):
        first, second = a.get(route), b.get(route)
        first_hash, second_hash = fingerprint(first), fingerprint(second)
        results.append({"path": route, "equal": first_hash == second_hash, "firstFingerprint": first_hash, "secondFingerprint": second_hash})
    report = {"passed": bool(results) and all(r["equal"] for r in results), "pages": results,
              "scope": "normalized Page models only", "notChecked": ["runtime execution", "actual save/reopen operation", "visual behavior"]}
    if args.first_capture:
        report['scope'] = 'normalized Page models and captured runtime environment'
        try:
            report['captureComparison'] = compare_captures([json.loads(data) for data in raw[2:]], raw[:2])
        except (ValueError, TypeError, KeyError) as error:
            report['captureComparison'] = {'passed': False, 'errors': [str(error)]}
        report['passed'] = report['passed'] and report['captureComparison']['passed']
    else:
        report['notChecked'].append('capture environment compatibility; cannot carry a runtime report forward')
    if any(path.read_bytes() != data for path, data in zip(paths, raw)):
        report['passed'] = False
        report['errors'] = ['Compared models or captures changed during verification']
    if args.report:
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    raise SystemExit(0 if report["passed"] else 1)


if __name__ == "__main__":
    main()
