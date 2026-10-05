#!/usr/bin/env python3
"""Compare fresh public MCP page readbacks while ignoring generated identities."""
import argparse
import hashlib
import json
import re
from pathlib import Path


def canonical(model):
    value = dict(model)
    html = value["baseVariantTplTree"]
    ids = list(dict.fromkeys(re.findall(r'\bid="([^"]+)"', html)))
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
                return re.sub(r'\bid="([^"]+)"', lambda m: 'id="' + names[m[1]] + '"', node)
        return node

    return normalize(value)


def load(path):
    return {m["pageMeta"]["path"]: canonical(m) for m in json.loads(path.read_text())["results"] if m.get("type") == "page"}


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
        fingerprint = lambda value: hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
        results.append({"path": route, "equal": first == second, "firstFingerprint": fingerprint(first), "secondFingerprint": fingerprint(second)})
    report = {"passed": bool(results) and all(r["equal"] for r in results), "pages": results}
    if args.report:
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    raise SystemExit(0 if report["passed"] else 1)


if __name__ == "__main__":
    main()
