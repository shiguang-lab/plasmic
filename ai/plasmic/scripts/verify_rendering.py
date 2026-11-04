"""Check complete public layout evidence, including clipping-aware problems.

Intentional Table horizontal scrolling remains valid: the Desktop computes
overflow after intersecting ancestor clipping/scroll regions. This check does
not infer visual hierarchy, text meaning or interactive state coverage.
"""
from verify_shell_height import finite_number

# Rounding up a measured ActionGroup width (e.g. 130 + 32 -> 162) stays within this.
OPERATION_SLACK = 8


def check(layouts, page_ids):
    errors = []
    if set(layouts) != set(page_ids):
        errors.append("Layout evidence must cover exactly the scoped Pages")
    for uuid in page_ids:
        layout = layouts.get(uuid, {})
        frames = layout.get("snapshot", {}).get("frames", [])
        if len(frames) != 1:
            errors.append({"page": uuid, "error": layout.get("error", "Exactly one component-targeted frame required")})
            continue
        checks = layout.get("snapshot", {}).get("checked", [])
        if not isinstance(checks, list) or "table-cell-control-overflow" not in checks:
            errors.append({"page": uuid, "error": "Fresh Desktop layout with table-cell-control-overflow checking required; older captures cannot establish fixed-cell control containment"})
            continue
        frame = frames[0]
        if (frame.get("ready") is not True or frame.get("truncated") is not False
                or frame.get("read", {}).get("view") != "full"
                or any(not finite_number(frame.get(k)) or frame[k] <= 0 for k in ("width", "height"))
                or not isinstance(frame.get("elements"), list) or not frame["elements"]
                or not isinstance(frame.get("images"), list) or not isinstance(frame.get("problems"), list)):
            errors.append({"page": uuid, "error": "Complete ready full layout, positive viewport and explicit image/problem lists required"})
            continue
        # Table ownership comes from the native DOM capture. Equal screen
        # coordinates do not identify a column across separate Table instances.
        columns = {}
        for element in frame["elements"]:
            cell = element.get("cellContent")
            if not isinstance(cell, dict):
                continue
            required, width = cell.get("requiredWidth"), element.get("width")
            key = (cell.get("tableIndex"), cell.get("columnIndex"), cell.get("columnSpan"))
            if (any(type(index) is not int or index < 0 for index in key[:2])
                    or type(key[2]) is not int or key[2] < 1
                    or not finite_number(required) or required <= 0 or not finite_number(width) or width <= 0):
                errors.append({"page": uuid, "elementIndex": element.get("index"),
                               "error": "Fresh sticky-cell tableIndex/logical columnIndex/columnSpan ownership and positive measured widths required; resolve overlapping table cells or use a Desktop build exposing logical cell ownership and recapture layout"})
                continue
            previous = columns.get(key, (0, 0))
            columns[key] = (max(previous[0], width), max(previous[1], required))
        for (table, column, span), (width, required) in sorted(columns.items()):
            if width > required + OPERATION_SLACK:
                errors.append({"page": uuid, "tableIndex": table, "columnIndex": column, "columnSpan": span,
                               "width": width, "requiredWidth": required,
                               "error": "Fixed control column is wider than its widest measured content plus padding; size Column.width from requiredWidth and check scroll.x"})
        problems = frame["problems"]
        if problems or any(e.get("horizontalOverflow") is True or e.get("cellContent", {}).get("overflow") is True for e in frame["elements"]) or any(i.get("loaded") is not True for i in frame["images"]):
            errors.append({"page": uuid, "error": "Unresolved rendered overflow/image problems", "problems": problems})
    return {"passed": not errors, "errors": errors, "notChecked": ["visual hierarchy/fidelity", "hidden runtime states", "interaction and scroll behavior"]}
