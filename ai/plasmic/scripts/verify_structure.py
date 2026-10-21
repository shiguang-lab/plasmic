#!/usr/bin/env python3
"""Check source-reviewed routes/navigation against public MCP readbacks.

Does not interpret requirement prose or verify runtime/visual behavior.
"""
import argparse
import json
import re
import verify_component_policy
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from verify_bindings import role_menu
from verify_selection import ROLES, category_errors
from verify_forms import TextTree, walk, node_name, props, identity, slot, content


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
        if set(item) - {"key", "label", "href", "hidden", "disabled", "type", "icon", "children"}:
            raise ValueError("Unsupported menu item properties require explicit contract checks")
        if any("{{" in json.dumps(item.get(key, "")) for key in ["key", "label", "href", "hidden", "disabled", "type", "icon"]):
            raise ValueError("Dynamic menu items require preview evidence")
        if any(not isinstance(item.get(key, False), bool) for key in ("hidden", "disabled")):
            raise ValueError("Menu hidden and disabled must be boolean")
        if item.get("type", "item") not in {"item", "group", "divider"}:
            raise ValueError("Menu type must be a literal registered item type")
        if "href" in item and not isinstance(item["href"], str):
            raise ValueError("Menu href must be a literal string")
        result.append({
            "key": item["key"], "label": item["label"], "href": item.get("href"),
            "hidden": item.get("hidden", False), "disabled": item.get("disabled", False),
            "type": item.get("type", "item"), "icon": item.get("icon"),
            "children": menu_tree(item.get("children", []))
        })
    return result


def check_components(nodes, path, plan=None):
    errors = []
    for node in nodes:
        context = {"check": "component", "path": path, "node": node_name(node)}
        if identity(node) == "plasmicantd6dropdown":
            values = props(node)
            if not matches_props("contextMenu", values.get("trigger")):
                trigger = slot(node, "children")
                trigger_nodes = list(walk(trigger)) if trigger else []
                for button in (n for n in trigger_nodes if identity(n) == "plasmicantd6button"):
                    children, icon = slot(button, "children"), slot(button, "icon")
                    child_nodes = list(walk(children)) if children else []
                    text_positions = [i for i, n in enumerate(child_nodes) if n["tag"] == "text" and n.get("text", "").strip()]
                    if not text_positions:
                        continue
                    icon_nodes = list(walk(icon)) if icon else []
                    indicators = [n for n in walk(button) if n["tag"] == "plasmic-component" and identity(n) == "plasmicantdicondownoutlined"]
                    valid = False
                    if len(indicators) == 1:
                        indicator = indicators[0]
                        trailing_child = any(n is indicator and i > max(text_positions) for i, n in enumerate(child_nodes))
                        has_icon = bool(content(icon)) or any(n["tag"] == "plasmic-component" for n in icon_nodes)
                        placement = props(button).get("iconPlacement", "start")
                        only_end_indicator = (any(n is indicator for n in icon_nodes)
                                              and not content(icon)
                                              and not any(n["tag"] == "plasmic-component" and identity(n).startswith("plasmicantdicon")
                                                          and n is not indicator for n in icon_nodes))
                        valid = (trailing_child and (not has_icon or matches_props("start", placement))
                                 or only_end_indicator and matches_props("end", placement))
                    if not valid:
                        errors.append({"check": "dropdownIndicator", "path": path, "node": node_name(node),
                                       "button": node_name(button),
                                       "message": "Text Button Dropdown triggers require exactly one registered DownOutlined after the label, in children or icon with iconPlacement:end; popup arrow and Unicode are not trigger indicators"})
            items = values.get("menuItemsJson")
            if values.get("useMenuItemsSlot") is not True and isinstance(items, list):
                keys = []
                def visit(entries):
                    for item in entries:
                        if not isinstance(item, dict):
                            continue
                        if "value" in item:
                            errors.append({**context, "message": "Dropdown uses key, not value; onAction receives the native Menu key"})
                        if item.get("type", "item") not in {"divider", "group", "submenu"}:
                            key = item.get("key")
                            if not isinstance(key, str) or not key.strip():
                                errors.append({**context, "message": "Every Dropdown business action requires an explicit stable string key"})
                            else:
                                keys.append(key)
                        if isinstance(item.get("children"), list):
                            visit(item["children"])
                visit(items)
                if len(set(keys)) != len(keys):
                    errors.append({**context, "message": "Dropdown action keys must be unique across nested items"})
        if plan is not None and "components" in plan and (identity(node) == "plasmicantd6pagination" or identity(node) == "plasmicantd6table" and props(node).get("pagination") is not False):
            if not any(c.get("nodeName") == node_name(node) and c.get("role") == "pagination" for c in plan["components"]):
                errors.append({**context, "message": "Every active native pager needs an explicit reviewed pagination owner; disable unneeded Table pagination"})
        if identity(node) == "plasmicantd6table":
            values = props(node)
            if values.get("data") is None:
                errors.append({**context, "message": "Table requires an explicit queryData binding, including for an empty dataset"})
            children = slot(node, "children")
            columns = [n for n in walk(children) if identity(n) == "plasmicantd6tablecolumn"] if children else []
            if not columns:
                errors.append({**context, "message": "Table requires real Table.Column nodes in its Columns children Slot; data alone does not define columns"})
            for column in columns:
                if plan is not None and "components" in plan and not any(c.get("nodeName") == node_name(column) for c in plan["components"]):
                    errors.append({**context, "column": node_name(column), "message": "Every Column needs a source-reviewed field/presentation decision in components"})
                if not props(column).get("dataIndex") and not content(slot(column, "render")) and not any(
                    n.get("tag") == "plasmic-component" for n in walk(slot(column, "render") or {"children": []})
                ):
                    errors.append({**context, "column": node_name(column), "message": "Column requires a dataIndex or nonempty render Slot"})
        if identity(node) == "plasmicantd6card":
            children = slot(node, "children")
            # A SearchForm already owns its surface. Layout-only wrappers do not
            # turn another surrounding Card into an independent business region.
            components = [n for n in walk(children) if n["tag"] == "plasmic-component"] if children else []
            business = [n for n in components if identity(n) not in {
                "plasmicantd6flex", "plasmicantd6row", "plasmicantd6col", "plasmicantd6space"
            }]
            if business and identity(business[0]) in {"plasmicoverseassearchform", "plasmicantd6steps"}:
                owned = {id(n) for n in walk(business[0])}
                extra_text = any(n.get("tag") == "text" and content(n) and id(n) not in owned for n in walk(children))
                if not extra_text and all(id(n) in owned for n in business):
                    errors.append({**context, "message": "SearchForm/Steps-only layout requires no surrounding Card; use a layout container"})
    return errors


