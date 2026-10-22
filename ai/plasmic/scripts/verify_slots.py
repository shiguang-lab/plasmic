#!/usr/bin/env python3
"""Compare intended HTML slots with a public MCP component readback.

Checks named component identity, Card content ownership and imported example
nodes in unprovided slots. Does not replace runtime or screenshot acceptance.
"""
import argparse
import json
import re
from collections import Counter
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

    def handle_data(self, data):
        self.stack[-1]["text"] = self.stack[-1].get("text", "") + data

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i]["tag"] == tag:
                del self.stack[i:]
                break


def walk(node):
    yield node
    for child in node["children"]:
        yield from walk(child)


def slot_owners(tree):
    """Ignore layout markup; keep each named component's native Slot owner."""
    owners = {}

    def visit(node, owner=None, slot_name=None):
        name = node["attrs"].get("data-plasmic-name") if node["tag"] == "plasmic-component" else None
        if name:
            owners[name] = {"component": owner, "slot": slot_name}
            for child in node["children"]:
                visit(child, name, child["attrs"].get("name") if child["tag"] == "slot" else None)
        else:
            for child in node["children"]:
                visit(child, owner, slot_name)

    visit(tree)
    return owners


def component_identity(node):
    return re.sub(r"[^a-z0-9]", "", node["attrs"].get("data-plasmic-component", "").lower())


def edge_is_zero(body, edge):
    """Resolve one body padding edge from padding shorthand and longhand."""
    longhand = "padding" + edge.capitalize()
    if longhand in body:
        value = body[longhand]
    elif "padding" in body:
        parts = str(body["padding"]).split()
        index = {"top": 0, "right": 1, "bottom": 2, "left": 3}[edge]
        fallback = {1: [0, 0, 0, 0], 2: [0, 1, 0, 1], 3: [0, 1, 2, 1], 4: [0, 1, 2, 3]}.get(len(parts))
        if not fallback:
            return False
        value = parts[fallback[index]]
    else:
        return False
    return str(value).strip() in {"0", "0px"}


def tabs_card_policy(intent_tree):
    """A Card whose first content is Tabs must plan zero top padding and an empty header.

    Tabs owns the top edge; without explicit styles.body padding the Card falls
    back to its default padding, and omitted title/extra Slots keep defaults.
    """
    errors = []
    for card in walk(intent_tree):
        if card["tag"] != "plasmic-component" or component_identity(card) != "plasmicantd6card":
            continue
        content = next((n for n in card["children"] if n["tag"] == "slot" and n["attrs"].get("name") == "children"), None)
        first = next((n for n in walk(content) if n is not content and n["tag"] == "plasmic-component"), None) if content else None
        if not first or component_identity(first) != "plasmicantd6tabs":
            continue
        name = card["attrs"].get("data-plasmic-name")
        props = json.loads(card["attrs"].get("data-props", "{}"))
        styles = props.get("styles", {}) if isinstance(props.get("styles"), dict) else {}
        body = styles.get("body", {}) if isinstance(styles.get("body"), dict) else {}
        if not edge_is_zero(body, "top"):
            errors.append({"card": name, "issue": "styles.body paddingTop must be 0 when Tabs is the first content", "body": body})
        declared = {n["attrs"].get("name") for n in card["children"] if n["tag"] == "slot"}
        for slot in ["title", "extra"]:
            if slot not in declared:
                errors.append({"card": name, "issue": f"declare an empty <slot name=\"{slot}\"></slot> for a headerless Tabs Card"})
    return errors


