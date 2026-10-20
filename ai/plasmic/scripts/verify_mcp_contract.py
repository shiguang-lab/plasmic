#!/usr/bin/env python3
"""Check declared Desktop capabilities against this resource's read/Preview usage.

Run before prototype mutations. This checks live advertised input contracts,
not implementation behavior, rendering, login recovery or business acceptance.
"""
import argparse
import json
from pathlib import Path


TOOLS = ["read", "queryElements", "preview", "validate"]


def check(state):
    errors = []
    if not state.get("ready") or not state.get("buildId") or not state.get("editorContext", {}).get("sessionId"):
        errors.append("A ready editor with buildId and sessionId is required")
    contracts = state.get("editorTools", {})
    for name in ("read", "queryElements"):
        properties = contracts.get(name, {}).get("inputSchema", {}).get("properties", {})
        if not {"tree", "properties", "contract", "context", "full"}.issubset(properties.get("view", {}).get("enum", [])):
            errors.append(f"{name} must advertise tree/properties/contract/context/full views")
        if properties.get("propNames", {}).get("type") != "array":
            errors.append(f"{name} must advertise propNames projection")
    preview = contracts.get("preview", {}).get("inputSchema", {}).get("properties", {})
    if not {"open", "close"}.issubset(preview.get("action", {}).get("enum", [])) or not {"componentUuid", "width", "height"}.issubset(preview):
        errors.append("Native preview open/close, Page target and viewport contract required")
    validation = contracts.get("validate", {}).get("inputSchema", {}).get("properties", {})
    if validation.get("componentUuids", {}).get("type") != "array":
        errors.append("Native validate with scoped componentUuids required")
    capabilities = state.get("runtimeCapabilities", {})
    required = {
        "preview": {"open", "close", "state", "snapshot", "click", "hover", "fill", "select", "press", "scroll", "screenshot", "assert"},
        "design_reference": {"index", "read", "screenshot"},
        "prototype_task": {"validate_plan", "start", "resume", "revise", "begin_page", "structural_check", "review_visual", "begin_case", "cancel_case", "complete_page", "finish"},
        "reference_browser": {"load_page", "capture", "close"},
        "import_reference": {"editable", "screenshot"},
    }
    for name, actions in required.items():
        if not actions.issubset(capabilities.get(name, [])):
            errors.append(f"Missing runtime capability: {name} {sorted(actions - set(capabilities.get(name, [])))}")
    if "open" in capabilities.get("reference_browser", []):
        errors.append("reference_browser must not advertise source-free open; load_page must validate an explicit external URL before showing the panel")
    return {"passed": not errors, "scope": "advertised native model and runtime capabilities; actual UI behavior is checked per Page",
            "buildId": state.get("buildId"), "projectId": state.get("projectId"),
            "sessionId": state.get("editorContext", {}).get("sessionId"), "errors": errors}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--profile", type=Path, help="Desktop user-data directory")
    source.add_argument("--state", type=Path, help="Replay get_app_state(toolNames:read,queryElements,preview,validate) JSON")
    parser.add_argument("--report", type=Path)
    parser.add_argument("--expectations", type=Path, help="Validate the source-reviewed suite before any business writes (requires --profile)")
    args = parser.parse_args()
    try:
        if args.profile:
            from verify_all import Desktop
            state = Desktop(args.profile).call("get_app_state", {"toolNames": TOOLS})
        else:
            state = json.loads(args.state.read_text(encoding="utf-8"))
        report = check(state)
        if report["passed"] and args.expectations:
            if not args.profile:
                raise ValueError("Plan validation requires --profile")
            try:
                report["plan"] = Desktop(args.profile).call("prototype_task", {"action": "validate_plan", "suitePath": str(args.expectations.resolve())})
            except (OSError, ValueError) as error:
                report.update(passed=False, errors=[str(error)], nextAction="Correct the reviewed inventory at the reported field path before generation; do not weaken expected behavior")
    except (OSError, ValueError, KeyError, TypeError) as error:
        report = {"passed": False, "errors": [str(error)]}
    if not report["passed"] and "nextAction" not in report:
        report["nextAction"] = "Use a Desktop build implementing this resource's contracts before generation; do not guess older parameters or retry writes"
    output = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.report:
        args.report.write_text(output, encoding="utf-8")
    print(output, end="")
    raise SystemExit(0 if report["passed"] else 1)


if __name__ == "__main__":
    main()