def check_complete_names(readback):
    """Full-suite check: every editable authored node, including hidden branches."""
    from verify_content import inventory
    errors = []
    for page in readback["results"]:
        if page.get("type") != "page" or not isinstance(page.get("baseVariantTplTree"), str):
            continue
        for node in inventory(page)["nodes"]:
            if not node["nodeName"]:
                errors.append({"check": "naming", "path": page.get("pageMeta", {}).get("path"),
                               **node,
                               "message": "Name this authored node from its actual role and owner/Slot/text context; reconcile source intent, never number the error list"})
    return errors


def prop_at(values, path):
    for key in path.split("."):
        if not isinstance(values, dict) or key not in values:
            return None
        values = values[key]
    return values


def has_event(node, event, page):
    value = props(node).get(event)
    if isinstance(value, str) and re.fullmatch(
        r"\s*\{\{\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*\{\s*\}\s*\}\}\s*", value
    ):
        return False
    return bool(value) or any(
        i.get("elementUuid") == node["attrs"].get("id") and i.get("eventName") == event
        for i in page.get("interactions", []))


def matches_props(expected, actual):
    # Readbacks may serialize a static value as a JSON literal expression.
    # Decode JSON only: never evaluate JavaScript or dynamic bindings.
    def static(value):
        if isinstance(value, str) and value.startswith("{{") and value.endswith("}}"):
            try:
                return json.loads(value[2:-2].strip())
            except (ValueError, TypeError):
                pass
        return value
    expected, actual = static(expected), static(actual)
    if isinstance(expected, dict):
        return isinstance(actual, dict) and all(k in actual and matches_props(v, actual[k]) for k, v in expected.items())
    if isinstance(expected, list):
        return isinstance(actual, list) and len(expected) == len(actual) and all(matches_props(a, b) for a, b in zip(expected, actual))
    return json.dumps(expected, sort_keys=True) == json.dumps(actual, sort_keys=True)


