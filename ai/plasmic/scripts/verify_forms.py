#!/usr/bin/env python3
"""Check a source-derived business field inventory against public MCP readbacks.

Component-specific checks target the Antd-v6/Overseas registration contracts.
See references/libraries/antd_v6/index.md for gate applicability.

Expect {"pages": [{"path": "/records", "forms": [{"name": "Form", "formLayout": "horizontal", "fields":
[{"nodeName": "NameField", "name": "name", "label": "Name", "control": "Name",
"rules": [{"ruleType": "required"}], "tooltip": "Help"}]}]}]}.
Rules are matched by their specified keys. Omit tooltip when none is expected.
Required formLayout checks native Form layout. A non-default direction needs a
structured layoutReason: {"kind":"source","evidence":{path,sha256,quote}} quoting a
source that states the label direction, or {"kind":"measurement","labelWidth":n,
"controlMinWidth":n,"regionWidth":n} where the measured label crowds the control.
Free-text justifications are rejected; if no such evidence exists, use the default.
Width ownership is checked on
every Form-to-field path, independently of optional CSS-grid expectations.
Optional field controlWidthReason permits a deliberately compact text/select control.
Optional field validateFirst and
description check ordered validation and persistent Form.Item instructions.
Optional descriptionPlacement=afterControl plus descriptionNode checks inline secondary
Typography after the direct control, without duplicated native extra.
Optional form layout specifies container, columns, columnGap and paired rows
[{container, fields: [nodeName, ...]}]; fields specify full-row or single-column span.
All project Pages and business Forms must be inventoried, including empty-form Pages.
Standalone controls require {nodeName, reason} entries in page.standaloneControls.
This checks the saved component contract, not runtime validation or geometry.
Pages select by exact path, unique name or componentUuid from overview. When
multiple selectors are supplied they must agree; omit project-specific UUIDs
from reusable inventories. Missing or ambiguous selectors never fall back silently.
"""
import argparse
import json
import re
from collections import Counter
from pathlib import Path
from verify_slots import Tree, walk


LAYOUT_QUOTE = re.compile(r"横向|纵向|水平|垂直|标签|label|column|列|stacked|side-by-side|inline", re.I)


MODAL_WIDTHS = (520, 640, 720, 800)


def modal_layout_problems(expected, layout, root, form):
    problems = []
    raw_width = layout.get("modalWidth")
    width = int(str(raw_width).replace("px", "")) if str(raw_width).replace("px", "").isdigit() else None
    columns = layout.get("columns")
    if width not in MODAL_WIDTHS:
        problems.append(f"Overlay Form must record modalWidth in {MODAL_WIDTHS}")
    if columns not in (1, 2):
        problems.append("Overlay Form uses one or two columns")
    if columns == 2 and width is not None and width < 720:
        problems.append("Two-column Overlay Form needs at least 720px width")
    parents = {id(child): parent for parent in walk(root) for child in parent["children"]}
    modal = next((n for n in walk(root) if identity(n) == "plasmicantd6modal" and form in list(walk(n))), None)
    if modal is None:
        return problems
    for child in (slot(modal, "children") or {}).get("children", []):
        stack = [child]
        while stack:
            node = stack.pop()
            if node is form or identity(node) == "plasmicantd6form" or form in list(walk(node)):
                continue
            if node["tag"] == "text" and node.get("text", "").strip():
                problems.append("Remove subtitle or workflow instruction text from the Modal body; keep the title and fields")
                break
            stack.extend(node.get("children", []))
    return problems


def inside_overlay(root, node):
    parents = {id(child): parent for parent in walk(root) for child in parent["children"]}
    cursor = parents.get(id(node))
    while cursor is not None:
        if identity(cursor) in {"plasmicantd6modal", "plasmicantd6drawer"}:
            return True
        cursor = parents.get(id(cursor))
    return False


def normalize_copy(text):
    return re.sub(r"[\s*`「」]", "", text or "")


