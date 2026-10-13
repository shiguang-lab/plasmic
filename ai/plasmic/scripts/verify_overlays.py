#!/usr/bin/env python3
"""Check overlay footer inventories against full public MCP component readbacks.

See references/libraries/antd_v6/compositions/modal-drawer.md.
This gate targets Antd-v6 contracts; only inventoried owning components are checked.
Effects are independently reviewed expectations, not inferred from button labels.
Expressions are never executed; unresolved visibility requires runtime evidence.
"""
import argparse
import json
import re
from collections import Counter
from pathlib import Path
from verify_forms import TextTree, identity, node_name, props, slot, styles
from verify_slots import walk


OVERLAYS = {"plasmicantd6modal", "plasmicantd6drawer"}


def conditional(value):
    return "{{" in json.dumps(value)


def visible_button(values, node=None):
    if conditional(values.get("style", {})) or conditional(values.get("hidden", False)):
        raise ValueError("Conditional button visibility requires state-specific evidence")
    style = values.get("style", {})
    if not isinstance(style, dict):
        raise ValueError("Unresolved Button style")
    if node:
        visibility = node["attrs"].get("data-visible-if", "true")
        if visibility not in {"true", "false"} or conditional(node["attrs"].get("style", "")):
            raise ValueError("Conditional node visibility requires state-specific evidence")
        if visibility == "false":
            return False
        style = {**styles(node), **style}
        if "hidden" in node["attrs"]:
            return False
    return not (values.get("hidden") is True or style.get("display") == "none" or
                style.get("visibility") in {"hidden", "collapse"})


def footer_buttons(region):
    """Do not count nested overlays, trigger Slots or structurally hidden wrappers."""
    if identity(region) in OVERLAYS or (region["tag"] == "slot" and region["attrs"].get("name") == "trigger"):
        return
    if not visible_button(props(region), region):
        return
    if identity(region) == "plasmicantd6button" or region["tag"] == "button":
        yield region
        return
    for child in region["children"]:
        yield from footer_buttons(child)


def actual_footer(node):
    values = props(node)
    if conditional(values.get("hideFooter", False)) or conditional(values.get("footer")):
        raise ValueError("Conditional footer requires state-specific evidence")
    if values.get("hideFooter") is True or ("footer" in values and values["footer"] is None):
        return "none", []
    region = slot(node, "footer")
    if region is not None:
        buttons = list(footer_buttons(region))
        return "custom", [(node_name(n), props(n)) for n in buttons]
    if "footer" in values:
        raise ValueError("Unresolved footer override")
    if identity(node) == "plasmicantd6drawer":
        return "none", []
    actions = []
    for name, key in (("nativeCancel", "cancelButtonProps"), ("nativeOk", "okButtonProps")):
        button = values.get(key, {})
        if not isinstance(button, dict) or conditional(button):
            raise ValueError("Unresolved native Button props require state-specific evidence")
        if visible_button(button):
            actions.append((name, button))
    return "native", actions


def usable_close_icon(node):
    values = props(node)
    closable = values.get("closable", True)
    icon = values.get("closeIcon", True)
    if conditional(closable) or conditional(icon):
        raise ValueError("Conditional close icon requires state-specific evidence")
    if isinstance(closable, dict):
        return not (closable.get("disabled") is True or closable.get("closeIcon", True) in (False, None))
    if not isinstance(closable, bool):
        raise ValueError("Unresolved closable configuration")
    # An empty explicit closeIcon Slot suppresses the default icon.
    region = slot(node, "closeIcon")
    if region is not None and not any(n["tag"] != "text" or n.get("text", "").strip() for n in region["children"]):
        return False
    return closable and icon is not False and icon is not None


def check(inventory, readback):
    errors = []
    pages = inventory["pages"]
    ids = [p["componentUuid"] for p in pages]
    if not ids or not all(ids) or len(set(ids)) != len(ids):
        raise ValueError("Distinct nonempty owning component UUIDs required")
    for page in pages:
        context = {"page": page["componentUuid"]}
        models = [m for m in readback["results"] if m.get("uuid") == page["componentUuid"] and "baseVariantTplTree" in m]
        if len(models) != 1:
            errors.append({**context, "error": "Expected exactly one full component readback"})
            continue
        found = [n for n in walk(TextTree(models[0]["baseVariantTplTree"]).root) if identity(n) in OVERLAYS]
        specs = page["overlays"]
        names = [s["name"] for s in specs]
        if len(set(names)) != len(names):
            raise ValueError("Overlay names must be distinct")
        if Counter(node_name(n) for n in found) != Counter(names):
            errors.append({**context, "error": "Overlay inventory mismatch"})
        for spec in specs:
            location = {**context, "overlay": spec["name"]}
            candidates = [n for n in found if node_name(n) == spec["name"]]
            if len(candidates) != 1:
                continue
            node = candidates[0]
            expected_kind = re.sub(r"[^a-z0-9]", "", spec["component"].lower())
            if identity(node) != expected_kind:
                errors.append({**location, "error": "Wrong registered overlay identity"})
            actions = spec["footerActions"]
            action_names = [a["name"] for a in actions]
            if len(set(action_names)) != len(action_names) or not all(action_names):
                raise ValueError("Footer action names must be nonempty and distinct")
            for action in actions:
                if action["effect"] not in {"dismiss", "business"}:
                    raise ValueError("Footer action effect must be dismiss or business")
                if action["effect"] == "business" and not action.get("reason", "").strip():
                    raise ValueError("Business action requires a reviewed reason")
            if spec["footer"] not in {"none", "native", "custom"} or not isinstance(spec["closeIcon"], bool):
                raise ValueError("Invalid footer or closeIcon expectation")
            try:
                close = usable_close_icon(node)
                mode, actual = actual_footer(node)
            except ValueError as error:
                errors.append({**location, "error": str(error)})
                continue
            if close != spec["closeIcon"]:
                errors.append({**location, "error": "Close icon availability mismatch"})
            if mode != spec["footer"]:
                errors.append({**location, "error": "Footer ownership mismatch", "actual": mode})
            if [name for name, _ in actual] != action_names:
                errors.append({**location, "error": "Visible footer action inventory mismatch", "actual": [name for name, _ in actual]})
                continue
            for expected, (_, values) in zip(actions, actual):
                for key, value in expected.get("props", {}).items():
                    if json.dumps(values.get(key), sort_keys=True) != json.dumps(value, sort_keys=True):
                        errors.append({**location, "action": expected["name"], "error": "Action prop mismatch", "prop": key})
            if close and len(actual) == 1 and actions[0]["effect"] == "dismiss":
                errors.append({**location, "error": "Sole exit-only footer button duplicates usable header close icon", "action": actions[0]["name"]})
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