def component_owners(root):
    owners = {}

    def visit(node, owner=None, slot_name=None):
        if node["tag"] == "plasmic-component":
            owners[id(node)] = (owner, slot_name)
            for child in node["children"]:
                visit(child, node, child["attrs"].get("name") if child["tag"] == "slot" else None)
        else:
            for child in node["children"]:
                visit(child, owner, slot_name)

    visit(root)
    return owners


def check_search_forms(plan, root, path):
    """Check authored labels and reviewed grid/row policy, not runtime folding."""
    nodes, errors = list(walk(root)), []
    owners = component_owners(root)
    declarations = {c.get("nodeName"): c for c in plan.get("components", [])}
    for form in (n for n in nodes if identity(n) == "plasmicoverseassearchform"):
        spec = declarations.get(node_name(form), {})
        expected_rows = spec.get("props", {}).get("minRows", 1)
        if not matches_props(expected_rows, 1) and not verify_component_policy.approved_override(spec, 'minRows'):
            expected_rows = 1
        actual_rows = props(form).get("minRows", 1)
        if not matches_props(expected_rows, actual_rows):
            errors.append({"check": "searchFormLayout", "path": path, "node": node_name(form),
                           "expectedMinRows": expected_rows, "actualMinRows": actual_rows,
                           "message": "SearchForm minRows must follow the reviewed value (default 1); extra rows can suppress the expand/collapse control"})
        expected_columns = verify_component_policy.search_form_span(spec)
        actual_columns = props(form).get("colSpan", 6)
        if not matches_props(expected_columns, actual_columns):
            errors.append({"check": "searchFormLayout", "path": path, "node": node_name(form),
                           "expectedColSpan": expected_columns, "actualColSpan": actual_columns,
                           "message": "SearchForm must match the reviewed four-column (6) or three-column (8) mode; other spans require an explicit requirement-document override"})
        for field in (n for n in nodes if identity(n) == "plasmicoverseassearchformitem"):
            parent = owners.get(id(field), (None, None))[0]
            while parent is not None and identity(parent) != "plasmicoverseassearchform":
                parent = owners.get(id(parent), (None, None))[0]
            if parent is not form:
                continue
            label, custom = props(field).get("label"), slot(field, "labelContent")
            has_custom = custom is not None and (content(custom).strip() or any(n["tag"] == "plasmic-component" for n in walk(custom)))
            field_spec = declarations.get(node_name(field), {})
            expected_span = expected_columns
            field_constraints = field_spec.get("props", {})
            if field_constraints.get("span") is not None and verify_component_policy.approved_override(field_spec, 'span'):
                expected_span = field_constraints["span"]
            actual_span = props(field).get("span")
            if actual_span is None:
                actual_span = actual_columns
            if not matches_props(expected_span, actual_span):
                errors.append({"check": "searchFieldSpan", "path": path, "node": node_name(field),
                               "form": node_name(form), "expectedSpan": expected_span, "actualSpan": actual_span,
                               "message": "SearchForm.Item must inherit the reviewed Form colSpan unless its components entry declares a source-reviewed props.span override"})
            reviewed_empty = field_spec.get("source") and "label" in field_spec.get("props", {}) and field_spec["props"]["label"] == ""
            if not (isinstance(label, str) and label.strip() or has_custom or reviewed_empty):
                errors.append({"check": "searchFieldLabel", "path": path, "node": node_name(field),
                               "message": "SearchForm.Item needs a visible label/labelContent; placeholder is not a label. A deliberate label-free field needs an explicit source-reviewed label constraint"})
    return errors


def element_fallbacks(plan):
    entries = plan.get("elementFallbacks", [])
    if (not isinstance(entries, list) or any(not isinstance(e, dict) or any(
            not isinstance(e.get(k), str) or not e[k].strip() for k in ("nodeName", "reason", "source")) for e in entries)
            or len({e["nodeName"] for e in entries}) != len(entries)):
        raise ValueError("elementFallbacks requires distinct named nodes, verified contract-gap reasons and source citations")
    return {e["nodeName"]: e for e in entries}


