#!/usr/bin/env python3
"""Collect public Desktop readbacks and run the six resource gates.

Online collection uses the Desktop's authenticated local RPC on macOS/Linux.
Offline evidence replay works anywhere Python runs. Never saves or opens projects.
"""
import argparse
from collections import Counter
from datetime import datetime, timezone
import json
from pathlib import Path
import socket
import sys

import verify_descriptions
import verify_forms
import verify_overlays
import verify_shell_height
import verify_slots
import verify_structure


GATES = ("structure", "forms", "descriptions", "overlays", "slots", "shell_height")
NOT_CHECKED = ["source-interpretation", "Preview interactions and scrolling", "save/reopen persistence"]


def read_json(path):
    return json.loads(path.read_text())


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


class Desktop:
    def __init__(self, profile):
        if sys.platform == "win32" or not hasattr(socket, "AF_UNIX"):
            raise ValueError("Live collection requires macOS/Linux; use --evidence for offline replay")
        self.address = read_json(profile / "mcp-connection.json")

    def call(self, method, input=None):
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as connection:
            connection.settimeout(150)
            connection.connect(self.address["socket"])
            connection.sendall((json.dumps({"token": self.address["token"], "method": method,
                                           "input": input or {}}) + "\n").encode())
            with connection.makefile("rb") as stream:
                raw = stream.readline(32 * 1024 * 1024 + 1)
            if len(raw) > 32 * 1024 * 1024:
                raise ValueError("Desktop response too large")
        response = json.loads(raw)
        if "error" in response:
            raise ValueError(response["error"])
        return response["result"]

    def execute(self, name, input=None):
        return self.call("execute", {"name": name, "input": input or {}})


def page_inventory(overview):
    projects = [item for item in overview["results"] if item.get("__type") == "Project"]
    if len(projects) != 1:
        raise ValueError("Exactly one public MCP Project overview required")
    pages = [item for item in projects[0]["components"] if item.get("type") == "page"]
    ids = [page.get("uuid") for page in pages]
    if not ids or not all(ids) or len(ids) != len(set(ids)):
        raise ValueError("Overview requires distinct nonempty Page identities")
    return pages


def context_identity(context):
    return {key: context.get(key) for key in ("projectId", "branchId", "revision", "changeCounter")}


def collect(desktop, project_id, destination):
    state = desktop.call("get_app_state")
    if not state.get("ready") or state.get("projectId") != project_id:
        raise ValueError("Open the requested project in Desktop first; verification never switches or saves projects")
    desktop.execute("identify", {"model": "verification-script", "client": "verify_all", "skill": "plasmic"})
    before = desktop.execute("getEditorContext")
    if before.get("projectId") != project_id:
        raise ValueError("Project changed before collection")
    overview = desktop.execute("read")
    pages = page_inventory(overview)
    readback = {"results": []}
    for offset in range(0, len(pages), 30):
        result = desktop.execute("read", {"componentUuids": [page["uuid"] for page in pages[offset:offset + 30]]})
        readback["results"].extend(result["results"])
    write_json(destination / "overview.json", overview)
    write_json(destination / "pages.json", readback)
    layouts = {}
    for page in pages:
        print(f"Collecting layout: {page.get('pageMeta', {}).get('path', page['uuid'])}", flush=True)
        try:
            layouts[page["uuid"]] = {"snapshot": desktop.call("snapshot_layout", {"componentUuid": page["uuid"]})}
        except (ValueError, OSError) as error:
            layouts[page["uuid"]] = {"error": str(error)}
    write_json(destination / "layouts.json", layouts)
    after = desktop.execute("getEditorContext")
    capture = {"projectId": project_id, "desktopVersion": state.get("version"),
               "collectedAt": datetime.now(timezone.utc).isoformat(), "before": context_identity(before),
               "after": context_identity(after)}
    write_json(destination / "capture.json", capture)
    return capture


