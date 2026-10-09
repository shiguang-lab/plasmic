#!/usr/bin/env python3
"""Check independently inventoried read-only groups against public MCP models.

Expect {"pages": [{"componentUuid": "...", "groups": [{"name": "Summary",
"container": "InformationCard", "title": "Basic information", "column": 2,
"items": [{"key": "name", "label": "Name", "children": "Example"}]}]}]}.
items may instead be the exact native array expression. No expression is executed.
Only inventoried pages are checked; Preview and source inventory review remain required.
"""
import argparse
import json
from collections import Counter
from pathlib import Path
from verify_forms import TextTree, content, identity, node_name, props, slot
from verify_slots import walk


def check(inventory, readback):
    errors = []
    models = readback["results"]
    page_ids = [p["componentUuid"] for p in inventory["pages"]]
    if not page_ids or len(set(page_ids)) != len(page_ids):
        raise ValueError("Inventory requires distinct reviewed pages")
    for page in inventory["pages"]:
        page_id = page["componentUuid"]
        matches = [m for m in models if m.get("uuid") == page_id and "baseVariantTplTree" in m]
        if len(matches) != 1:
            errors.append({"page": page_id, "error": "Expected exactly one full page readback"})
            continue
        nodes = list(walk(TextTree(matches[0]["baseVariantTplTree"]).root))
        found = [n for n in nodes if identity(n) == "plasmicantd6descriptions"]
        groups = page["groups"]
        names = [g["name"] for g in groups]
        if len(set(names)) != len(names):
            raise ValueError("Information group names must be distinct within a page")
        if Counter(node_name(n) for n in found) != Counter(names):
            errors.append({"page": page_id, "error": "Descriptions inventory mismatch",
                           "expected": names, "actual": [node_name(n) for n in found]})
        for group in groups:
            context = {"page": page_id, "group": group["name"]}
            candidates = [n for n in found if node_name(n) == group["name"]]
            if len(candidates) != 1:
                continue
            node = candidates[0]
            containers = [n for n in nodes if node_name(n) == group["container"]]
            container = containers[0] if len(containers) == 1 else None
            region = slot(container, "children") if container and identity(container) in {
                "plasmicantd6card", "plasmicantd6drawer"
            } else container
            if region is None or not any(n is node for n in walk(region)):
                errors.append({**context, "error": "Wrong information container"})
            actual = props(node)
            for key in ("column", "items"):
                if json.dumps(actual.get(key), sort_keys=True) != json.dumps(group[key], sort_keys=True):
                    errors.append({**context, "error": "Information prop mismatch", "prop": key,
                                   "expected": group[key], "actual": actual.get(key)})
            if content(slot(node, "title")) != group["title"]:
                errors.append({**context, "error": "Wrong title Slot content"})
    return {"passed": not errors, "errors": errors}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("inventory", type=Path)
    parser.add_argument("mcp_read", type=Path)
    args = parser.parse_args()
    result = check(json.loads(args.inventory.read_text()), json.loads(args.mcp_read.read_text()))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    raise SystemExit(0 if result["passed"] else 1)


if __name__ == "__main__":
    main()
