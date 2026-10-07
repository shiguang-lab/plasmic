#!/usr/bin/env python3
"""Compare intended HTML slots with a public MCP component readback.

Checks named component identity, Card content ownership and imported example
nodes in unprovided slots. Does not replace runtime or screenshot acceptance.
"""
import argparse
import json
import re
from html.parser import HTMLParser
from pathlib import Path


class Tree(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.root = {"tag": "root", "attrs": {}, "children": []}
        self.stack = [self.root]
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        node = {"tag": tag, "attrs": dict(attrs), "children": []}
        self.stack[-1]["children"].append(node)
        if tag not in {"input", "img", "br", "hr", "meta", "link", "path"}:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.stack[-1]["children"].append({"tag": tag, "attrs": dict(attrs), "children": []})

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i]["tag"] == tag:
                del self.stack[i:]
                break


def walk(node):
    yield node
    for child in node["children"]:
        yield from walk(child)


def check(intent, actual):
    expected = {
        n["attrs"]["data-plasmic-name"]: n
        for n in walk(Tree(intent).root)
        if n["tag"] == "plasmic-component" and "data-plasmic-name" in n["attrs"]
    }
    found = {
        n["attrs"]["data-plasmic-name"]: n
        for n in walk(Tree(actual).root)
        if n["tag"] == "plasmic-component" and "data-plasmic-name" in n["attrs"]
    }
    missing = sorted(expected.keys() - found.keys())
    defaults = []
    wrong_components = []
    empty_cards = []
    misplaced_card_content = []
    wrong_card_padding = []
    for name in sorted(expected.keys() & found.keys()):
        identity = lambda node: re.sub(r"[^a-z0-9]", "", node["attrs"].get("data-plasmic-component", "").lower())
        if identity(expected[name]) != identity(found[name]):
            wrong_components.append(name)
        slots = {n["attrs"].get("name") for n in expected[name]["children"] if n["tag"] == "slot"}
        for slot in found[name]["children"]:
            if slot["tag"] == "slot" and slot["attrs"].get("name") not in slots:
                for child in slot["children"]:
                    node_id = child["attrs"].get("id")
                    if node_id:
                        defaults.append({"component": name, "slot": slot["attrs"].get("name"), "elementUuid": node_id})
        if identity(expected[name]) == "plasmicantd6card":
            expected_styles = json.loads(expected[name]["attrs"].get("data-props", "{}")).get("styles", {})
            actual_styles = json.loads(found[name]["attrs"].get("data-props", "{}")).get("styles", {})
            expected_body = expected_styles.get("body", {}) if isinstance(expected_styles, dict) else {}
            actual_body = actual_styles.get("body", {}) if isinstance(actual_styles, dict) else {}
            for prop in ["padding", "paddingTop", "paddingBottom", "paddingLeft", "paddingRight"]:
                if prop in expected_body and expected_body[prop] != actual_body.get(prop):
                    wrong_card_padding.append({"card": name, "property": prop, "expected": expected_body[prop], "actual": actual_body.get(prop)})
            expected_content = next((n for n in expected[name]["children"] if n["tag"] == "slot" and n["attrs"].get("name") == "children"), None)
            actual_content = next((n for n in found[name]["children"] if n["tag"] == "slot" and n["attrs"].get("name") == "children"), None)
            if not actual_content or not actual_content["children"]:
                empty_cards.append(name)
            node_name = lambda n: n["attrs"].get("data-plasmic-name") or n["attrs"].get("label")
            intended_names = {node_name(n) for n in walk(expected_content) if node_name(n)} if expected_content else set()
            actual_names = {node_name(n) for n in walk(actual_content) if node_name(n)} if actual_content else set()
            for child_name in sorted(intended_names - actual_names):
                misplaced_card_content.append({"card": name, "component": child_name})
    return {"missingComponents": missing, "wrongComponents": wrong_components, "emptyCards": empty_cards, "cardContentOutsideSlot": misplaced_card_content, "wrongCardPadding": wrong_card_padding, "unprovidedSlotChildren": defaults, "passed": not any([missing, wrong_components, empty_cards, misplaced_card_content, wrong_card_padding, defaults])}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("intent_html", type=Path)
    parser.add_argument("mcp_read", type=Path)
    parser.add_argument("--component", help="Select a component UUID when the read contains multiple results")
    parser.add_argument("--allow-defaults", action="store_true", help="Inspect removable defaults before cleanup; missing intended components still fail")
    args = parser.parse_args()
    data = json.loads(args.mcp_read.read_text())
    models = [m for m in data["results"] if "baseVariantTplTree" in m and (not args.component or m["uuid"] == args.component)]
    if len(models) != 1:
        parser.error("Select exactly one public MCP component readback")
    result = check(args.intent_html.read_text(), models[0]["baseVariantTplTree"])
    print(json.dumps(result, ensure_ascii=False, indent=2))
    structural_errors = any(result[key] for key in ["missingComponents", "wrongComponents", "emptyCards", "cardContentOutsideSlot", "wrongCardPadding"])
    raise SystemExit(0 if result["passed"] or (args.allow_defaults and not structural_errors) else 1)


if __name__ == "__main__":
    main()