def copy_coverage_problem(expected_form):
    """Every source copy unit is classified; every rendered copy maps back to a unit."""
    units = expected_form.get("sourceCopyUnits")
    fields = {f["nodeName"]: f for f in expected_form.get("fields", [])}
    rendered = [(f["nodeName"], key, f.get(key)) for f in fields.values()
                for key in ("description", "tooltip") if f.get(key)]
    if not isinstance(units, list):
        if rendered:
            return ["Form renders field copy without sourceCopyUnits; extract every requirement sentence attached to a field first"]
        return []
    from verify_component_policy import source_text
    problems, covered = [], set()
    for unit in units:
        if not isinstance(unit, dict) or not isinstance(unit.get("text"), str) or not isinstance(unit.get("field"), str):
            problems.append("sourceCopyUnits entries need field, text, decision and source")
            continue
        decision = unit.get("decision")
        if decision not in ("perceive-now", "perceive-on-demand", "not-user-facing"):
            problems.append(f"Copy unit for {unit['field']} needs decision perceive-now, perceive-on-demand or not-user-facing")
            continue
        try:
            quote = source_text(unit.get("source")) and unit["source"]["quote"]
        except (ValueError, OSError, UnicodeError) as error:
            problems.append(f"Copy unit for {unit['field']} has unusable source evidence: {error}")
            continue
        if normalize_copy(unit["text"]) not in normalize_copy(quote):
            problems.append(f"Copy unit for {unit['field']} is not a verbatim part of its source quote; do not paraphrase requirement copy")
            continue
        field = fields.get(unit["field"])
        if field is None:
            problems.append(f"Copy unit targets unknown field {unit['field']}")
            continue
        if decision == "perceive-now":
            if field.get("description") != unit["text"]:
                problems.append(f"Copy unit for {unit['field']} is perceive-now but the field description does not match it")
            covered.add((unit["field"], "description", unit["text"]))
        elif decision == "perceive-on-demand":
            if field.get("tooltip") != unit["text"]:
                problems.append(f"Copy unit for {unit['field']} is perceive-on-demand but the label tooltip does not match it")
            covered.add((unit["field"], "tooltip", unit["text"]))
        else:
            if unit["text"] in (field.get("description"), field.get("tooltip")):
                problems.append(f"Copy unit for {unit['field']} is not-user-facing but the field renders it")
            excluded = [item.get("text") for item in field.get("excludedCopy", []) if isinstance(item, dict)]
            if unit["text"] not in excluded:
                problems.append(f"Not-user-facing copy for {unit['field']} must be listed in excludedCopy")
    for name, key, text in rendered:
        if (name, key, text) not in covered:
            problems.append(f"Field {name} renders {key} copy with no sourceCopyUnit; every rendered sentence must trace to the requirement")
    return problems


def copy_triage_problem(field):
    """Render only text the user must perceive; classify it before choosing tooltip or description."""
    triage = field.get("copyTriage")
    description = field.get("description")
    tooltip = field.get("tooltip")
    if description and triage != "perceive-now":
        return (f"Field {field['nodeName']} renders a persistent description without copyTriage=perceive-now; "
                "classify the copy first (visible now, on demand via tooltip, or not user-facing)")
    if tooltip and triage not in ("perceive-on-demand", "perceive-now"):
        return (f"Field {field['nodeName']} renders a label tooltip without a copyTriage decision")
    if triage == "not-user-facing":
        if description or tooltip:
            return (f"Field {field['nodeName']} is marked not-user-facing but renders copy; remove it")
        excluded = field.get("excludedCopy")
        if not isinstance(excluded, list) or not excluded:
            return (f"Field {field['nodeName']} drops source copy without excludedCopy evidence")
        from verify_component_policy import source_text
        for item in excluded:
            if not isinstance(item, dict) or not isinstance(item.get("text"), str):
                return "excludedCopy entries need the verbatim text and its source evidence"
            try:
                source_text(item.get("source"))
            except (ValueError, OSError, UnicodeError) as error:
                return f"Field {field['nodeName']} excludedCopy evidence is unusable: {error}"
    return None