def check(intent, actual):
    intent_tree, actual_tree = Tree(intent).root, Tree(actual).root
    duplicates = []
    duplicate_slots = []
    for source, tree in [("intent", intent_tree), ("actual", actual_tree)]:
        for node in walk(tree):
            if node["tag"] == "plasmic-component":
                slots = [child["attrs"].get("name") for child in node["children"] if child["tag"] == "slot"]
                duplicate_slots.extend({"source": source, "component": node["attrs"].get("data-plasmic-name"), "slot": name}
                                       for name, count in Counter(slots).items() if count > 1)
        names = [n["attrs"]["data-plasmic-name"] for n in walk(tree)
                 if n["tag"] == "plasmic-component" and "data-plasmic-name" in n["attrs"]]
        duplicates.extend({"source": source, "name": name} for name, count in Counter(names).items() if count > 1)
    expected = {
        n["attrs"]["data-plasmic-name"]: n
        for n in walk(intent_tree)
        if n["tag"] == "plasmic-component" and "data-plasmic-name" in n["attrs"]
    }
    found = {
        n["attrs"]["data-plasmic-name"]: n
        for n in walk(actual_tree)
        if n["tag"] == "plasmic-component" and "data-plasmic-name" in n["attrs"]
    }
    intent_errors = [] if expected and all(name.strip() for name in expected) else ["Nonempty named component intent required"]
    missing = sorted(expected.keys() - found.keys())
    defaults = []
    wrong_components = []
    empty_cards = []
    misplaced_card_content = []
    wrong_card_padding = []
    wrong_slot_owners = []
    tabs_card_errors = tabs_card_policy(intent_tree)
    if not duplicates:
        intended_owners, actual_owners = slot_owners(intent_tree), slot_owners(actual_tree)
        for name in sorted(expected.keys() & found.keys()):
            if intended_owners[name] != actual_owners[name]:
                wrong_slot_owners.append({"component": name, "expected": intended_owners[name], "actual": actual_owners[name]})
    for name in sorted(expected.keys() & found.keys()):
        identity = lambda node: re.sub(r"[^a-z0-9]", "", node["attrs"].get("data-plasmic-component", "").lower())
        if identity(expected[name]) != identity(found[name]):
            wrong_components.append(name)
        slots = {n["attrs"].get("name") for n in expected[name]["children"]
                 if n["tag"] == "slot" and (n["children"] or n.get("text", "").strip())}
        for slot in found[name]["children"]:
            if slot["tag"] == "slot" and slot["attrs"].get("name") not in slots:
                if slot.get("text", "").strip():
                    defaults.append({"component": name, "slot": slot["attrs"].get("name"), "elementUuid": None})
                for child in slot["children"]:
                    node_id = child["attrs"].get("id")
                    defaults.append({"component": name, "slot": slot["attrs"].get("name"), "elementUuid": node_id})
        if identity(expected[name]) == "plasmicantd6card":
            expected_styles = json.loads(expected[name]["attrs"].get("data-props", "{}")).get("styles", {})
            actual_styles = json.loads(found[name]["attrs"].get("data-props", "{}")).get("styles", {})
            expected_body = expected_styles.get("body", {}) if isinstance(expected_styles, dict) else {}
            actual_body = actual_styles.get("body", {}) if isinstance(actual_styles, dict) else {}
            for prop in ["padding", "paddingTop", "paddingBottom", "paddingLeft", "paddingRight"]:
                if prop in expected_body and json.dumps(expected_body[prop], sort_keys=True) != json.dumps(actual_body.get(prop), sort_keys=True):
                    wrong_card_padding.append({"card": name, "property": prop, "expected": expected_body[prop], "actual": actual_body.get(prop)})
            expected_content = next((n for n in expected[name]["children"] if n["tag"] == "slot" and n["attrs"].get("name") == "children"), None)
            actual_content = next((n for n in found[name]["children"] if n["tag"] == "slot" and n["attrs"].get("name") == "children"), None)
            if not actual_content or not (actual_content["children"] or actual_content.get("text", "").strip()):
                empty_cards.append(name)
            node_name = lambda n: n["attrs"].get("data-plasmic-name") or n["attrs"].get("label")
            intended_names = {node_name(n) for n in walk(expected_content) if node_name(n)} if expected_content else set()
            actual_names = {node_name(n) for n in walk(actual_content) if node_name(n)} if actual_content else set()
            for child_name in sorted(intended_names - actual_names):
                misplaced_card_content.append({"card": name, "component": child_name})
    return {"intentErrors": intent_errors, "duplicateComponents": duplicates, "duplicateSlots": duplicate_slots, "missingComponents": missing, "wrongComponents": wrong_components, "wrongSlotOwners": wrong_slot_owners, "emptyCards": empty_cards, "cardContentOutsideSlot": misplaced_card_content, "wrongCardPadding": wrong_card_padding, "tabsCardPolicy": tabs_card_errors, "unprovidedSlotChildren": defaults, "passed": not any([intent_errors, duplicates, duplicate_slots, missing, wrong_components, wrong_slot_owners, empty_cards, misplaced_card_content, wrong_card_padding, tabs_card_errors, defaults])}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("intent_html", type=Path)
    parser.add_argument("mcp_read", type=Path)
    parser.add_argument("--component", help="Select a component UUID when the read contains multiple results")
    parser.add_argument("--allow-defaults", action="store_true", help="Inspect removable defaults before cleanup; missing intended components still fail")
    args = parser.parse_args()
    data = json.loads(args.mcp_read.read_text(encoding="utf-8"))
    models = [m for m in data["results"] if "baseVariantTplTree" in m and (not args.component or m["uuid"] == args.component)]
    if len(models) != 1:
        parser.error("Select exactly one public MCP component readback")
    result = check(args.intent_html.read_text(encoding="utf-8"), models[0]["baseVariantTplTree"])
    print(json.dumps(result, ensure_ascii=False, indent=2))
    structural_errors = any(result[key] for key in ["intentErrors", "duplicateComponents", "duplicateSlots", "missingComponents", "wrongComponents", "wrongSlotOwners", "emptyCards", "cardContentOutsideSlot", "wrongCardPadding", "tabsCardPolicy"])
    raise SystemExit(0 if result["passed"] or (args.allow_defaults and not structural_errors) else 1)


if __name__ == "__main__":
    main()