def check_native_widgets(plan, nodes, page, path):
    """Guard authored widget replacements, not DOM emitted inside components.

    Passive semantic content/layout is allowed. Arbitrary CSS appearance and the
    validity of a reviewed contract-gap reason still need independent review.
    """
    tags = {"button", "input", "select", "textarea", "table", "dialog", "details", "summary", "progress", "meter"}
    roles = {"button", "checkbox", "combobox", "dialog", "grid", "listbox", "menu", "menubar", "menuitem",
             "menuitemcheckbox", "menuitemradio", "option", "radio", "radiogroup", "slider", "spinbutton",
             "switch", "tab", "table", "tablist", "tree", "treegrid", "treeitem"}
    actions = {i["elementUuid"] for i in page.get("interactions", []) if i.get("elementUuid") and i.get("eventName") in {"onClick", "onDoubleClick"}}
    exceptions, used, errors = element_fallbacks(plan), set(), []
    for node in nodes:
        if node["tag"] in {"root", "text", "slot", "plasmic-component"}:
            continue
        attrs = node["attrs"]
        role = next((r for r in attrs.get("role", "").lower().split() if r in roles), None)
        navigation = node["tag"] == "a" and bool(attrs.get("href", "").strip()) and attrs["href"].strip() != "#" and not attrs["href"].strip().lower().startswith("javascript:")
        action = not navigation and (attrs.get("id") in actions or "onclick" in attrs or "ondblclick" in attrs)
        if node["tag"] not in tags and not role and not action:
            continue
        name = node_name(node)
        if name in exceptions and sum(node_name(n) == name for n in nodes) == 1:
            used.add(name)
        else:
            errors.append({"check": "nativeWidget", "path": path, "node": name, "elementUuid": attrs.get("id"),
                           "tag": node["tag"], "role": role,
                           "message": "Use the existing registered widget/composition; an authored HTML/ARIA/click target requires a source-reviewed elementFallbacks contract gap"})
    for name in exceptions.keys() - used:
        errors.append({"check": "elementFallback", "path": path, "node": name,
                       "message": "Fallback must target exactly one authored widget; unused or blanket exceptions are invalid"})
    return errors


