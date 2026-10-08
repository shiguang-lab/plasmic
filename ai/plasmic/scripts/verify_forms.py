#!/usr/bin/env python3
"""Check a source-derived business field inventory against public MCP readbacks.

Expect {"pages": [{"componentUuid": "...", "forms": [{"name": "Form", "fields":
[{"nodeName": "NameField", "name": "name", "label": "Name", "control": "Name",
"rules": [{"ruleType": "required"}], "tooltip": "Help"}]}]}]}.
Rules are matched by their specified keys. Omit tooltip when none is expected.
Optional form layout specifies container, columns, columnGap and paired rows
[{container, fields: [nodeName, ...]}]; fields specify full-row or single-column span.
All project Pages and business Forms must be inventoried, including empty-form Pages.
Standalone controls require {nodeName, reason} entries in page.standaloneControls.
This checks the saved component contract, not runtime validation or geometry.
"""
import argparse
import json
import re
from collections import Counter
from pathlib import Path
from verify_slots import Tree, walk


class TextTree(Tree):
    def handle_data(self, data):
        self.stack[-1]["children"].append({"tag": "text", "attrs": {}, "children": [], "text": data})


def identity(node):
    return re.sub(r"[^a-z0-9]", "", node["attrs"].get("data-plasmic-component", "").lower())


def props(node):
    return json.loads(node["attrs"].get("data-props", "{}"))


def slot(node, name):
    return next((n for n in node["children"] if n["tag"] == "slot" and n["attrs"].get("name") == name), None)


def content(node):
    return "".join(n.get("text", "") for n in walk(node)).strip() if node else ""


def styles(node):
    return dict(part.strip().split(":", 1) for part in node["attrs"].get("style", "").split(";") if ":" in part)


def node_name(node):
    return node["attrs"].get("data-plasmic-name") or node["attrs"].get("label")


def editable(node):
    if node["tag"] in {"input", "select", "textarea"}:
        return node["attrs"].get("type") not in {"hidden", "submit", "button", "reset"}
    return identity(node) in {"plasmicantd6" + suffix for suffix in (
        "input", "inputpassword", "textarea", "inputnumber", "select", "treeselect",
        "autocomplete", "cascader", "datepicker", "daterangepicker", "rangepicker",
        "timepicker", "timerangepicker", "checkbox", "checkboxgroup", "radio",
        "radiogroup", "radiobutton", "switch", "slider", "rate", "upload", "uploadbutton",
        "mentions", "colorpicker",
    )}


def scan_ownership(root, page):
    errors = []
    nodes = list(walk(root))
    parents = {id(child): n for n in nodes for child in n["children"]}

    def ancestors(node):
        while id(node) in parents:
            node = parents[id(node)]
            yield node

    forms = [n for n in nodes if identity(n) == "plasmicantd6form"]
    if Counter(node_name(n) for n in forms) != Counter(f["name"] for f in page["forms"]):
        errors.append({"error": "Business Form inventory mismatch"})
    regions = []
    for form in forms:
        regions.append(next((n for n in ancestors(form) if identity(n) in {
            "plasmicantd6modal", "plasmicantd6drawer", "plasmicantd6card"
        }), form))
    region_nodes = {id(n) for region in regions for n in walk(region)}
    exemptions = page.get("standaloneControls", [])
    standalone = []
    for node in nodes:
        lineage = list(ancestors(node))
        if identity(node) == "plasmicantd6formitem":
            form_owner = next((n for n in lineage if identity(n) == "plasmicantd6form"), None)
            children = slot(form_owner, "children") if form_owner else None
            if children is None or not any(n is node for n in walk(children)):
                errors.append({"node": node_name(node), "error": "Form.Item must belong to Form children"})
        # Radio/Checkbox options belong to their editable group, not to separate fields.
        if editable(node) and not any(editable(n) for n in lineage):
            owner = next((n for n in lineage if identity(n) in {
                "plasmicantd6formitem", "plasmicoverseassearchformitem"
            }), None)
            if owner is None:
                standalone.append(node_name(node))
                if any(identity(n) == "plasmicantd6form" for n in lineage):
                    errors.append({"node": node_name(node), "error": "Editable Form control requires Form.Item ownership"})
            elif identity(owner) == "plasmicantd6formitem":
                if not any(n is node for n in (slot(owner, "children") or {}).get("children", [])):
                    errors.append({"node": node_name(node), "error": "Editable control must be a direct Item child"})
        if id(node) not in region_nodes:
            continue
        kind = identity(node)
        name = node_name(node) or ""
        attrs = node["attrs"]
        icon = "questioncircle" in kind or "infocircle" in kind
        fake_help = (node["tag"] == "button" or kind == "plasmicantd6button" or attrs.get("role") == "button" or "title" in attrs) and content(node) in {"i", "?", "？", "ⓘ"}
        if kind == "plasmicantd6tooltip" or icon or fake_help:
            errors.append({"node": name, "error": "Field help must use Form.Item tooltip"})
        if kind not in {"plasmicantd6form", "plasmicantd6formitem"} and not editable(node):
            bindings = " ".join([n.get("text", "") for n in node["children"]] + list(attrs.values()))
            red_error = styles(node).get("color", "").strip().lower() in {"red", "#ff4d4f", "#ff0000", "rgb(255, 77, 79)"} and re.search(r"required|必填|不能为空|请输入|请选择|请填写", content(node), re.I)
            if red_error or re.search(r"(?:Field|Name|Key|Owner|Expiry|Form|Validation)Errors?$", name, re.I) or re.search(r"\$state\.[\w.]*errors?\b", bindings, re.I):
                errors.append({"node": name, "error": "Field errors must be owned by Form.Item"})
    if Counter(standalone) != Counter(e["nodeName"] for e in exemptions):
        errors.append({"error": "Unowned editable control inventory mismatch", "actual": standalone,
                       "expected": [e["nodeName"] for e in exemptions]})
    return errors