def run_suite(config, base, evidence, project_id):
    results = []

    def run(name, action):
        try:
            report = action()
            results.append({"gate": name, "status": "passed" if report["passed"] else "failed", "report": report})
        except Exception as error:
            # A malformed input or checker error must not hide the other gates.
            results.append({"gate": name, "status": "failed", "report": {"errorType": type(error).__name__, "error": str(error)}})

    overview = read_json(evidence / "overview.json")
    readback = read_json(evidence / "pages.json")
    inventory = page_inventory(overview)
    layouts = read_json(evidence / "layouts.json")
    capture = read_json(evidence / "capture.json")

    def evidence_check():
        errors = []
        before, after = capture["before"], capture["after"]
        if capture.get("projectId") != project_id or before.get("projectId") != project_id or after.get("projectId") != project_id:
            errors.append("Evidence project identity differs from requested project")
        if before != after or any(before.get(key) is None for key in ("revision", "changeCounter")):
            errors.append("Project/branch/revision/changeCounter changed or is missing; recollect evidence")
        actual = [model for model in readback["results"] if model.get("type") == "page"]
        if Counter(page["uuid"] for page in inventory) != Counter(page.get("uuid") for page in actual):
            errors.append("Full Page readbacks must cover exactly the overview Page identities")
        if any(not isinstance(page.get("baseVariantTplTree"), str) or not page["baseVariantTplTree"].strip() for page in actual):
            errors.append("Full Page markup required")
        return {"passed": not errors, "errors": errors}

    run("evidence", evidence_check)
    unknown = set(config) - set(GATES)
    if unknown:
        results.append({"gate": "configuration", "status": "failed", "report": {"error": f"Unknown gates: {sorted(unknown)}"}})

    def models_for(specs):
        for spec in verify_forms.resolve_pages(specs, inventory):
            matches = [model for model in readback["results"] if model.get("uuid") == spec["componentUuid"]]
            if len(matches) != 1:
                raise ValueError("Expected one full Page readback")
            yield spec, matches[0]

    def check_gate(name, spec):
        allowed = {"pages"} if name == "slots" else set() if name == "shell_height" else {"inventory"}
        if not isinstance(spec, dict) or set(spec) != allowed:
            raise ValueError(f"{name} requires exactly these configuration keys: {sorted(allowed)}")
        if name in ("structure", "forms", "descriptions", "overlays"):
            expected = read_json(base / spec["inventory"])
            if name == "structure":
                return verify_structure.check(expected, overview, readback)
            if name == "forms":
                return verify_forms.check(expected, overview, readback)
            expected = {**expected, "pages": verify_forms.resolve_pages(expected["pages"], inventory)}
            return {"descriptions": verify_descriptions, "overlays": verify_overlays}[name].check(expected, readback)
        reports = []
        specs = spec.get("pages") if name == "slots" else [{"componentUuid": page["uuid"]} for page in inventory]
        if not specs:
            raise ValueError("Nonempty reviewed Page inventory required")
        for page_spec, model in models_for(specs):
            if name == "slots":
                report = verify_slots.check((base / page_spec["intent"]).read_text(), model["baseVariantTplTree"])
            else:
                layout = layouts.get(model["uuid"], {})
                report = (verify_shell_height.check({"results": [model]}, layout["snapshot"])
                          if "snapshot" in layout else {"passed": False, "errors": [layout.get("error", "Missing layout snapshot")]})
            reports.append({"componentUuid": model["uuid"], "path": model.get("pageMeta", {}).get("path"), **report})
        return {"passed": all(report["passed"] for report in reports), "pages": reports}

    for name in GATES:
        spec = config.get(name)
        if spec is None:
            results.append({"gate": name, "status": "unverified", "report": {"reason": "No reviewed gate configuration supplied"}})
        elif isinstance(spec, dict) and set(spec) == {"notApplicable"} and isinstance(spec["notApplicable"], str) and spec["notApplicable"].strip():
            results.append({"gate": name, "status": "not_applicable", "report": {"reason": spec["notApplicable"]}})
        else:
            run(name, lambda name=name, spec=spec: check_gate(name, spec))
    return {"passed": all(item["status"] in ("passed", "not_applicable") for item in results),
            "scope": "automated gates only", "projectId": project_id, "capture": capture,
            "checks": results, "notChecked": NOT_CHECKED}


def write_report(destination, report):
    write_json(destination / "report.json", report)
    lines = ["# Plasmic automated verification", "",
             f"Automated gates: {'PASS' if report['passed'] else 'FAIL / INCOMPLETE'}", ""]
    if report.get("projectId"):
        lines.extend([f"Project: `{report['projectId']}`", ""])
    if report.get("capture"):
        lines.extend(["## Evidence identity", "", "```json",
                      json.dumps(report["capture"], ensure_ascii=False, indent=2), "```", ""])
    for item in report["checks"]:
        lines.extend([f"## {item['gate']}: {item['status']}", "", "```json",
                      json.dumps(item["report"], ensure_ascii=False, indent=2), "```", ""])
    lines.extend(["## Not checked", "", *[f"- {name}" for name in report["notChecked"]], ""])
    (destination / "report.md").write_text("\n".join(lines))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-id", required=True)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--profile", type=Path, help="Running Desktop user-data directory (macOS/Linux)")
    source.add_argument("--evidence", type=Path, help="Replay a previously collected evidence directory")
    parser.add_argument("--expectations", type=Path, required=True, help="Reviewed suite JSON; paths relative to this file")
    parser.add_argument("--output", type=Path, required=True, help="New output directory; never overwrites a previous run")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=False)
    try:
        config = read_json(args.expectations)
        if not isinstance(config, dict):
            raise ValueError("Suite expectations must be an object keyed by gate name")
        if args.profile:
            collect(Desktop(args.profile), args.project_id, args.output)
        report = run_suite(config, args.expectations.resolve().parent, args.evidence or args.output, args.project_id)
    except Exception as error:
        report = {"passed": False, "projectId": args.project_id, "checks": [{"gate": "collection", "status": "failed", "report": {"errorType": type(error).__name__, "error": str(error)}}],
                  "notChecked": NOT_CHECKED}
    write_report(args.output, report)
    print(json.dumps({"passed": report["passed"], "report": str(args.output / "report.md")}))
    raise SystemExit(0 if report["passed"] else 1)


if __name__ == "__main__":
    main()