def check_required_nodes(plan, nodes, page, path):
    """Source-declared controls/actions, independent of what was generated.

    These checks establish native structure and wiring only. Actual effects,
    conditional editability and query semantics still need exercised Preview.
    """
    errors = []
    owners = component_owners(next(n for n in nodes if n["tag"] == "root"))

    def target(spec, key="nodeName"):
        found = [n for n in nodes if node_name(n) == spec.get(key)]
        if not isinstance(spec.get("source"), str) or not spec["source"].strip() or len(found) != 1:
            errors.append({"check": "requirement", "path": path, "node": spec.get(key), "message": "Source citation and one named target required"})
            return None
        return found[0]

    for spec in plan.get("components", []):
        node = target(spec)
        expected = re.sub(r"[^a-z0-9]", "", spec.get("component", "").lower())
        if node is not None and (not expected or node["tag"] != "plasmic-component" or identity(node) != expected):
            errors.append({"check": "nativeComponent", "path": path, "node": spec.get("nodeName"), "expected": spec.get("component"), "message": "Required source region must use the registered component; HTML tables, grids or styled text are not replacements"})
        if node is None:
            continue
        context = {"check": "componentUse", "path": path, "node": spec["nodeName"]}
        values, role = props(node), spec.get("role", "widget")
        if not matches_props(spec.get("props", {}), values):
            errors.append({**context, "message": "Native props differ from the reviewed property constraints", "properties": [key for key, value in spec["props"].items() if key not in values or not matches_props(value, values[key])]})
        for prop in spec.get("dynamicProps", []):
            encoded = json.dumps(prop_at(values, prop), ensure_ascii=False)
            if "{{" not in encoded or "}}" not in encoded:
                errors.append({**context, "property": prop, "message": "Required native binding is missing; sibling text is not a substitute"})
        owner, slot_name = owners.get(id(node), (None, None))
        if spec.get("owner") and (node_name(owner) if owner else None, slot_name) != (spec["owner"]["nodeName"], spec["owner"]["slot"]):
            errors.append({**context, "message": "Component is outside its reviewed native owner/Slot"})
        if role == "content-scope" and identity(node) != "plasmicantd6tabs":
            errors.append({**context, "message": "Content-scope navigation requires native Tabs in this library suite"})
        errors.extend({"path": path, **error} for error in category_errors(spec, node, plan.get("components", [])))
        if role == "row-actions":
            column, entry = owner, slot_name
            while column and identity(column) != "plasmicantd6tablecolumn":
                column, entry = owners.get(id(column), (None, None))
            if identity(node) != "plasmicreactuiactiongroup" or entry != "render" or not column:
                errors.append({**context, "message": "Row actions require native ActionGroup inside Column.render"})
            elif props(column).get("fixed") != "right" or not isinstance(props(column).get("width"), (int, float)) or isinstance(props(column).get("width"), bool) or props(column)["width"] <= 0:
                errors.append({**context, "message": "Operation Column must have fixed:right and a positive explicit width"})
            else:
                table = column
                while table and identity(table) != "plasmicantd6table":
                    table = owners.get(id(table), (None, None))[0]
                columns = [c for c in walk(slot(table, "children") or {"children": []}) if identity(c) == "plasmicantd6tablecolumn"] if table else []
                if not columns or columns[-1] is not column:
                    errors.append({**context, "message": "Operation Column must be the Table's final leaf column"})
        if role == "pagination":
            table = identity(node) == "plasmicantd6table"
            value = prop_at(values, "pagination.showTotal" if table else "showTotal")
            if identity(node) not in {"plasmicantd6table", "plasmicantd6pagination"} or not isinstance(value, str) or "{{" not in value or "}}" not in value:
                errors.append({**context, "message": "Pagination total belongs to the native showTotal binding"})
            if not table:
                regions = [n for n in nodes if node_name(n) == spec.get("dataOwner") and node_name(n)]
                if len(regions) != 1 or regions[0] is node or identity(regions[0]) == "plasmicantd6table" and props(regions[0]).get("pagination") is not False:
                    errors.append({**context, "message": "Standalone pagination needs one dataOwner with duplicated Table pagination disabled"})

    for spec in plan.get("controls", []):
        node = target(spec)
        if node is None:
            continue
        values = props(node)
        expected = re.sub(r"[^a-z0-9]", "", spec.get("component", "").lower())
        if not expected or identity(node) != expected or node["tag"] != "plasmic-component":
            errors.append({"check": "control", "path": path, "node": spec.get("nodeName"), "message": "Required editable registered control is missing; text, pre and styled labels cannot replace it"})
        if values.get("disabled") is True or values.get("readOnly") is True:
            errors.append({"check": "control", "path": path, "node": spec.get("nodeName"), "message": "Required editable control is permanently disabled/read-only"})
        for key, expected_value in spec.get("props", {}).items():
            if key not in values or json.dumps(values[key], sort_keys=True) != json.dumps(expected_value, sort_keys=True):
                errors.append({"check": "control", "path": path, "node": spec.get("nodeName"), "property": key, "expected": expected_value, "actual": values.get(key)})
        for event in spec.get("events", []):
            if not has_event(node, event, page):
                errors.append({"check": "control", "path": path, "node": spec.get("nodeName"), "missingEvent": event})

    for spec in plan.get("rowActions", []):
        column = target(spec, "column")
        control = target(spec, "control")
        if column is None or control is None:
            continue
        render = slot(column, "render")
        if (identity(column) != "plasmicantd6tablecolumn" or render is None
                or props(column).get("displayType") not in (None, "custom")
                or not any(n is control for n in walk(render))
                or identity(control) != "plasmicreactuiactiongroup"
                or not isinstance(spec.get("event"), str) or not spec["event"].strip()
                or not has_event(control, spec["event"], page)):
            errors.append({"check": "rowAction", "path": path, "column": spec.get("column"), "message": "Row actions require native ActionGroup with the declared event inside Column.render"})
    return errors