def label_width_problem(label_width, has_tooltip):
    if not isinstance(label_width, dict):
        return "Grid Form needs labelWidth {longestLabel, labelTextPx, requiredMarkPx, helpIconPx, measuredPx}"
    parts = [label_width.get(k) for k in ("labelTextPx", "requiredMarkPx", "helpIconPx", "paddingPx", "measuredPx")]
    if not all(isinstance(n, (int, float)) and n >= 0 for n in parts):
        return "labelWidth needs non-negative labelTextPx, requiredMarkPx, helpIconPx, paddingPx and measuredPx"
    label, mark, icon, padding, measured = parts
    if has_tooltip and icon <= 0:
        return "A label tooltip adds a help icon; helpIconPx must be measured and included in the label width"
    if not has_tooltip and icon != 0:
        return "helpIconPx must be 0 when no field shows a label tooltip"
    if padding < 8:
        return "labelWidth needs at least 8px trailing label padding; a tighter value overlaps the control"
    if abs(measured - (label + mark + icon + padding)) > 2:
        return ("measuredPx must equal labelTextPx + requiredMarkPx + helpIconPx + paddingPx (within 2px); "
                "recalculate from the rendered label including the help icon and its padding")
    return None


def description_budget_problem(columns, fields):
    """A multi-column Form keeps descriptions to one short line; background text belongs in the tooltip."""
    if not isinstance(columns, int) or columns < 3:
        return None
    for field in fields:
        text = field.get("description")
        if isinstance(text, str) and len(text) > 40:
            return (f"Field {field['nodeName']} carries a long persistent description in a {columns}-column Form; "
                    "move background text to the label tooltip")
    return None


def alignment_reason_problem(reason):
    if not isinstance(reason, dict):
        return ('A non-default label alignment needs structured evidence, not prose: '
                '{"kind":"source","evidence":{path,sha256,quote}} that states the alignment.')
    if reason.get("kind") != "source":
        return 'labelAlignReason kind must be "source" with path, sha256 and a verbatim quote'
    from verify_component_policy import source_text
    try:
        source_text(reason.get("evidence"))
    except (ValueError, OSError, UnicodeError) as error:
        return f"labelAlignReason source evidence is unusable: {error}"
    if not re.search(r"左对齐|right|left|对齐", reason["evidence"].get("quote", ""), re.I):
        return "labelAlignReason quote does not state the alignment"
    return None


def columns_reason_problem(reason):
    if not isinstance(reason, dict):
        return ('Page Form default is three fields per row; another count needs structured columnsReason '
                '{"kind":"measurement","controlWidth":n,"columnWidth":n} or a source quote.')
    kind = reason.get("kind")
    if kind == "source":
        from verify_component_policy import source_text
        try:
            source_text(reason.get("evidence"))
        except (ValueError, OSError, UnicodeError) as error:
            return f"columnsReason source evidence is unusable: {error}"
        return None
    if kind == "measurement":
        control = reason.get("controlWidth")
        column = reason.get("columnWidth")
        if not all(isinstance(n, (int, float)) and n > 0 for n in (control, column)):
            return "columnsReason measurement needs positive controlWidth and columnWidth"
        if control * 3 <= column:
            return "Three columns already fit the measured control width; keep the default"
        return None
    return 'columnsReason kind must be "source" or "measurement"'


def width_reason_problem(reason):
    """A compact control must cite a source or measured narrower width; prose is not evidence."""
    if not isinstance(reason, dict):
        return ('Compact text/selection control needs structured controlWidthReason evidence, not prose: '
                '{"kind":"source","evidence":{path,sha256,quote}} or '
                '{"kind":"measurement","controlWidth":n,"columnWidth":n}.')
    kind = reason.get("kind")
    if kind == "source":
        from verify_component_policy import source_text
        try:
            source_text(reason.get("evidence"))
        except (ValueError, OSError, UnicodeError) as error:
            return f"controlWidthReason source evidence is unusable: {error}"
        return None
    if kind == "measurement":
        width = reason.get("controlWidth")
        column = reason.get("columnWidth")
        if not all(isinstance(n, (int, float)) and n > 0 for n in (width, column)):
            return "controlWidthReason measurement needs positive controlWidth and columnWidth"
        if width >= column:
            return "Measured control width is not narrower than its column; let the control fill the column"
        return None
    return 'controlWidthReason kind must be "source" or "measurement"; prose justifications are not accepted'


