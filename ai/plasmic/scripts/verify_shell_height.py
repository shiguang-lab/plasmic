#!/usr/bin/env python3
"""Check one standalone Overseas/Antd-v6 AppShell Page and its public snapshot.

Inputs are a full execute/read Page result and component-targeted snapshot_layout.
This checks model sizing and artboard geometry, not Preview scrolling or persistence.
"""
import argparse
import json
import math
import re
from pathlib import Path
from verify_slots import Tree, walk


VIEWPORT_HEIGHTS = {"100vh", "100dvh", "100svh", "100lvh"}


def finite_number(value):
    return type(value) in (int, float) and math.isfinite(value)


def styles(node):
    declarations = (part.split(":", 1) for part in node["attrs"].get("style", "").split(";") if ":" in part)
    return {key.strip(): value.strip() for key, value in declarations}


def check(readback, snapshot):
    errors = []
    measurements = []
    pages = [r for r in readback["results"] if r.get("type") == "page"]
    if len(pages) != 1:
        errors.append("Read exactly one full Page")
    else:
        page = pages[0]
        tree = Tree(page.get("baseVariantTplTree", "")).root
        roots = tree["children"]
        if len(roots) != 1:
            errors.append("Expected one Page root")
        else:
            css = styles(roots[0])
            if css.get("height") not in VIEWPORT_HEIGHTS:
                errors.append("Page root needs a definite viewport height; stretch/auto and min/max-height alone do not fill the shell")
            if css.get("min-height") not in {"0", "0px"}:
                errors.append("Page root needs min-height:0")
            if css.get("overflow") != "hidden":
                errors.append("Page root must clip; vertical scrolling belongs to shell content")
        shells = [n for n in walk(tree) if re.sub(r"[^a-z0-9]", "", n["attrs"].get("data-plasmic-component", "").lower()) in {
            "plasmicoverseasappshell", "plasmicantd6appshell"
        }]
        if len(shells) != 1:
            errors.append("Expected one registered Overseas/Antd-v6 AppShell")
        elif styles(shells[0]).get("height") not in {"100%"} | VIEWPORT_HEIGHTS:
            errors.append("AppShell instance needs explicit height:100% or viewport height; default/auto can grow with content or retain a fixed registration height")

    frames = snapshot.get("frames", [])
    if len(frames) != 1:
        errors.append("Use a component-targeted snapshot with exactly one frame")
    else:
        frame = frames[0]
        if (frame.get("ready") is not True or frame.get("truncated") is not False
                or not finite_number(frame.get("height")) or frame["height"] <= 0):
            errors.append("Snapshot must be ready, complete and have a positive viewport height")
        else:
            elements = frame.get("elements", [])
            layouts = [e for e in elements if "ant-layout-has-sider" in e.get("classes", "").split()]
            sidebars = [e for e in elements if "ant-layout-sider" in e.get("classes", "").split()]
            if len(layouts) != 1 or len(sidebars) != 1:
                errors.append("Expected exactly one rendered AppShell Layout and sidebar")
            else:
                layout = layouts[0]
                position = elements.index(layout)
                # snapshot_layout lists descendants in DOM order; this Layout is
                # the shared AppShell outer div's first rendered child.
                shell = elements[position - 1] if position else None
                if shell is None or "__wab_instance" not in shell.get("classes", "").split():
                    errors.append("Rendered AppShell outer box is unavailable")
                for name, element in [("AppShell", shell), ("Layout", layout), ("sidebar", sidebars[0])]:
                    if element is None:
                        continue
                    top, height = element.get("y"), element.get("height")
                    if not finite_number(top) or not finite_number(height) or height <= 0:
                        errors.append(f"{name} needs finite numeric coordinates and positive height")
                        continue
                    bottom = top + height
                    measurements.append({"region": name, "top": top, "height": element["height"], "bottom": bottom})
                    if abs(top) > 1 or abs(bottom - frame["height"]) > 1:
                        errors.append(f"{name} must reach viewport top/bottom: top={top}, bottom={bottom}, viewport={frame['height']}")
    return {
        "passed": not errors,
        "componentUuid": pages[0]["uuid"] if len(pages) == 1 else None,
        "frameUuid": frames[0].get("frameUuid") if len(frames) == 1 else None,
        "viewportHeight": frames[0].get("height") if len(frames) == 1 else None,
        "measurements": measurements,
        "errors": errors,
        "notChecked": ["live-preview-scrolling", "save-reload-persistence"],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("page_read", type=Path)
    parser.add_argument("layout_snapshot", type=Path)
    args = parser.parse_args()
    result = check(json.loads(args.page_read.read_text()), json.loads(args.layout_snapshot.read_text()))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    raise SystemExit(0 if result["passed"] else 1)


if __name__ == "__main__":
    main()