def check_presentation(plan, root, path):
    """Static heading/copy guards; source interpretation and pixels need review."""
    errors, nodes = [], list(walk(root))
    header = plan.get("pageHeader")
    permitted = set()
    if header is not None:
        if not isinstance(header, dict):
            raise ValueError("pageHeader must be null or an explicitly requested named region with a source")
        matches = [n for n in nodes if node_name(n) == header.get("nodeName")]
        if not header.get("source", "").strip() or len(matches) != 1:
            errors.append({"check": "pageHeader", "path": path, "message": "A requested Page header needs an explicit source and one named region"})
        else:
            permitted = {id(n) for n in walk(matches[0])}
    first_branch = set()
    for shell in nodes:
        if identity(shell) != "plasmicoverseasappshell":
            continue
        branch = slot(shell, "children")
        while branch:
            first_branch.add(id(branch))
            if branch["tag"] == "plasmic-component" and identity(branch) not in {"plasmicantd6flex", "plasmicantd6space", "plasmicantd6row", "plasmicantd6col"}:
                break
            branch = next((n for n in branch.get("children", []) if n["tag"] != "text"), None)
    for node in nodes:
        name = re.sub(r"[^a-z0-9]", "", (node_name(node) or "").lower())
        attrs = node.get("attrs", {})
        page_heading = (name in {"pageheader", "pageheading", "pagetitle", "pagesubtitle", "pageintro"}
                        or node["tag"] == "h1" or attrs.get("role") == "heading" and attrs.get("aria-level", "1") == "1"
                        or id(node) in first_branch and name.endswith("header"))
        if page_heading and id(node) not in permitted:
            errors.append({"check": "pageHeader", "path": path, "node": node_name(node), "message": "Unrequested standalone Page title/header/intro area; keep navigation in AppShell and business titles in their owning components"})

    normalize = lambda text: " ".join(text.split())
    copy = plan.get("copy", {})
    if copy and (not copy.get("source", "").strip() or not isinstance(copy.get("excluded"), list) or not isinstance(copy.get("entries"), list)):
        raise ValueError("Copy review requires source, excluded and entries arrays")
    ui_keys = {"title", "label", "description", "help", "message", "placeholder", "children"}

    def literals(value):
        if isinstance(value, str) and "{{" not in value:
            yield normalize(value)
        elif isinstance(value, list):
            for item in value:
                if isinstance(item, dict):
                    yield from literals(item)
        elif isinstance(value, dict):
            for key, item in value.items():
                if key in ui_keys or key in {"items", "options"}:
                    yield from literals(item)

    texts = [normalize(content(n)) for n in nodes if n["tag"] != "plasmic-component"]
    for node in nodes:
        if node["tag"] == "plasmic-component":
            texts.extend(literals(props(node)))
    for spec in copy.get("excluded", []):
        text = normalize(spec.get("text", ""))
        if not text or not spec.get("source", "").strip():
            raise ValueError("Excluded requirement/process copy needs text and source")
        if any(text in actual for actual in texts):
            errors.append({"check": "uiCopy", "path": path, "text": spec["text"], "message": "Requirement/process explanation leaked into UI copy"})
    return errors


