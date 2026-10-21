#!/usr/bin/env python3
"""Collect public Desktop readbacks and run the resource gates.

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
import verify_selection
import verify_templates
import verify_page_layout
import verify_references
import verify_rendering


GATES = ("model", "rendering", "structure", "page_layout", "forms", "descriptions", "overlays", "slots", "shell_height", "references")
NOT_CHECKED = ["source-interpretation", "actual template insertion/detachment", "visual fidelity and hierarchy", "Preview interactions and scrolling", "keyboard/focus accessibility", "save/reopen persistence"]


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


def page_inventory(overview, page_path=None):
    projects = [item for item in overview["results"] if item.get("__type") == "Project"]
    if len(projects) != 1:
        raise ValueError("Exactly one public MCP Project overview required")
    pages = [item for item in projects[0]["components"] if item.get("type") == "page"]
    ids = [page.get("uuid") for page in pages]
    if not ids or not all(ids) or len(ids) != len(set(ids)):
        raise ValueError("Overview requires distinct nonempty Page identities")
    if page_path is not None:
        pages = [page for page in pages if page.get("pageMeta", {}).get("path") == page_path]
        if len(pages) != 1:
            raise ValueError("--page requires exactly one existing Page with that exact route")
    return pages


def context_identity(context):
    return {key: context.get(key) for key in ("projectId", "branchId", "sessionId", "revision", "changeCounter")}


EVIDENCE_FILES = ("overview.json", "pages.json", "layouts.json")
OVERVIEW_FIELDS = ["__type", "id", "components", "canvases", "pageFrames", "devicePresets"]


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


def capture_errors(directory, project_id, capture, overview, models, loaded_hashes, page_path=None):
    """Validate reusable raw evidence independently of previous gate outcomes."""
    errors = []
    inventory = page_inventory(overview, page_path)
    if capture.get("pagePath") != page_path:
        errors.append("Evidence scope differs from requested Page/full-project scope")
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
                or "<plasmic-node-ref" in page.get("baseVariantTplTree", "")
                or any(not isinstance(page.get(key), list) for key in ("props", "states", "interactions", "variants", "variantGroups"))):
            errors.append("Full Page markup, state, prop, variant and interaction readbacks required")
    return errors


def reusable_evidence(source, state, context, page_path=None):
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
        pages = page_inventory(overview, page_path)
        if capture_errors(source, identity["projectId"], capture, overview, readback["results"], hashes, page_path):
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


def collect(desktop, project_id, destination, reuse=None, page_path=None):
    state = desktop.call("get_app_state", {"toolNames": []})
    if not state.get("ready") or state.get("projectId") != project_id:
        raise ValueError("Open the requested project in Desktop first; verification never switches or saves projects")
    def with_build(status):
        info = desktop.call("get_build_info")
        if (not status.get("buildId") or info.get("buildId") != status["buildId"]
                or info.get("version") != status.get("version") or not valid_build(info.get("build"))):
            raise ValueError("Desktop changed during collection or build provenance is unavailable")
        return {**status, "build": info["build"]}
    state = with_build(state)
    desktop.execute("identify", {"model": "verification-script", "client": "verify_all", "skill": "plasmic"})
    before = desktop.execute("getEditorContext")
    if before.get("projectId") != project_id:
        raise ValueError("Project changed before collection")
    validated = reusable_evidence(reuse, state, before, page_path) if reuse else None
    reused = validated is not None
    if reused:
        for name in ("overview.json", "pages.json"):
            shutil.copyfile(reuse / name, destination / name)
            if hashlib.sha256((destination / name).read_bytes()).hexdigest() != validated["files"][name]:
                raise ValueError("Evidence changed during copy; collect a fresh capture")
        overview = read_json(destination / "overview.json")
        pages = page_inventory(overview, page_path)
    else:
        overview = desktop.execute("read", {"view": "full", "fields": OVERVIEW_FIELDS})
        pages = page_inventory(overview, page_path)
        readback = {"results": []}
        for offset in range(0, len(pages), 30):
            result = desktop.execute("read", {"componentUuids": [page["uuid"] for page in pages[offset:offset + 30]], "view": "full", "depth": "all"})
            projection = result.get("read", {})
            required = {"baseVariantTplTree", "props", "states", "variants", "variantGroups", "interactions"}
            if projection.get("depth") != "all" or not required.issubset(projection.get("fields", [])):
                raise ValueError("Verification requires explicit complete model reads (view=full, depth=all)")
            readback["results"].extend(result["results"])
        write_json(destination / "overview.json", overview)
        write_json(destination / "pages.json", readback)
    # Model identity does not cover runtime rendering (fonts, images, CSS, etc.).
    # Always inspect current layout, even when complete models can be reused.
    layouts = {}
    for page in pages:
        print(f"Collecting layout: {page.get('pageMeta', {}).get('path', page['uuid'])}", flush=True)
        try:
            layouts[page["uuid"]] = {"snapshot": desktop.call("snapshot_layout", {"componentUuid": page["uuid"], "view": "full"})}
        except (ValueError, OSError) as error:
            layouts[page["uuid"]] = {"error": str(error)}
    write_json(destination / "layouts.json", layouts)
    validation = {"componentUuids": [p["uuid"] for p in pages], "result": desktop.execute("validate", {"componentUuids": [p["uuid"] for p in pages]})}
    after = desktop.execute("getEditorContext")
    final_state = with_build(desktop.call("get_app_state", {"toolNames": []}))
    if (not final_state.get("ready") or any(not same_json(state.get(key), final_state.get(key))
                                            for key in ("projectId", "version", "buildId", "build"))):
        raise ValueError("Desktop changed during collection; collect a fresh capture")
    if reused and context_identity(after) != context_identity(before):
        raise ValueError("Editor changed during evidence reuse; collect a fresh capture")
    capture = {"projectId": project_id, "desktopVersion": state.get("version"), "build": state.get("build"),
               "collectedAt": datetime.now(timezone.utc).isoformat(), "before": context_identity(before),
               "after": context_identity(after), "files": evidence_hashes(destination), "validation": validation}
    if page_path is not None:
        capture["pagePath"] = page_path
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
        if name == "references" and isinstance(spec.get("evidence"), str):
            files.add(base / spec["evidence"])
        if name == "slots" and isinstance(spec.get("pages"), list):
            files.update(base / page["intent"] for page in spec["pages"]
                         if isinstance(page, dict) and isinstance(page.get("intent"), str))
    contents = {path: path.read_bytes() if path.is_file() else None for path in sorted({path.resolve() for path in files})}
    # Pin requirement files and raw template captures referenced by the plan.
    def sources(value):
        if isinstance(value, dict):
            if {'path', 'sha256'}.issubset(value) and isinstance(value.get('path'), str):
                path = Path(value['path'])
                if path.is_absolute():
                    yield path.resolve()
            for child in value.values():
                yield from sources(child)
        elif isinstance(value, list):
            for child in value:
                yield from sources(child)
    structure = config.get('structure', {})
    if isinstance(structure, dict) and isinstance(structure.get('inventory'), str):
        contents[verify_templates.CATALOG.resolve()] = verify_templates.CATALOG.read_bytes()
        data = contents.get((base / structure['inventory']).resolve())
        if data is not None:
            try:
                for path in sources(json.loads(data)):
                    contents[path] = path.read_bytes() if path.is_file() else None
            except (ValueError, OSError):
                pass  # The independent structure gate reports invalid sources.
    contents = dict(sorted(contents.items()))
    return ({"configurationSha256": hashlib.sha256(json.dumps(config, sort_keys=True).encode()).hexdigest(),
             "files": [{"path": str(path), "sha256": hashlib.sha256(data).hexdigest() if data is not None else None}
                       for path, data in contents.items()]}, contents)


def run_suite(config, base, evidence, project_id, page_path=None):
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
            results.append({"gate": name, "status": "passed" if report.get("passed") is True else "failed", "report": report})
        except Exception as error:
            # A malformed input or checker error must not hide the other gates.
            results.append({"gate": name, "status": "failed", "report": {"errorType": type(error).__name__, "error": str(error)}})

    capture, hashes, overview, readback, layouts = read_capture(evidence)
    inventory = page_inventory(overview, page_path)
    all_pages = page_inventory(overview)
    scoped_overview = {"results": [{**item, "components": inventory} if item.get("__type") == "Project" else item for item in overview["results"]]}

    def evidence_check():
        errors = capture_errors(evidence, project_id, capture, overview, readback["results"], hashes, page_path)
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

    def selected_specs(specs):
        resolved = verify_forms.resolve_pages(specs, all_pages)
        return [spec for spec in resolved if page_path is None or spec["componentUuid"] == inventory[0]["uuid"]]

    def check_gate(name, spec):
        if name in ("model", "rendering"):
            if not isinstance(spec, dict) or spec:
                raise ValueError(name + " is mandatory and accepts only {}")
            if name == "rendering":
                return verify_rendering.check(layouts, [p["uuid"] for p in inventory])
            validation = capture.get("validation", {})
            result = validation.get("result", {})
            valid = (Counter(validation.get("componentUuids", [])) == Counter(p["uuid"] for p in inventory)
                     and result.get("check") == "model" and result.get("valid") is True
                     and result.get("errors") == [] and isinstance(result.get("warnings"), list))
            return {"passed": valid, "errors": [] if valid else ["Successful native model validation for the exact scoped Pages required"], "result": result}
        if name == "page_layout":
            if not isinstance(spec, dict) or set(spec) - {"presets", "overviewName"}:
                raise ValueError("page_layout accepts only presets and overviewName; defaults to Desktop and 页面总览")
            return verify_page_layout.check(overview, spec.get("presets"), spec.get("overviewName", "页面总览"))
        allowed = {"pages"} if name == "slots" else set() if name == "shell_height" else {"inventory", "evidence"} if name == "references" else {"inventory"}
        if not isinstance(spec, dict) or set(spec) != allowed:
            raise ValueError(f"{name} requires exactly these configuration keys: {sorted(allowed)}")
        if name in ("structure", "forms", "descriptions", "overlays", "references"):
            expected = json.loads(read_input(base / spec["inventory"]))
            if name == "structure":
                plan_errors = []
                for page in expected.get("pages", []):
                    if page_path is not None and page.get("path") != page_path:
                        continue
                    try:
                        verify_structure.validate_page_plan(page)
                    except ValueError as error:
                        plan_errors.append({"check": "structurePlan", "path": page.get("path"), "message": str(error)})
                    bindings = page.get("bindings")
                    reason = page.get("bindingsNotApplicable")
                    if not isinstance(bindings, list) or (not bindings and (not isinstance(reason, str) or not reason.strip())) or (bindings and reason is not None):
                        plan_errors.append({"check": "structurePlan", "path": page.get("path"), "message": "Source-derived bindings required, or bindings:[] with a reviewed bindingsNotApplicable reason"})
                # Bad inventory metadata must not hide independent selection/coverage findings.
                report = {"passed": False, "errors": plan_errors} if plan_errors else verify_structure.check(expected, overview, readback, page_path)
                report["errors"].extend(verify_structure.check_complete_names(readback))
                selection = verify_selection.check(expected, readback, page_path)
                report["selection"] = selection
                report["errors"].extend(selection["errors"])
                report["passed"] = not report["errors"]
                return report
            expected = {**expected, "pages": selected_specs(expected["pages"])}
            if name == "forms":
                return verify_forms.check(expected, scoped_overview, readback)
            expected = {**expected, "pages": verify_forms.resolve_pages(expected["pages"], inventory)}
            if Counter(p["componentUuid"] for p in expected["pages"]) != Counter(p["uuid"] for p in inventory):
                raise ValueError("Full-project inventories must cover every Page, including explicit empty lists")
            if name == "references":
                reference_evidence = json.loads(read_input(base / spec["evidence"]))
                return verify_references.check(expected, readback, reference_evidence)
            return {"descriptions": verify_descriptions, "overlays": verify_overlays}[name].check(expected, readback)
        reports = []
        specs = selected_specs(spec.get("pages", [])) if name == "slots" else [{"componentUuid": page["uuid"]} for page in inventory]
        if not specs:
            raise ValueError("Nonempty reviewed Page inventory required")
        if name == "slots" and Counter(p["componentUuid"] for p in verify_forms.resolve_pages(specs, inventory)) != Counter(p["uuid"] for p in inventory):
            raise ValueError("Full-project Slot checks must cover every Page")
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
        spec = config.get(name, {} if name in ("model", "rendering", "page_layout") else None)
        if name == "references" and spec is None:
            results.append({"gate": name, "status": "not_applicable", "report": {"reason": "No reference gate configured; source coverage requires independent review"}})
            continue
        if spec is None:
            results.append({"gate": name, "status": "unverified", "report": {"reason": "No reviewed gate configuration supplied"}})
        elif isinstance(spec, dict) and set(spec) == {"notApplicable"} and isinstance(spec["notApplicable"], str) and spec["notApplicable"].strip():
            markup = "\n".join(model.get("baseVariantTplTree", "") for model in readback["results"])
            identities = {verify_forms.identity(node) for node in verify_forms.walk(verify_forms.TextTree(markup).root)}
            applicable = {"forms": {"plasmicantd6form"}, "descriptions": {"plasmicantd6descriptions"},
                          "overlays": {"plasmicantd6modal", "plasmicantd6drawer", "plasmicantd6popconfirm"},
                          "shell_height": {"plasmicoverseasappshell"}}
            # Applicability comes from reviewed source scope, not from an
            # implementation having omitted every required Form/region/overlay.
            # Empty Page inventories are explicit and still checked for extras.
            if name in ("model", "rendering", "structure", "page_layout", "forms", "descriptions", "overlays", "references") or (name == "slots" and "<plasmic-component" in markup) or identities.intersection(applicable.get(name, set())):
                results.append({"gate": name, "status": "failed", "report": {"error": "Gate applies to the captured Pages and cannot be exempted", "reason": spec["notApplicable"]}})
            else:
                results.append({"gate": name, "status": "not_applicable", "report": {"reason": spec["notApplicable"]}})
        else:
            run(name, lambda name=name, spec=spec: check_gate(name, spec))
    current_inputs, _ = checked_inputs(config, base)
    if current_inputs != inputs:
        results[0]["status"] = "failed"
        results[0]["report"].setdefault("errors", []).append("Verifier, inventory or intent changed during checks")
        results[0]["report"]["passed"] = False
    try:
        stable = (evidence_hashes(evidence) == hashes and same_json(read_json(evidence / "capture.json"), capture))
    except (OSError, ValueError):
        stable = False
    if not stable:
        results[0]["status"] = "failed"
        results[0]["report"].setdefault("errors", []).append("Captured model/layout evidence changed during checks")
        results[0]["report"]["passed"] = False
    passed = all(item["status"] in ("passed", "not_applicable") for item in results)
    return {"passed": passed,
            "scope": "automated gates only", "pagePath": page_path, "projectId": project_id, "capture": capture,
            "acceptance": {"status": "unverified" if passed else "failed", "missing": NOT_CHECKED},
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
    (destination / "report.md").write_text("\n".join(lines), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-id", required=True)
    parser.add_argument("--page", help="Verify one exact route before generating the next Page; final acceptance omits this option")
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
            collect(Desktop(args.profile), args.project_id, args.output, args.reuse_evidence, args.page)
        report = run_suite(config, args.expectations.resolve().parent, args.evidence or args.output, args.project_id, args.page)
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