def check(expectations, overview, readback):
    errors = []
    checked = 0
    planned = expectations.get("pages", [])
    projects = [m for m in overview.get("results", []) if m.get("__type") == "Project"]
    pages = [m for m in readback.get("results", []) if m.get("type") == "page"]
    if len(projects) != 1:
        errors.append({"error": "Exactly one public MCP Project overview required"})
    inventory = [m for m in projects[0].get("components", []) if m.get("type") == "page"] if len(projects) == 1 else []
    expected_ids = [p.get("componentUuid") for p in planned]
    if not planned or len(set(expected_ids)) != len(expected_ids) or not all(expected_ids):
        errors.append({"error": "Nonempty unique source-derived Page inventory required"})
    for label, collection in [("overview", inventory), ("readback", pages)]:
        if Counter(expected_ids) != Counter(m.get("uuid") for m in collection):
            errors.append({"error": "Page inventory mismatch", "input": label})
    models = {m["uuid"]: m for m in pages}
    for page in planned:
        forms = page.get("forms")
        exemptions = page.get("standaloneControls", [])
        if not isinstance(forms, list) or any(not f.get("name") or not f.get("fields") for f in forms) or len({f["name"] for f in forms}) != len(forms):
            errors.append({"page": page["componentUuid"], "error": "Unique source-derived Form inventory required"})
            continue
        if any(any(not field.get(key) for key in ("nodeName", "name", "control")) or not isinstance(field.get("label"), str) or not isinstance(field.get("rules"), list) for form in forms for field in form["fields"]):
            errors.append({"page": page["componentUuid"], "error": "Every field requires nodeName, name, label, control and rules"})
            continue
        if any(not e.get("nodeName") or not isinstance(e.get("reason"), str) or not e["reason"].strip() for e in exemptions) or len({e["nodeName"] for e in exemptions}) != len(exemptions):
            errors.append({"page": page["componentUuid"], "error": "Standalone controls require unique names and reviewed reasons"})
            continue
        model = models.get(page["componentUuid"])
        if not model or not isinstance(model.get("baseVariantTplTree"), str):
            errors.append({"page": page["componentUuid"], "error": "Missing full Page readback"})
            continue
        root = TextTree(model["baseVariantTplTree"]).root
        errors.extend({"page": model["uuid"], **e} for e in scan_ownership(root, page))
        named = {}
        for n in walk(root):
            name = n["attrs"].get("data-plasmic-name") or n["attrs"].get("label")
            if name:
                named.setdefault(name, []).append(n)
        for expected_form in page["forms"]:
            form_name = expected_form["name"]
            candidates = named.get(form_name, [])
            if len(candidates) != 1 or identity(candidates[0]) != "plasmicantd6form":
                errors.append({"page": model["uuid"], "form": form_name, "error": "Expected one registered Form"})
                continue
            form = candidates[0]
            form_children = slot(form, "children")
            items = [n for n in walk(form_children or {"children": []}) if identity(n) == "plasmicantd6formitem"]
            actual_keys = [props(n).get("name") for n in items]
            expected_keys = [f["name"] for f in expected_form["fields"]]
            if len(set(expected_keys)) != len(expected_keys) or Counter(actual_keys) != Counter(expected_keys):
                errors.append({"page": model["uuid"], "form": form_name, "error": "Field key inventory mismatch", "expected": expected_keys, "actual": actual_keys})
            layout = expected_form.get("layout")
            container = None
            row_owners = {}
            if layout:
                candidates = [n for n in walk(form_children or {"children": []}) if node_name(n) == layout["container"]]
                failures = []
                modals = [n for n in walk(root) if identity(n) == "plasmicantd6modal" and any(child is form for child in walk(n))]
                if len(modals) != 1 or str(props(modals[0]).get("width")) != str(layout["modalWidth"]):
                    failures.append("Wrong Form Modal width")
                if len(candidates) != 1:
                    failures.append("Expected one field layout container inside Form")
                else:
                    container = candidates[0]
                    css = {k: v.strip() for k, v in styles(container).items()}
                    if css.get("width") != "100%" or styles(form).get("width", "").strip() != "100%" or props(form).get("layout") == "horizontal":
                        failures.append("Field layout container must fill a vertical Form")
                    if not any(n is container for n in (form_children or {}).get("children", [])):
                        failures.append("Field layout container must be a direct Form child")
                    if css.get("display") != "flex" or css.get("flex-direction") != "column":
                        failures.append("Expected stacked full-width field rows")
                    if css.get("row-gap", "0px") not in ("0", "0px"):
                        failures.append("Field rows must not duplicate native Item spacing")
                    for row in layout["rows"]:
                        matches = [n for n in container["children"] if node_name(n) == row["container"]]
                        if len(matches) != 1:
                            failures.append("Expected one direct field row: " + row["container"])
                            continue
                        row_node = matches[0]
                        row_css = {k: v.strip() for k, v in styles(row_node).items()}
                        template = re.sub(r"\s+", "", row_css.get("grid-template-columns", ""))
                        columns = layout["columns"]
                        if row_css.get("width") != "100%":
                            failures.append("Field row must fill Form width")
                        if row_css.get("display") != "grid" or template not in (f"repeat({columns},minmax(0,1fr))", f"repeat({columns},minmax(0px,1fr))"):
                            failures.append("Wrong field grid columns")
                        if row_css.get("column-gap", row_css.get("grid-column-gap")) != f'{layout["columnGap"]}px':
                            failures.append("Wrong field column gap")
                        if row_css.get("row-gap", row_css.get("grid-row-gap", "0px")) not in ("0", "0px"):
                            failures.append("Field row must not duplicate native Item spacing")
                        actual = [node_name(n) for n in row_node["children"] if n["tag"] != "text"]
                        if actual != row["fields"] or len(actual) != columns:
                            failures.append("Field row must contain the expected complete field group")
                        for name in row["fields"]:
                            if name in row_owners:
                                failures.append("Field appears in multiple layout rows")
                            row_owners[name] = row_node
                if failures:
                    errors.append({"page": model["uuid"], "form": form_name, "errors": failures})
            for field in expected_form["fields"]:
                checked += 1
                failures = []
                candidates = [n for n in items if n["attrs"].get("data-plasmic-name") == field["nodeName"]]
                if len(candidates) != 1:
                    failures.append("Expected one Form.Item in Form children")
                else:
                    item = candidates[0]
                    if layout:
                        span = field.get("span", layout["columns"])
                        parent = container if span == layout["columns"] else row_owners.get(field["nodeName"])
                        if span not in (1, layout["columns"]) or parent is None or not any(n is item for n in parent["children"]):
                            failures.append("Wrong field row/span placement")
                        if styles(item).get("width", "").strip() != "100%":
                            failures.append("Field must fill its allocated row or column")
                    values = props(item)
                    if values.get("name") != field["name"]:
                        failures.append("Wrong field key")
                    label = content(slot(item, "label"))
                    if label != field["label"] or re.search(r"[*＊]", label):
                        failures.append("Label must match plain source label")
                    rules = values.get("rules", [])
                    if not isinstance(rules, list) or any(not any(all(r.get(k) == v for k, v in rule.items()) for r in rules) for rule in field.get("rules", [])):
                        failures.append("Missing expected validation rule")
                    if isinstance(rules, list) and any(r.get("ruleType") == "advanced" and not re.fullmatch(r"\s*\{\{[\s\S]+\}\}\s*", str(r.get("custom", ""))) for r in rules):
                        failures.append("Advanced validator must be a dynamic function binding")
                    tooltip = content(slot(item, "tooltip")) or values.get("tooltip", "")
                    if tooltip != field.get("tooltip", ""):
                        failures.append("Wrong Form.Item tooltip content")
                    children = slot(item, "children")
                    controls = [n for n in (children or {}).get("children", []) if n["tag"] == "plasmic-component" and n["attrs"].get("data-plasmic-name") == field["control"]]
                    if len(controls) != 1:
                        failures.append("Control must be a direct Item child")
                    else:
                        direct = [n for n in children["children"] if n["tag"] != "text"]
                        if not editable(controls[0]) or direct[0] is not controls[0] or sum(editable(n) for n in direct) != 1:
                            failures.append("Item must have exactly one editable control as its first child")
                        if any(k in props(controls[0]) for k in ("value", "defaultValue", "checked", "defaultChecked")):
                            failures.append("Control value conflicts with Form ownership")
                if failures:
                    errors.append({"page": model["uuid"], "form": form_name, "field": field["name"], "errors": failures})
    return {"passed": not errors, "checkedFields": checked, "errors": errors}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("expectations", type=Path)
    parser.add_argument("mcp_read", type=Path)
    parser.add_argument("--overview", type=Path, required=True)
    args = parser.parse_args()
    expected = json.loads(args.expectations.read_text())
    result = check(expected, json.loads(args.overview.read_text()), json.loads(args.mcp_read.read_text()))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    raise SystemExit(0 if result["passed"] else 1)


if __name__ == "__main__":
    main()