def validate_page_plan(plan):
    def text(value):
        return isinstance(value, str) and bool(value.strip())

    def entries(value, keys):
        return isinstance(value, list) and all(isinstance(c, dict) and all(text(c.get(k)) for k in keys) for c in value)

    if not text(plan.get("name")):
        raise ValueError("Declare the source-reviewed Page directory name before generation; default to Chinese business wording")
    if "pageHeader" not in plan or plan["pageHeader"] is not None and (not isinstance(plan["pageHeader"], dict) or not all(text(plan["pageHeader"].get(k)) for k in ("nodeName", "source"))):
        raise ValueError("Declare pageHeader:null, or a named region with an explicit current user request source")
    components, copy = plan.get("components"), plan.get("copy")
    if not entries(components, ("nodeName", "component", "source")) or len({c["nodeName"] for c in components}) != len(components):
        raise ValueError("Required native component identities and sources must be planned independently of output")
    role_errors = []
    for index, component in enumerate(components):
        if component.get("role") not in {"widget", *ROLES}:
            role_errors.append(f"components/{index} ({component['nodeName']}): unknown role {component.get('role')!r}")
        if not text(component.get("purpose")):
            role_errors.append(f"components/{index} ({component['nodeName']}): source-reviewed purpose required")
    if role_errors:
        raise ValueError("; ".join(role_errors) + ". Choose source-derived roles from references/libraries/antd_v6/selection.md: " + ", ".join(sorted({"widget", *ROLES})) + ". Do not relabel components to fit output.")
    for index, component in enumerate(components):
        if not isinstance(component.get("props", {}), dict):
            raise ValueError(f"components/{index}/props must be an object of native property constraints")
        if not isinstance(component.get("dynamicProps", []), list) or any(not text(p) for p in component.get("dynamicProps", [])):
            raise ValueError(f"components/{index}/dynamicProps must be property paths")
        if "owner" in component and (not isinstance(component["owner"], dict) or not all(text(component["owner"].get(k)) for k in ("nodeName", "slot"))):
            raise ValueError(f"components/{index}/owner needs nodeName and native slot")
        if component.get("role") == "pagination" and component["component"] == "plasmic-antd6-pagination" and not text(component.get("dataOwner")):
            raise ValueError(f"components/{index}/dataOwner must identify the paged data region")
    if not isinstance(copy, dict) or not text(copy.get("source")) or not entries(copy.get("excluded"), ("text", "source")) or not entries(copy.get("entries"), ("text", "source", "nodeName", "at", "kind", "purpose")):
        raise ValueError("Independent UI-copy review requires source, excluded and complete entries arrays")
    element_fallbacks(plan)
    if not isinstance(plan.get("controls", []), list):
        raise ValueError("controls must be an array")
    if not isinstance(plan.get("bindings", []), list):
        raise ValueError("Declare source-derived bindings as an array, including [] when not applicable")
    for index, control in enumerate(plan.get("controls", [])):
        if not isinstance(control, dict) or not isinstance(control.get("props", {}), dict):
            raise ValueError(f"controls/{index}/props must be an object")
    for index, binding in enumerate(plan.get("bindings", [])):
        if not isinstance(binding, dict):
            raise ValueError(f"bindings/{index} must be an object")
        for key in ("props", "dynamicProps", "events"):
            if not isinstance(binding.get(key, []), list) or any(not text(v) for v in binding.get(key, [])):
                raise ValueError(f"bindings/{index}/{key} must be a string array")
        dependencies = binding.get("propStateDependencies", {})
        if not isinstance(dependencies, dict) or any(not isinstance(v, list) or not v or any(not text(s) for s in v) for v in dependencies.values()):
            raise ValueError(f"bindings/{index}/propStateDependencies must map prop names to state-path arrays")


