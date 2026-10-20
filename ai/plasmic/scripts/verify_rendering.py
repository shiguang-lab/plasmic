"""Check complete public layout evidence, including clipping-aware problems.

Intentional Table horizontal scrolling remains valid: the Desktop computes
overflow after intersecting ancestor clipping/scroll regions. This check does
not infer visual hierarchy, text meaning or interactive state coverage.
"""
from verify_shell_height import finite_number


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
        frame = frames[0]
        if (frame.get("ready") is not True or frame.get("truncated") is not False
                or frame.get("read", {}).get("view") != "full"
                or any(not finite_number(frame.get(k)) or frame[k] <= 0 for k in ("width", "height"))
                or not isinstance(frame.get("elements"), list) or not frame["elements"]
                or not isinstance(frame.get("images"), list) or not isinstance(frame.get("problems"), list)):
            errors.append({"page": uuid, "error": "Complete ready full layout, positive viewport and explicit image/problem lists required"})
            continue
        problems = frame["problems"]
        if problems or any(e.get("horizontalOverflow") is True for e in frame["elements"]) or any(i.get("loaded") is not True for i in frame["images"]):
            errors.append({"page": uuid, "error": "Unresolved rendered overflow/image problems", "problems": problems})
    return {"passed": not errors, "errors": errors, "notChecked": ["visual hierarchy/fidelity", "hidden runtime states", "interaction and scroll behavior"]}
