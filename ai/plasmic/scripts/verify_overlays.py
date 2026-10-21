#!/usr/bin/env python3
"""Check overlay footer inventories against full public MCP component readbacks.

See references/libraries/antd_v6/compositions/modal-drawer.md.
This gate targets Antd-v6 contracts; only inventoried owning components are checked.
Effects are independently reviewed expectations, not inferred from button labels.
Expressions are never executed; flat object read bindings retain exact prop checks.
Unresolved visibility still requires runtime evidence.
"""
import argparse
import json
import math
import re
from collections import Counter
from pathlib import Path
from verify_forms import TextTree, identity, node_name, props, slot
from verify_slots import walk
from verify_bindings import object_binding


OVERLAYS = {"plasmicantd6modal", "plasmicantd6drawer"}


def conditional(value):
    return "{{" in json.dumps(value)


def visible_button(values, node=None):
    if conditional(values.get("style", {})) or conditional(values.get("hidden", False)):
        raise ValueError("Conditional button visibility requires state-specific evidence")
    if not isinstance(values.get("hidden", False), bool):
        raise ValueError("Button hidden must be a literal boolean")
    style = values.get("style", {})
    if not isinstance(style, dict):
        raise ValueError("Unresolved Button style")
    if any("\\" in str(key) or key in {"display", "visibility", "opacity"} and "\\" in str(value)
           for key, value in style.items()):
        raise ValueError("Escaped CSS requires rendered visibility evidence")
    if node:
        visibility = node["attrs"].get("data-visible-if", "true")
        if visibility not in {"true", "false"} or conditional(node["attrs"].get("style", "")):
            raise ValueError("Conditional node visibility requires state-specific evidence")
        if visibility == "false":
            return False
        raw = node["attrs"].get("style", "")
        if "/*" in raw:
            raise ValueError("CSS comments require rendered visibility evidence")
        inline, priorities = {}, {}
        for declaration in raw.split(";"):
            if ":" not in declaration:
                continue
            key, value = declaration.split(":", 1)
            key = key.strip().lower()
            if "\\" in key or key in {"display", "visibility", "opacity"} and "\\" in value:
                raise ValueError("Escaped CSS requires rendered visibility evidence")
            important = bool(re.search(r"\s*!important\s*$", value, flags=re.I))
            if key not in inline or important or not priorities[key]:
                inline[key] = re.sub(r"\s*!important\s*$", "", value, flags=re.I).strip()
                priorities[key] = important
        style = {**inline, **style, **{key: inline[key] for key in inline if priorities[key]}}
        if "hidden" in node["attrs"]:
            return False
    opacity = style.get("opacity")
    if opacity is not None:
        try:
            opacity = float(str(opacity).strip().removesuffix("%"))
        except (ValueError, TypeError) as error:
            raise ValueError("Unresolved Button opacity") from error
        if not math.isfinite(opacity):
            raise ValueError("Unresolved Button opacity")
        if opacity <= 0:
            return False
    for key in ("display", "visibility"):
        value = style.get(key)
        if value is None:
            continue
        if (not isinstance(value, str) or re.search(r"/\*|\(|\)|!", value)
                or value.strip().lower() in {"inherit", "unset", "revert", "revert-layer"}):
            raise ValueError("Unresolved Button visibility style requires rendered evidence")
    return not (values.get("hidden") is True or str(style.get("display") or "").strip().lower() == "none" or
                str(style.get("visibility") or "").strip().lower() in {"hidden", "collapse"})


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
    if not isinstance(values.get("hideFooter", False), bool):
        raise ValueError("hideFooter must be a literal boolean")
    if values.get("hideFooter") is True or ("footer" in values and values["footer"] is None):
        return "none", []
    region = slot(node, "footer")
    # Studio computeTplComponentArgs maps an empty code-component RenderExpr
    # to undefined, preserving the native default. Explicit null props above
    # still suppress it. This gate checks Studio prototypes, not code export.
    if region is not None and region["children"]:
        buttons = list(footer_buttons(region))
        return "custom", [(node_name(n), props(n)) for n in buttons]
    if "footer" in values:
        raise ValueError("Unresolved footer override")
    if identity(node) == "plasmicantd6drawer":
        return "none", []
    actions = []
    for name, key in (("nativeCancel", "cancelButtonProps"), ("nativeOk", "okButtonProps")):
        button = object_binding(values.get(key, {}))
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
        if not isinstance(closable.get("disabled", False), bool):
            raise ValueError("Close disabled must be a literal boolean")
        if closable.get("disabled") is True:
            return False
    elif not isinstance(closable, bool):
        raise ValueError("Unresolved closable configuration")
    elif closable is False:
        return False
    custom = slot(node, "closeIcon")
    if custom is not None and custom["children"]:
        raise ValueError("Custom closeIcon Slot requires rendered availability evidence")

    def literal_icon(value):
        # React renders numbers (including zero), but not booleans/null.
        if value is None or isinstance(value, bool):
            return False
        if isinstance(value, str):
            return bool(value.strip())
        if type(value) in (int, float) and math.isfinite(value):
            return True
        raise ValueError("Unresolved close icon requires rendered availability evidence")

    if isinstance(closable, dict) and "closeIcon" in closable:
        return literal_icon(closable["closeIcon"])
    # Empty code-component Slots preserve native defaults in Studio. Antd6
    # ignores top-level booleans/null when closable is explicitly true/object.
    if isinstance(icon, bool) or icon is None:
        return "closable" in values or icon is not False and icon is not None
    return literal_icon(icon)


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
            expected_trigger = spec.get("trigger", [])
            if (not isinstance(expected_trigger, list) or any(not isinstance(name, str) or not name.strip() for name in expected_trigger)
                    or len(set(expected_trigger)) != len(expected_trigger)):
                raise ValueError("Overlay trigger must list distinct named inline roots, or [] for external ownership")
            trigger_region = slot(node, "trigger")
            trigger_nodes = [n for n in trigger_region["children"] if n["tag"] != "text" or n.get("text", "").strip()] if trigger_region else []
            actual_trigger = [node_name(n) for n in trigger_nodes]
            if actual_trigger != expected_trigger:
                errors.append({**location, "error": "Inline trigger inventory mismatch; clear unused default trigger Slots", "actual": actual_trigger})
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
    result = check(json.loads(args.inventory.read_text(encoding="utf-8")), json.loads(args.mcp_read.read_text(encoding="utf-8")))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    raise SystemExit(0 if result["passed"] else 1)


if __name__ == "__main__":
    main()
