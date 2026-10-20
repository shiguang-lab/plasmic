"""Check native device columns and shared page references in a complete Project read."""
from collections import Counter
from math import isfinite


def check(overview, presets=None, overview_name="页面总览"):
    errors = []
    projects = [p for p in overview.get("results", []) if p.get("__type") == "Project"]
    if len(projects) != 1:
        return {"passed": False, "errors": ["Exactly one Project required"]}
    project = projects[0]
    pages = {p["uuid"] for p in project.get("components", []) if p.get("type") == "page"}
    requested = ["Desktop"] if presets is None else presets
    sizes = project.get("devicePresets", [])
    expected = set()
    if not isinstance(requested, list) or not requested or any(not isinstance(p, str) for p in requested) or len(set(requested)) != len(requested):
        errors.append("Distinct nonempty device preset names required")
        requested = []
    for name in requested:
        matches = [p for p in sizes if p.get("name") == name]
        if len(matches) != 1:
            errors.append(f"Missing or ambiguous native preset: {name}")
        elif any(type(matches[0].get(k)) not in (int, float) or not isfinite(matches[0][k]) or matches[0][k] <= 0 for k in ("width", "height")):
            errors.append(f"Finite positive native preset dimensions required: {name}")
        else:
            expected.add((matches[0].get("width"), matches[0].get("height")))
    if not pages:
        errors.append("Routed Pages required")
    for uuid in sorted(pages):
        actual = {(f.get("width"), f.get("height")) for f in project.get("pageFrames", []) if f.get("componentUuid") == uuid}
        if not expected or actual != expected:
            errors.append({"page": uuid, "error": "Device columns differ from requested native presets", "expected": sorted(expected), "actual": sorted(actual, key=str)})
    groups = [c for c in project.get("canvases", []) if any(f.get("componentUuid") in pages for f in c.get("frames", []))]
    if len(groups) != 1:
        errors.append("Exactly one overview canvas must reference all routed Pages")
    else:
        if not isinstance(overview_name, str) or not overview_name.strip() or groups[0].get("name") != overview_name:
            errors.append({"error": "Overview canvas name must match the source-reviewed business name", "expected": overview_name, "actual": groups[0].get("name")})
        frames = [f for f in groups[0]["frames"] if f.get("componentUuid") in pages]
        if Counter(f["componentUuid"] for f in frames) != Counter({p: 1 for p in pages}):
            errors.append("Overview Page references are missing or duplicated")
        for index, frame in enumerate(frames):
            if (frame.get("width"), frame.get("height")) not in expected:
                errors.append({"frame": frame.get("uuid"), "error": "Overview viewport differs from requested presets"})
            x, y = frame.get("x"), frame.get("y")
            w, h = frame.get("width"), frame.get("height")
            if any(type(v) not in (int, float) or not isfinite(v) for v in (x, y, w, h)) or w <= 0 or h <= 0:
                errors.append("Finite positive overview geometry required")
                continue
            for other in frames[:index]:
                if all(type(other.get(k)) in (int, float) for k in ("x", "y", "width", "height")) and x < other["x"] + other["width"] and other["x"] < x + w and y < other["y"] + other["height"] and other["y"] < y + h:
                    errors.append("Overview Page frames overlap")
    return {"passed": not errors, "presets": requested, "pageCount": len(pages), "errors": errors}
