#!/usr/bin/env python3
"""Collect public Desktop readbacks and run the six resource gates.

Online collection uses the Desktop's authenticated local RPC on macOS/Linux.
Offline evidence replay works anywhere Python runs. Never saves or opens projects.
"""
import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import re
from pathlib import Path
import shutil
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
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def same_json(first, second):
    """Compare JSON values without Python's bool/number coercion."""
    return json.dumps(first, sort_keys=True, allow_nan=False) == json.dumps(second, sort_keys=True, allow_nan=False)


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
    return {key: context.get(key) for key in ("projectId", "branchId", "sessionId", "revision", "changeCounter")}


EVIDENCE_FILES = ("overview.json", "pages.json", "layouts.json")


def read_capture(directory):
    """Pin the manifest first and parse the exact bytes whose hashes we check."""
    capture = read_json(directory / "capture.json")
    raw = {name: (directory / name).read_bytes() for name in EVIDENCE_FILES}
    hashes = {name: hashlib.sha256(data).hexdigest() for name, data in raw.items()}
    return capture, hashes, *(json.loads(raw[name]) for name in EVIDENCE_FILES)


def evidence_hashes(directory):
    return {name: hashlib.sha256((directory / name).read_bytes()).hexdigest() for name in EVIDENCE_FILES}


def valid_identity(value):
    return (isinstance(value, dict)
            and all(key in value for key in ("projectId", "branchId", "sessionId", "revision", "changeCounter"))
            and all(isinstance(value[key], str) and value[key].strip() for key in ("projectId", "sessionId"))
            and (value["branchId"] is None or isinstance(value["branchId"], str) and bool(value["branchId"].strip()))
            and all(type(value[key]) is int and value[key] >= 0 for key in ("revision", "changeCounter")))


def valid_build(value):
    return (isinstance(value, dict)
            and all(isinstance(value.get(key), str) and re.fullmatch(r"[0-9a-f]{64}", value[key])
                    for key in ("rendererHash", "desktopHash"))
            and ("sourceHash" not in value or isinstance(value["sourceHash"], str)
                 and re.fullmatch(r"[0-9a-f]{64}", value["sourceHash"])))


def valid_timestamp(value):
    try:
        return isinstance(value, str) and datetime.fromisoformat(value.replace("Z", "+00:00")).utcoffset() is not None
    except ValueError:
        return False


def capture_errors(directory, project_id, capture, overview, models, loaded_hashes):
    """Validate reusable raw evidence independently of previous gate outcomes."""
    errors = []
    inventory = page_inventory(overview)
    projects = [item for item in overview["results"] if item.get("__type") == "Project"]
    if projects[0].get("id") != project_id:
        errors.append("Overview Project identity differs from requested project")
    before, after = capture.get("before"), capture.get("after")
    if not valid_identity(before) or not valid_identity(after) or before != after:
        errors.append("Complete stable project/branch/session/revision/changeCounter identity required")
    if (capture.get("projectId") != project_id or not isinstance(before, dict) or not isinstance(after, dict)
            or before.get("projectId") != project_id or after.get("projectId") != project_id):
        errors.append("Evidence project identity differs from requested project")
    if (not isinstance(capture.get("desktopVersion"), str) or not capture["desktopVersion"].strip()
            or not valid_build(capture.get("build"))
            or not valid_timestamp(capture.get("collectedAt"))):
        errors.append("Desktop version, build and collection timestamp required")
    if capture.get("files") != loaded_hashes or loaded_hashes != evidence_hashes(directory):
        errors.append("Complete captured file hashes required; evidence changed or is incomplete")
    if Counter(page["uuid"] for page in inventory) != Counter(page.get("uuid") for page in models):
        errors.append("Full Page readbacks must cover exactly the overview Page identities")
    expected = {page["uuid"]: page.get("pageMeta", {}).get("path") for page in inventory}
    for page in models:
        if (page.get("type") != "page" or page.get("pageMeta", {}).get("path") != expected.get(page.get("uuid"))
                or not isinstance(page.get("baseVariantTplTree"), str) or not page["baseVariantTplTree"].strip()
                or any(not isinstance(page.get(key), list) for key in ("props", "states", "interactions", "variants", "variantGroups"))):
            errors.append("Full Page markup, state, prop, variant and interaction readbacks required")
    return errors