def layout_reason_problem(reason, direction, default):
    """Reject prose justifications; require source or measurement evidence."""
    if not isinstance(reason, dict):
        return (f"Non-default Form layout ({direction}) needs structured layoutReason evidence, not prose "
                f"(default is {default}). Set layout={default}, or provide "
                '{"kind":"source","evidence":{path,sha256,quote}} or {"kind":"measurement",...}.')
    kind = reason.get("kind")
    if kind == "source":
        from verify_component_policy import source_text
        try:
            source_text(reason.get("evidence"))
        except (ValueError, OSError, UnicodeError) as error:
            return f"layoutReason source evidence is unusable: {error}"
        quote = reason["evidence"].get("quote", "")
        if not LAYOUT_QUOTE.search(quote):
            return ("layoutReason source quote does not state the label direction or column layout; "
                    "quote the sentence that explicitly requires it")
        return None
    if kind == "measurement":
        numbers = [reason.get(key) for key in ("labelWidth", "controlMinWidth", "regionWidth")]
        if not all(isinstance(n, (int, float)) and n > 0 for n in numbers):
            return ("layoutReason measurement needs positive labelWidth, controlMinWidth and regionWidth")
        label, control, region = numbers
        if label + control <= region:
            return ("Measured widths do not show crowding (labelWidth + controlMinWidth <= regionWidth); "
                    f"use the default layout={default}")
        return None
    return ('layoutReason kind must be "source" or "measurement"; prose justifications are not accepted')


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


def layout_styles(node):
    """Public authored styles plus the installed layout registration defaults."""
    kind = identity(node)
    values = props(node)
    css = {}
    if kind == "plasmicantd6form":
        css.update(display="flex", **{"flex-direction": "column", "align-items": "flex-start"})
    elif kind == "plasmicantd6formitem":
        css["width"] = "stretch"
    elif kind == "plasmicantd6flex":
        css.update(display="flex", **{"flex-direction": "column" if values.get("vertical") is True else "row",
                                      "align-items": values.get("align", "stretch")})
    elif kind == "plasmicantd6row":
        css.update(display="flex", **{"flex-direction": "row"})
    css.update({key.strip(): value.strip() for key, value in styles(node).items()})
    return css


def fills_width(node, parent):
    css = layout_styles(node)
    if css.get("max-width", "none") not in {"none", "100%"}:
        return False
    width = css.get("width", "auto")
    if width in {"100%", "stretch"}:
        return True
    if width != "auto" or parent is None:
        return False
    parent_css = layout_styles(parent)
    if identity(node) == "plasmicantd6col" and identity(parent) == "plasmicantd6row":
        values = props(node)
        span = values.get("span")
        flex = str(values.get("flex", ""))
        return (type(span) is int and 1 <= span <= 24) or bool(re.fullmatch(r"[1-9]\d*(?:\s+1\s+0(?:px|%)?)?", flex))
    if parent_css.get("display") in {"flex", "inline-flex"}:
        if parent_css.get("flex-direction", "row") not in {"column", "column-reverse"}:
            return bool(re.fullmatch(r"[1-9]\d*(?:\s+1\s+0(?:px|%)?)?", css.get("flex", "")))
        return css.get("align-self", parent_css.get("align-items", "stretch")) == "stretch"
    if parent_css.get("display") in {"grid", "inline-grid"}:
        return css.get("justify-self", parent_css.get("justify-items", "stretch")) in {"normal", "stretch"}
    # Block formatting fills its containing block; unknown component DOM does not prove it.
    return css.get("display") in {"block", "flex", "grid"} or node["tag"] in {"div", "section", "form"}