def check(expectation, overview, readback, page_path=None):
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
    for page in inventory + pages:
        path = page.get("pageMeta", {}).get("path")
        plan = next((p for p in planned if p.get("path") == path), {})
        if "name" in plan and (not isinstance(plan["name"], str) or not plan["name"].strip() or page.get("name") != plan["name"]):
            errors.append({"check": "pageName", "path": path, "expected": plan["name"], "actual": page.get("name"),
                           "message": "Project-directory Page name must match the source-reviewed business name; node/route names are separate"})
    for name, collection in [("overview", inventory), ("readback", pages)]:
        paths = [p.get("pageMeta", {}).get("path") for p in collection]
        found = set(paths)
        wanted = {page_path} if name == "readback" and page_path is not None else set(expected_routes)
        duplicates = [path for path, count in Counter(paths).items() if count > 1]
        if found != wanted or duplicates:
            errors.append({
                "check": name + " routes", "missing": sorted(wanted - found, key=str),
                "extra": sorted(found - wanted, key=str), "duplicates": duplicates
            })
    selected = [p for p in inventory if page_path is None or p.get("pageMeta", {}).get("path") == page_path]
    if Counter(p["uuid"] for p in selected) != Counter(p["uuid"] for p in pages):
        errors.append({"check": "readback", "message": "Full Page readbacks must cover exactly the overview Page identities"})
    for page in pages:
        path = page.get("pageMeta", {}).get("path")
        markup = page.get("baseVariantTplTree")
        if not isinstance(markup, str):
            errors.append({"check": "readback", "path": path, "message": "Full Page markup required"})
            continue
        root = TextTree(markup).root
        nodes = list(walk(root))
        names = [node_name(n) for n in nodes if node_name(n)]
        invalid = [name for name in names if not re.fullmatch(r"[A-Z][A-Za-z0-9]*", name)]
        duplicates = [name for name, count in Counter(names).items() if count > 1]
        if invalid or duplicates:
            errors.append({"check": "naming", "path": path, "invalid": invalid, "duplicates": duplicates, "message": "Explicit editable node names must be English PascalCase and distinct within the owning Page; meaning still requires review"})
        plan = next((p for p in planned if p.get("path") == path), {})
        errors.extend(check_components(nodes, path, plan))
        errors.extend(check_search_forms(plan, root, path))
        errors.extend({**error, "path": path} for error in verify_component_policy.plan_errors(plan))
        errors.extend({**error, "path": path} for error in verify_component_policy.check_page(plan, page))
        errors.extend(check_native_widgets(plan, nodes, page, path))
        errors.extend(check_required_nodes(plan, nodes, page, path))
        errors.extend(check_presentation(plan, root, path))
        for binding in plan.get("bindings", []):
            matches = [n for n in nodes if node_name(n) == binding.get("nodeName")]
            if not binding.get("source") or len(matches) != 1:
                errors.append({"check": "binding", "path": path, "message": "Source citation and one named target required", "binding": binding})
                continue
            node = matches[0]
            values = props(node)
            for prop in binding.get("props", []):
                if prop_at(values, prop) is None or prop_at(values, prop) == "":
                    errors.append({"check": "binding", "path": path, "node": binding["nodeName"], "missingProp": prop})
            for prop in binding.get("dynamicProps", []):
                encoded = json.dumps(prop_at(values, prop), ensure_ascii=False)
                if "{{" not in encoded or "}}" not in encoded:
                    errors.append({"check": "binding", "path": path, "node": binding["nodeName"], "property": prop, "message": "Source requires dynamic data; a literal value is insufficient"})
            for prop, states in binding.get("propStateDependencies", {}).items():
                encoded = json.dumps(prop_at(values, prop), ensure_ascii=False)
                if not isinstance(states, list) or not states or any(not isinstance(s, str) or not re.fullmatch(r"[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*", s) for s in states):
                    errors.append({"check": "expectation", "path": path, "message": "propStateDependencies requires nonempty native state paths"})
                    continue
                if "{{" not in encoded or "}}" not in encoded or any(not re.search(r"\$state\." + re.escape(state) + r"(?![\w$])", encoded) for state in states):
                    errors.append({"check": "binding", "path": path, "node": binding["nodeName"], "property": prop, "requiredStateReferences": states})
            for event in binding.get("events", []):
                if not has_event(node, event, page):
                    errors.append({"check": "binding", "path": path, "node": binding["nodeName"], "missingEvent": event})
        try:
            shells = Shells(markup).props
            if len(shells) != 1:
                errors.append({"check": "shell", "path": path, "count": len(shells)})
                continue
            menu = shells[0].get("menuItems")
            if "roleQuery" in navigation:
                menu = role_menu(navigation["items"], navigation["roleQuery"], menu)
            actual_menu = menu_tree(menu)
            if expected_menu is not None and json.dumps(actual_menu, sort_keys=True) != json.dumps(expected_menu, sort_keys=True):
                errors.append({"check": "navigation", "path": path, "expected": expected_menu, "actual": actual_menu})
        except (ValueError, TypeError) as exc:
            errors.append({"check": "navigation", "path": path, "message": str(exc)})
    return {
        "passed": not errors, "expectedPageCount": len(planned), "actualPageCount": len(inventory),
        "errors": errors, "notChecked": ["source-interpretation", "runtime-behavior", "visual-quality", "dynamic UI-copy meaning and unlabeled visual heading inference"]
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("expectation", type=Path)
    parser.add_argument("overview", type=Path)
    parser.add_argument("pages", type=Path)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    expected, overview, pages = (json.loads(path.read_text(encoding="utf-8")) for path in [args.expectation, args.overview, args.pages])
    report = check(expected, overview, pages)
    # The CLI, like verify_all, is a full Page check. Internal structural helpers
    # remain usable for focused contract diagnostics without granting acceptance.
    from verify_selection import check as check_selection
    report["selection"] = check_selection(expected, pages)
    report["errors"].extend(report["selection"]["errors"])
    report["errors"].extend(check_complete_names(pages))
    report["passed"] = not report["errors"]
    output = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.report:
        args.report.write_text(output, encoding="utf-8")
    print(output)
    raise SystemExit(0 if report["passed"] else 1)


if __name__ == "__main__":
    main()