def reusable_evidence(source, state, context):
    """Return the validated manifest for this exact state, or None.

    The caller must pin these hashes while copying rather than reread a manifest
    that may have changed since validation.
    """
    try:
        capture, hashes, overview, readback, layouts = read_capture(source)
        identity = context_identity(context)
        if (not valid_identity(context) or not state.get("version") or not state.get("build")
                or not identity.get("sessionId") or identity.get("revision") is None
                or identity.get("changeCounter") is None
                or capture.get("before") != identity or capture.get("after") != identity
                or capture.get("projectId") != identity["projectId"]
                or capture.get("desktopVersion") != state.get("version")
                or not same_json(capture.get("build"), state.get("build"))
                or capture.get("files") != hashes):
            return None
        pages = page_inventory(overview)
        if capture_errors(source, identity["projectId"], capture, overview, readback["results"], hashes):
            return None
        for page in pages:
            frames = layouts.get(page["uuid"], {}).get("snapshot", {}).get("frames", [])
            if (len(frames) != 1 or frames[0].get("ready") is not True or frames[0].get("truncated") is not False
                    or not verify_shell_height.finite_number(frames[0].get("height"))
                    or frames[0]["height"] <= 0 or not frames[0].get("elements")):
                return None
        return capture
    except (OSError, ValueError, KeyError, TypeError, AttributeError):
        return None


def collect(desktop, project_id, destination, reuse=None):
    state = desktop.call("get_app_state", {"toolNames": []})
    if not state.get("ready") or state.get("projectId") != project_id:
        raise ValueError("Open the requested project in Desktop first; verification never switches or saves projects")
    desktop.execute("identify", {"model": "verification-script", "client": "verify_all", "skill": "plasmic"})
    before = desktop.execute("getEditorContext")
    if before.get("projectId") != project_id:
        raise ValueError("Project changed before collection")
    validated = reusable_evidence(reuse, state, before) if reuse else None
    reused = validated is not None
    if reused:
        for name in ("overview.json", "pages.json"):
            shutil.copyfile(reuse / name, destination / name)
            if hashlib.sha256((destination / name).read_bytes()).hexdigest() != validated["files"][name]:
                raise ValueError("Evidence changed during copy; collect a fresh capture")
        overview = read_json(destination / "overview.json")
        pages = page_inventory(overview)
    else:
        overview = desktop.execute("read")
        pages = page_inventory(overview)
        readback = {"results": []}
        for offset in range(0, len(pages), 30):
            result = desktop.execute("read", {"componentUuids": [page["uuid"] for page in pages[offset:offset + 30]]})
            readback["results"].extend(result["results"])
        write_json(destination / "overview.json", overview)
        write_json(destination / "pages.json", readback)
    # Model identity does not cover runtime rendering (fonts, images, CSS, etc.).
    # Always inspect current layout, even when complete models can be reused.
    layouts = {}
    for page in pages:
        print(f"Collecting layout: {page.get('pageMeta', {}).get('path', page['uuid'])}", flush=True)
        try:
            layouts[page["uuid"]] = {"snapshot": desktop.call("snapshot_layout", {"componentUuid": page["uuid"]})}
        except (ValueError, OSError) as error:
            layouts[page["uuid"]] = {"error": str(error)}
    write_json(destination / "layouts.json", layouts)
    after = desktop.execute("getEditorContext")
    final_state = desktop.call("get_app_state", {"toolNames": []})
    if (not final_state.get("ready") or any(not same_json(state.get(key), final_state.get(key))
                                            for key in ("projectId", "version", "build"))):
        raise ValueError("Desktop changed during collection; collect a fresh capture")
    if reused and context_identity(after) != context_identity(before):
        raise ValueError("Editor changed during evidence reuse; collect a fresh capture")
    capture = {"projectId": project_id, "desktopVersion": state.get("version"), "build": state.get("build"),
               "collectedAt": datetime.now(timezone.utc).isoformat(), "before": context_identity(before),
               "after": context_identity(after), "files": evidence_hashes(destination)}
    if reused:
        capture["reusedFrom"] = str(reuse.resolve())
    write_json(destination / "capture.json", capture)
    return capture


