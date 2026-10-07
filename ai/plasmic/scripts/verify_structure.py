#!/usr/bin/env python3
"""Check source-reviewed routes/navigation against public MCP readbacks.

Does not interpret requirement prose or verify runtime/visual behavior.
"""
import argparse
import json
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path


class Shells(HTMLParser):
    def __init__(self, markup):
        super().__init__()
        self.props = []
        self.feed(markup)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "plasmic-component" and attrs.get("data-plasmic-component") in {
            "plasmicOverseasAppShell", "plasmic-overseas-app-shell"
        }:
            self.props.append(json.loads(attrs.get("data-props", "{}")))


def menu_tree(items):
    if not isinstance(items, list):
        raise ValueError("Static menuItems array required; verify dynamic menus in preview")
    result = []
    for item in items:
        if not isinstance(item, dict) or not isinstance(item.get("key"), str) or not isinstance(item.get("label"), str):
            raise ValueError("Each menu item must have a literal key and label")
        if any("{{" in str(item.get(key, "")) for key in ["key", "label", "href", "hidden"]):
            raise ValueError("Dynamic menu items require preview evidence")
        if not isinstance(item.get("hidden", False), bool):
            raise ValueError("Menu hidden must be boolean")
        if "href" in item and not isinstance(item["href"], str):
            raise ValueError("Menu href must be a literal string")
        result.append({
            "key": item["key"], "label": item["label"], "href": item.get("href"),
            "hidden": item.get("hidden", False), "children": menu_tree(item.get("children", []))
        })
    return result


def check(expectation, overview, readback):
    errors = []
    planned = expectation.get("pages", [])
    navigation = expectation.get("navigation", {})
    if not planned or any(not p.get("path") or not isinstance(p.get("source"), str) or not p["source"].strip() for p in planned):
        errors.append({"check": "expectation", "message": "Nonempty page inventory with source citations required"})
    if not isinstance(navigation.get("source"), str) or not navigation["source"].strip():
        errors.append({"check": "expectation", "message": "Navigation source citation required"})
    try:
        expected_menu = menu_tree(navigation.get("items"))
    except ValueError as exc:
        errors.append({"check": "expectation", "message": str(exc)})
        expected_menu = None
    expected_routes = [p.get("path") for p in planned]
    duplicates = [path for path, count in Counter(expected_routes).items() if count > 1]
    if duplicates:
        errors.append({"check": "expectation", "duplicateRoutes": duplicates})

    projects = [r for r in overview["results"] if r.get("__type") == "Project"]
    if len(projects) != 1:
        errors.append({"check": "overview", "message": "Exactly one public MCP Project overview required"})
        inventory = []
    else:
        inventory = [p for p in projects[0]["components"] if p.get("type") == "page"]
    pages = [p for p in readback["results"] if p.get("type") == "page"]
    for name, collection in [("overview", inventory), ("readback", pages)]:
        paths = [p.get("pageMeta", {}).get("path") for p in collection]
        found = set(paths)
        wanted = set(expected_routes)
        duplicates = [path for path, count in Counter(paths).items() if count > 1]
        if found != wanted or duplicates:
            errors.append({
                "check": name + " routes", "missing": sorted(wanted - found, key=str),
                "extra": sorted(found - wanted, key=str), "duplicates": duplicates
            })
    if Counter(p["uuid"] for p in inventory) != Counter(p["uuid"] for p in pages):
        errors.append({"check": "readback", "message": "Full Page readbacks must cover exactly the overview Page identities"})
    for page in pages:
        path = page.get("pageMeta", {}).get("path")
        markup = page.get("baseVariantTplTree")
        if not isinstance(markup, str):
            errors.append({"check": "readback", "path": path, "message": "Full Page markup required"})
            continue
        try:
            shells = Shells(markup).props
            if len(shells) != 1:
                errors.append({"check": "shell", "path": path, "count": len(shells)})
                continue
            actual_menu = menu_tree(shells[0].get("menuItems"))
            if expected_menu is not None and actual_menu != expected_menu:
                errors.append({"check": "navigation", "path": path, "expected": expected_menu, "actual": actual_menu})
        except (ValueError, TypeError) as exc:
            errors.append({"check": "navigation", "path": path, "message": str(exc)})
    return {
        "passed": not errors, "expectedPageCount": len(planned), "actualPageCount": len(inventory),
        "errors": errors, "notChecked": ["source-interpretation", "runtime-behavior", "visual-quality"]
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("expectation", type=Path)
    parser.add_argument("overview", type=Path)
    parser.add_argument("pages", type=Path)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    report = check(*(json.loads(path.read_text()) for path in [args.expectation, args.overview, args.pages]))
    output = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.report:
        args.report.write_text(output)
    print(output)
    raise SystemExit(0 if report["passed"] else 1)


if __name__ == "__main__":
    main()
