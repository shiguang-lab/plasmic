#!/usr/bin/env python3
"""Check independently inventoried read-only groups against public MCP models.

This gate targets the Antd-v6 registration contracts.
See references/libraries/antd_v6/index.md for applicability.

Expect {"pages": [{"componentUuid": "...", "groups": [{"name": "Summary",
"container": "InformationCard", "title": "Basic information", "column": 2,
"items": [{"key": "name", "label": "Name", "children": "Example"}]}]}]}.
items may instead be the exact native array expression. No expression is executed.
For editable fields, replace items with ordered itemSlots entries containing
name, key, label/content Slot text or bindings (children), and optional span.
Only inventoried pages are checked; Preview and source inventory review remain required.
"""
import argparse
import json
import math
from collections import Counter
from pathlib import Path
from verify_forms import TextTree, content, identity, node_name, props, slot
from verify_slots import walk


def item_nodes(node):
    if identity(node) == "plasmicantd6descriptionsitem":
        yield node
    else:
        for child in node["children"]:
            yield from item_nodes(child)


WIDE_GROUP_PX = 640
COLUMN_RULE = "references/libraries/antd_v6/components/descriptions.md#column-and-span"


def rendered_width(layouts, page_id, node):
    frames = (layouts or {}).get(page_id, {}).get("snapshot", {}).get("frames", [])
    element_id = node["attrs"].get("id")
    if len(frames) != 1 or not element_id:
        return None
    widths = [e.get("width") for e in frames[0].get("elements", []) if e.get("elementUuid") == element_id]
    return widths[0] if (len(widths) == 1 and type(widths[0]) in (int, float)
                         and math.isfinite(widths[0]) and widths[0] > 0) else None


def expression(value):
    return isinstance(value, str) and value.strip().startswith("{{") and value.strip().endswith("}}")


def positive_integer(value):
    return type(value) in (int, float) and math.isfinite(value) and value > 0 and value == int(value)


def check_packing(column, fields, context, errors, not_checked):
    """Check literal native values, independently of their equality to the plan."""
    if expression(column):
        not_checked.append(f"{context['page']}/{context['group']}: evaluate column binding in Preview")
    elif not positive_integer(column):
        errors.append({**context, "error": "column must be a positive integer", "actual": column, "rule": COLUMN_RULE})
    for field in fields:
        span = field.get("span")
        if span is None:
            continue  # Native default is one column.
        if expression(span):
            not_checked.append(f"{context['page']}/{context['group']}: evaluate span binding for {field.get('key')} in Preview")
        elif not positive_integer(span) or (positive_integer(column) and span > column):
            errors.append({**context, "field": field.get("key"), "error": "Item span must be an integer from 1 to column",
                           "actual": span, "column": column, "rule": COLUMN_RULE})


def column_reason_problem(reason, width):
    """One column in a wide region needs a cited source or values measured too long to share a row."""
    if isinstance(reason, dict) and reason.get("kind") == "source":
        from verify_component_policy import source_text
        try:
            source_text(reason.get("evidence"))
            return None
        except (ValueError, OSError, UnicodeError) as error:
            return f"columnReason source evidence is unusable: {error}"
    if isinstance(reason, dict) and reason.get("kind") == "measurement":
        value = reason.get("longestValuePx")
        if type(value) not in (int, float) or not math.isfinite(value) or value <= 0:
            return "columnReason measurement needs a positive longestValuePx"
        if value * 2 <= width:
            return "Measured values fit two per row; use the column default instead of one column"
        return None
    return ("A one-column group wider than 640px needs columnReason {kind:source, evidence} or "
            "{kind:measurement, longestValuePx}; otherwise use the column default (3 or 4 for a full-width region, based on value lengths and rendered density)")


def check(inventory, readback, layouts=None):
    errors = []
    not_checked = [
        "Source completeness: groups omitted from both plan and model require source review",
        "Container-specific column choice and whether a single-column exception applies to every value require rule review",
        "Layout direction: horizontal by default; vertical requires explicit user/source evidence and manual Preview review",
        "Heading ownership: separate native substitutes, duplicate headings and intentionally untitled groups require semantic review",
        "Rendered packing, full values and dynamic bindings require Preview and save/reopen verification",
    ]
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
            children = slot(node, "children")
            fields = list(item_nodes(children)) if children else []
            native_items = actual.get("items")
            packing_fields = ([props(field) for field in fields] if native_items is None else
                              native_items if isinstance(native_items, list) else [])
            check_packing(actual.get("column"), packing_fields, context, errors, not_checked)
            if expression(native_items):
                not_checked.append(f"{page_id}/{group['name']}: dynamic items need runtime field count and span checks")
            for key in ("column",) if "itemSlots" in group else ("column", "items"):
                if json.dumps(actual.get(key), sort_keys=True) != json.dumps(group[key], sort_keys=True):
                    errors.append({**context, "error": "Information prop mismatch", "prop": key,
                                   "expected": group[key], "actual": actual.get(key)})
            if content(slot(node, "title")) != group["title"]:
                errors.append({**context, "error": "Wrong title Slot content"})
            width = rendered_width(layouts, page_id, node) if layouts is not None else None
            if width is None:
                not_checked.append(f"{page_id}/{group['name']}: no unique positive rendered width; wide-single-column check unverified")
            count = len(group["itemSlots"]) if "itemSlots" in group else len(group["items"]) if isinstance(group.get("items"), list) else 0
            if width is not None and width > WIDE_GROUP_PX and actual.get("column", 3) == 1 and count >= 3:
                problem = column_reason_problem(group.get("columnReason"), width)
                if problem:
                    errors.append({**context, "error": problem, "renderedWidth": width, "rule": COLUMN_RULE})
            if "itemSlots" in group:
                if actual.get("items") is not None:
                    errors.append({**context, "error": "Native items override editable Item Slots"})
                expected = group["itemSlots"]
                if [node_name(n) for n in fields] != [f["name"] for f in expected]:
                    errors.append({**context, "error": "Ordered Descriptions.Item inventory mismatch"})
                    continue
                for field, spec in zip(fields, expected):
                    values = {**props(field), "label": content(slot(field, "label")),
                              "children": content(slot(field, "children"))}
                    for key in ("key", "label", "children", "span"):
                        if json.dumps(values.get(key), sort_keys=True) != json.dumps(spec.get(key), sort_keys=True):
                            errors.append({**context, "field": spec["name"], "error": "Item Slot contract mismatch",
                                           "prop": key, "expected": spec.get(key), "actual": values.get(key)})
    return {"passed": not errors, "scope": "inventory consistency and supported static checks",
            "errors": errors, "notChecked": not_checked}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("inventory", type=Path)
    parser.add_argument("mcp_read", type=Path)
    args = parser.parse_args()
    result = check(json.loads(args.inventory.read_text(encoding="utf-8")), json.loads(args.mcp_read.read_text(encoding="utf-8")))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    raise SystemExit(0 if result["passed"] else 1)


if __name__ == "__main__":
    main()
