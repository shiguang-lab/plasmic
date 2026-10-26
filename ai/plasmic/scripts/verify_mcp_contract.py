#!/usr/bin/env python3
"""Check declared Desktop capabilities against this resource's read/Preview usage.

Run before prototype mutations. This checks live advertised input contracts,
not implementation behavior, rendering, login recovery or business acceptance.
"""
import argparse
import json
from pathlib import Path


TOOLS = ["read", "queryElements", "validate"]


def check(state, tool_list):
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
    preview_tool = next((tool for tool in tool_list["tools"] if tool["name"] == "preview"), {})
    preview = preview_tool.get("inputSchema", {}).get("properties", {})
    if not {"open", "close"}.issubset(preview.get("action", {}).get("enum", [])) or not {"componentUuid", "width", "height"}.issubset(preview):
        errors.append("MCP tools/list must advertise preview open/close, componentUuid, width and height")
    validation = contracts.get("validate", {}).get("inputSchema", {}).get("properties", {})
    if validation.get("componentUuids", {}).get("type") != "array":
        errors.append("Native validate with scoped componentUuids required")
    capabilities = state.get("runtimeCapabilities", {})
    required = {
        "preview": {"open", "close", "state", "snapshot", "click", "hover", "fill", "select", "press", "scroll", "screenshot", "assert"},
        "design_reference": {"index", "read", "screenshot"},
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
    source.add_argument("--state", type=Path, help="Replay get_app_state(toolNames:read,queryElements,validate) JSON")
    parser.add_argument("--tools", type=Path, required=True, help="MCP tools/list result JSON from the same Desktop build as the state (required with --state or --profile)")
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    try:
        tool_list = json.loads(args.tools.read_text(encoding="utf-8"))
        if args.profile:
            from verify_all import Desktop
            state = Desktop(args.profile).call("get_app_state", {"toolNames": TOOLS})
        else:
            state = json.loads(args.state.read_text(encoding="utf-8"))
        report = check(state, tool_list)
    except (OSError, ValueError, KeyError, TypeError) as error:
        report = {"passed": False, "errors": [str(error)]}
    if not report["passed"] and "nextAction" not in report:
        report["nextAction"] = "Check the reported contract or collection errors against current get_app_state and MCP tools/list results from the same Desktop build; resolve them before generation"
    output = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.report:
        args.report.write_text(output, encoding="utf-8")
    print(output, end="")
    raise SystemExit(0 if report["passed"] else 1)


if __name__ == "__main__":
    main()