def check_form_layout(root, form, expected):
    nodes = list(walk(root))
    parents = {id(child): node for node in nodes for child in node["children"]}

    def parent(node):
        result = parents.get(id(node))
        while result is not None and result["tag"] == "slot":
            result = parents.get(id(result))
        return result

    ancestors = []
    current = parent(form)
    while current is not None:
        ancestors.append(current)
        current = parent(current)
    overlay = any(identity(n) in {"plasmicantd6modal", "plasmicantd6drawer"} for n in ancestors)
    default = "vertical" if overlay else "horizontal"
    direction = expected.get("formLayout")
    errors = []
    valid_direction = isinstance(direction, str) and direction in {"horizontal", "vertical", "inline"}
    if not valid_direction:
        errors.append({"error": "Every Form requires a source-derived formLayout"})
    elif props(form).get("layout") != direction:
        errors.append({"error": "Wrong native Form layout"})
    reason = expected.get("layoutReason")
    if valid_direction and direction != default:
        problem = layout_reason_problem(reason, direction, default)
        if problem:
            errors.append({"error": problem, "rule": "references/libraries/antd_v6/compositions/form-layout.md#layout-ownership"})

    # Check all ancestors carrying field width, including unnamed nested wrappers.
    # A missing optional grid inventory must never exempt these paths.
    checked = set()
    for item in (n for n in walk(slot(form, "children") or {"children": []}) if identity(n) == "plasmicantd6formitem"):
        current = item
        while current is not None:
            if id(current) not in checked:
                checked.add(id(current))
                if not (identity(current) == "plasmicantd6formitem" and props(current).get("noStyle") is True) and not fills_width(current, parent(current)):
                    errors.append({"node": node_name(current), "error": "Form, field and intermediate layout wrappers must fill their allocated width"})
            if current is form:
                break
            current = parent(current)
    # The Form itself can be trapped inside a shrinking wrapper in its surface.
    for current in ancestors:
        if identity(current) in {"plasmicantd6card", "plasmicantd6modal", "plasmicantd6drawer", "plasmicoverseasappshell"} or current["tag"] == "root":
            break
        if id(current) not in checked and not fills_width(current, parent(current)):
            errors.append({"node": node_name(current), "error": "Form surface wrapper must fill its allocated width"})
    return errors


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


def resolve_pages(planned, inventory):
    """Bind reviewed selectors to current Page identities without modifying input."""
    resolved = []
    for page in planned:
        selectors = {key: page[key] for key in ("path", "name", "componentUuid") if key in page}
        if not selectors or any(not isinstance(value, str) or not value.strip() for value in selectors.values()):
            raise ValueError("Page requires a nonempty path, name or componentUuid selector")
        matches = inventory
        for key, value in selectors.items():
            matches = [model for model in matches if (
                model.get("pageMeta", {}).get("path") if key == "path" else
                model.get("uuid") if key == "componentUuid" else model.get("name")
            ) == value]
        if len(matches) != 1 or not matches[0].get("uuid"):
            raise ValueError(f"Expected one Page matching {selectors}; found {len(matches)} (missing, ambiguous or conflicting selectors)")
        resolved.append({**page, "componentUuid": matches[0]["uuid"]})
    ids = [page["componentUuid"] for page in resolved]
    if len(ids) != len(set(ids)):
        raise ValueError("Page selectors resolve to duplicate component UUIDs")
    return resolved