def checked_inputs(config, base):
    files = set(Path(__file__).parent.glob("verify_*.py"))
    for name in GATES:
        spec = config.get(name)
        if not isinstance(spec, dict):
            continue
        if isinstance(spec.get("inventory"), str):
            files.add(base / spec["inventory"])
        if name == "slots" and isinstance(spec.get("pages"), list):
            files.update(base / page["intent"] for page in spec["pages"]
                         if isinstance(page, dict) and isinstance(page.get("intent"), str))
    contents = {path: path.read_bytes() if path.is_file() else None for path in sorted({path.resolve() for path in files})}
    return ({"configurationSha256": hashlib.sha256(json.dumps(config, sort_keys=True).encode()).hexdigest(),
             "files": [{"path": str(path), "sha256": hashlib.sha256(data).hexdigest() if data is not None else None}
                       for path, data in contents.items()]}, contents)


def run_suite(config, base, evidence, project_id):
    results = []
    inputs, contents = checked_inputs(config, base)

    def read_input(path):
        data = contents[path.resolve()]
        if data is None:
            raise FileNotFoundError(path)
        return data

    def run(name, action):
        try:
            report = action()
            results.append({"gate": name, "status": "passed" if report["passed"] else "failed", "report": report})
        except Exception as error:
            # A malformed input or checker error must not hide the other gates.
            results.append({"gate": name, "status": "failed", "report": {"errorType": type(error).__name__, "error": str(error)}})

    capture, hashes, overview, readback, layouts = read_capture(evidence)
    inventory = page_inventory(overview)

    def evidence_check():
        errors = capture_errors(evidence, project_id, capture, overview, readback["results"], hashes)
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
            expected = json.loads(read_input(base / spec["inventory"]))
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
                report = verify_slots.check(read_input(base / page_spec["intent"]).decode("utf-8"), model["baseVariantTplTree"])
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
    current_inputs, _ = checked_inputs(config, base)
    if current_inputs != inputs:
        results[0]["status"] = "failed"
        results[0]["report"].setdefault("errors", []).append("Verifier, inventory or intent changed during checks")
        results[0]["report"]["passed"] = False
    return {"passed": all(item["status"] in ("passed", "not_applicable") for item in results),
            "scope": "automated gates only", "projectId": project_id, "capture": capture,
            "checkedInputs": inputs,
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
    if report.get("checkedInputs"):
        lines.extend(["## Checked inputs", "", "Exact verifier, inventory and intent file hashes are recorded in report.json under checkedInputs.", ""])
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
    parser.add_argument("--reuse-evidence", type=Path, help="With --profile, reuse complete models when session/model/build and hashes match; always refresh layouts")
    parser.add_argument("--expectations", type=Path, required=True, help="Reviewed suite JSON; paths relative to this file")
    parser.add_argument("--output", type=Path, required=True, help="New output directory; never overwrites a previous run")
    args = parser.parse_args()
    if args.reuse_evidence and not args.profile:
        parser.error("--reuse-evidence requires --profile; offline replay uses --evidence")
    args.output.mkdir(parents=True, exist_ok=False)
    try:
        config = read_json(args.expectations)
        if not isinstance(config, dict):
            raise ValueError("Suite expectations must be an object keyed by gate name")
        if args.profile:
            collect(Desktop(args.profile), args.project_id, args.output, args.reuse_evidence)
        report = run_suite(config, args.expectations.resolve().parent, args.evidence or args.output, args.project_id)
    except Exception as error:
        report = {"passed": False, "projectId": args.project_id, "checks": [{"gate": "collection", "status": "failed", "report": {"errorType": type(error).__name__, "error": str(error)}}],
                  "notChecked": NOT_CHECKED}
    write_report(args.output, report)
    print(json.dumps({"passed": report["passed"], "report": str(args.output / "report.md"),
                      "checks": [{"gate": item["gate"], "status": item["status"]} for item in report["checks"]],
                      "notChecked": report["notChecked"]}))
    raise SystemExit(0 if report["passed"] else 1)


if __name__ == "__main__":
    main()
