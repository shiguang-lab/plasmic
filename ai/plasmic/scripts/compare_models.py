#!/usr/bin/env python3
"""Compare fresh public MCP page readbacks while ignoring generated identities."""
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


def load(path):
    pages = {}
    for model in json.loads(path.read_text(encoding="utf-8"))["results"]:
        if model.get("type") != "page":
            continue
        route = model["pageMeta"]["path"]
        if not isinstance(route, str) or not route.strip() or route in pages:
            raise ValueError("Distinct nonempty Page paths required")
        pages[route] = canonical(model)
    return pages


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, allow_nan=False).encode()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("first", type=Path)
    parser.add_argument("second", type=Path)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    a, b = load(args.first), load(args.second)
    results = []
    for route in sorted(a.keys() | b.keys()):
        first, second = a.get(route), b.get(route)
        first_hash, second_hash = fingerprint(first), fingerprint(second)
        results.append({"path": route, "equal": first_hash == second_hash, "firstFingerprint": first_hash, "secondFingerprint": second_hash})
    report = {"passed": bool(results) and all(r["equal"] for r in results), "pages": results}
    if args.report:
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    raise SystemExit(0 if report["passed"] else 1)


if __name__ == "__main__":
    main()