def check(expectations, overview, readback):
    errors = []
    checked = 0
    planned = expectations.get("pages", [])
    projects = [m for m in overview.get("results", []) if m.get("__type") == "Project"]
    pages = [m for m in readback.get("results", []) if m.get("type") == "page"]
    if len(projects) != 1:
        errors.append({"error": "Exactly one public MCP Project overview required"})
    inventory = [m for m in projects[0].get("components", []) if m.get("type") == "page"] if len(projects) == 1 else []
    try:
        planned = resolve_pages(planned, inventory)
    except ValueError as error:
        return {"passed": False, "checkedFields": 0, "errors": errors + [{"error": str(error)}]}
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
            if props(form).get("mode", "simplified") != "advanced":
                errors.append({"page": model["uuid"], "form": form_name, "error": "Form.Item inventory requires effective mode=advanced; simplified mode renders formItems instead of children"})
                continue
            errors.extend({"page": model["uuid"], "form": form_name, **error}
                          for error in check_form_layout(root, form, expected_form))
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
                if "modalWidth" in layout and (len(modals) != 1 or str(props(modals[0]).get("width")) != str(layout["modalWidth"])):
                    failures.append("Wrong Form Modal width")
                if len(candidates) != 1:
                    failures.append("Expected one field layout container inside Form")
                else:
                    container = candidates[0]
                    css = {k: v.strip() for k, v in styles(container).items()}
                    if css.get("width") != "100%" or styles(form).get("width", "").strip() != "100%":
                        failures.append("Field layout container must fill Form width")
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
                        required = columns if row is not layout["rows"][-1] else None
                        if actual != row["fields"] or (required and len(actual) != required) or len(actual) > columns:
                            failures.append(f"Field row {row['container']} must contain the expected complete field group: {actual} != {row['fields']}")
                        for name in row["fields"]:
                            if name in row_owners:
                                failures.append("Field appears in multiple layout rows")
                            row_owners[name] = row_node
                if layout and inside_overlay(root, form):
                    failures.extend(modal_layout_problems(expected_form, layout, root, form))
                if layout and inside_overlay(root, form):
                    for expected_field in expected_form["fields"]:
                        if expected_field.get("description"):
                            failures.append(f"Overlay field {expected_field['nodeName']} carries a persistent description; move it to the label tooltip and keep the Modal body to fields only")
                label_width = expected_form.get("labelWidth")
                if layout and not inside_overlay(root, form):
                    if not (isinstance(label_width, dict) and isinstance(label_width.get("longestLabel"), str)):
                        failures.append("Grid Form needs labelWidth {longestLabel, labelTextPx, requiredMarkPx, helpIconPx, measuredPx}")
                    else:
                        problem = label_width_problem(label_width, any(f.get("tooltip") for f in expected_form["fields"]))
                        if problem:
                            failures.append(problem)
                        else:
                            label_col = props(form).get("labelCol")
                            flex = label_col.get("flex") if isinstance(label_col, dict) else None
                            if flex != f'{int(label_width["measuredPx"])}px':
                                failures.append(f"Native labelCol must be {{flex: \"{int(label_width['measuredPx'])}px\"}} to match the measured label width")
                    align = expected_form.get("labelAlign", "right")
                    native_align = props(form).get("labelAlign", "right")
                    if native_align != align:
                        failures.append("Native labelAlign must match the recorded alignment")
                    if align != "right":
                        problem = alignment_reason_problem(expected_form.get("labelAlignReason"))
                        if problem:
                            failures.append(problem)
                    budget = description_budget_problem(layout["columns"], expected_form["fields"])
                    if budget:
                        failures.append(budget)
                    failures.extend(copy_coverage_problem(expected_form))
                    if layout["columns"] != 3:
                        problem = columns_reason_problem(expected_form.get("columnsReason"))
                        if problem:
                            failures.append(problem)
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
                    triage = copy_triage_problem(field)
                    if triage:
                        failures.append(triage)
                    values = props(item)
                    if values.get("name") != field["name"]:
                        failures.append("Wrong field key")
                    label = content(slot(item, "label"))
                    if label != field["label"] or re.search(r"[*＊]", label):
                        failures.append("Label must match plain source label")
                    rules = values.get("rules", [])
                    if not isinstance(rules, list) or any(not any(all(json.dumps(r.get(k), sort_keys=True) == json.dumps(v, sort_keys=True) for k, v in rule.items()) for r in rules) for rule in field.get("rules", [])):
                        failures.append("Missing expected validation rule")
                    if isinstance(rules, list) and any(r.get("ruleType") == "advanced" and not re.fullmatch(r"\s*\{\{[\s\S]+\}\}\s*", str(r.get("custom", ""))) for r in rules):
                        failures.append("Advanced validator must be a dynamic function binding")
                    tooltip = content(slot(item, "tooltip")) or values.get("tooltip", "")
                    if tooltip != field.get("tooltip", ""):
                        failures.append("Wrong Form.Item tooltip content")
                    if "validateFirst" in field and values.get("validateFirst") is not field["validateFirst"]:
                        failures.append("Wrong Form.Item validation short-circuit setting")
                    if "description" in field:
                        placement = field.get("descriptionPlacement", "below")
                        description_slot = slot(item, "description")
                        extra_text = content(description_slot) or values.get("description", "")
                        instruction = description_slot
                        if placement == "afterControl":
                            direct = [n for n in (slot(item, "children") or {}).get("children", []) if n["tag"] != "text"]
                            candidates = [n for n in direct if node_name(n) == field.get("descriptionNode")]
                            if not field.get("descriptionNode") or len(candidates) != 1:
                                failures.append("Expected one inline instruction in Item children")
                                instruction = None
                            else:
                                instruction = candidates[0]
                                if identity(instruction) != "plasmicantd6typographytext" or props(instruction).get("type") != "secondary":
                                    failures.append("Inline instructions must use secondary Typography.Text")
                                if not direct or node_name(direct[0]) != field["control"] or direct.index(instruction) != 1:
                                    failures.append("Inline instruction must immediately follow the direct control")
                                if content(slot(instruction, "children")) != field["description"]:
                                    failures.append("Wrong inline instruction text")
                            if extra_text:
                                failures.append("Remove bottom extra when instructions are inline")
                        elif placement == "below":
                            if extra_text != field["description"]:
                                failures.append("Persistent instructions must match Form.Item description")
                        else:
                            failures.append("Unknown field instruction placement")
                        owned_text = {id(n) for n in walk(instruction or {"children": []})}
                        if field["description"] and any(
                            n["tag"] == "text" and n.get("text", "").strip() == field["description"]
                            and id(n) not in owned_text
                            for n in walk(form_children or {"children": []})
                        ):
                            failures.append("Remove standalone duplicate field instructions")
                    children = slot(item, "children")
                    controls = [n for n in (children or {}).get("children", []) if n["tag"] == "plasmic-component" and n["attrs"].get("data-plasmic-name") == field["control"]]
                    if len(controls) != 1:
                        failures.append("Control must be a direct Item child")
                    else:
                        control = controls[0]
                        compact = identity(control) in {"plasmicantd6" + suffix for suffix in (
                            "checkbox", "checkboxgroup", "radio", "radiogroup", "radiobutton",
                            "switch", "rate", "upload", "uploadbutton", "colorpicker",
                        )}
                        if not compact:
                            css = layout_styles(control)
                            fills = css.get("width") in {"100%", "stretch"} and css.get("max-width", "none") in {"none", "100%"}
                            if not fills:
                                problem = width_reason_problem(field.get("controlWidthReason"))
                                if problem:
                                    failures.append(problem)
                        direct = [n for n in children["children"] if n["tag"] != "text"]
                        if not editable(controls[0]) or direct[0] is not controls[0] or sum(editable(n) for n in direct) != 1:
                            failures.append("Item must have exactly one editable control as its first child")
                        if any(k in props(controls[0]) for k in ("value", "defaultValue", "checked", "defaultChecked")):
                            failures.append("Control value conflicts with Form ownership")
                if failures:
                    errors.append({"page": model["uuid"], "form": form_name, "field": field["name"], "errors": failures})
        reasons = {}
        for expected_form in page["forms"]:
            reason = expected_form.get("layoutReason")
            if isinstance(reason, dict):
                reasons.setdefault(json.dumps(reason, sort_keys=True, ensure_ascii=False), []).append(expected_form["name"])
        for forms in reasons.values():
            if len(forms) > 1:
                errors.append({"page": model["uuid"], "forms": forms,
                               "error": "Duplicated layoutReason across Forms; each deviation needs its own evidence"})
    return {"passed": not errors, "checkedFields": checked, "errors": errors}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("expectations", type=Path)
    parser.add_argument("mcp_read", type=Path)
    parser.add_argument("--overview", type=Path, required=True)
    args = parser.parse_args()
    expected = json.loads(args.expectations.read_text(encoding="utf-8"))
    result = check(expected, json.loads(args.overview.read_text(encoding="utf-8")), json.loads(args.mcp_read.read_text(encoding="utf-8")))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    raise SystemExit(0 if result["passed"] else 1)


if __name__ == "__main__":
    main()
