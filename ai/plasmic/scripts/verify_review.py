#!/usr/bin/env python3
"""Check that final acceptance actually reviewed every rule on each accept card.

Inputs are the reviewed structure plan, the read_reference.py ledger written while
running `prepare_plan.py rules PLAN --project --stage accept` and every Page's
`prepare_plan.py rules --page ROUTE --stage accept`, and a rule review file:

{"reviewMode": "independent", "reviewer": "child session id",
 "checkedPlanSha256": "<canonical plan digest from review-skeleton>",
 "checkedState": {"projectId": "...", "branchId": null, "sessionId": "...", "revision": 12, "changeCounter": 0},
 "project": {"rules": [
   {"rule": "references/design/layout.md", "sha256": "<current rule digest>", "verdict": "pass", "evidence": ["/abs/task/run/records.webp"]}]},
 "pages": [{"path": "/route", "rules": [
   {"rule": "references/libraries/antd_v6/components/card.md", "verdict": "pass",
    "evidence": ["/abs/task/run/selector.webp", "SqlCard title SQL 编辑 + extra 格式化/校验"],
    "constraints": [{"constraint": "<current hard constraint text>", "verdict": "pass",
                     "evidence": "ListCard is the only surface"}, ...]},
   {"rule": "references/libraries/antd_v6/components/badge.md", "verdict": "notApplicable",
    "reason": "Badge declared for a hidden state branch that this Page does not render"}]}]}

Every accept-card document needs one verdict: pass (nonempty evidence; absolute
paths must exist), notApplicable (a reason) or fail (an unresolved finding, which
fails the gate until repaired and reviewed again). A pass on a document with hard
constraints carries one constraint verdict per constraint, in order, retaining
the exact `constraint` text from review-skeleton.
`reviewMode` is independent (with the reviewer identity) or fallback (with the
reason). `checkedState` binds the review to the saved model the final run captured.
The plan digest and each rule's sha256 bind the verdicts to those reviewed inputs.
This proves the review was recorded against current plan, rule bytes and model state;
it cannot prove the reviewer judged correctly.
"""
import argparse
import hashlib
import json
from pathlib import Path, PureWindowsPath

import rules_manifest
from verify_selection import coverage_errors, load_ledger, pending_pointers, project_reads, read_coverage_errors, required_reads

RULE = "references/review-mode.md#rule-review"
VERDICTS = ("pass", "fail", "notApplicable")
MODES = ("independent", "fallback")
STATE_KEYS = ("projectId", "branchId", "sessionId", "revision", "changeCounter")


def plan_digest(plan):
    """Bind review decisions to the complete plan, independent of JSON formatting."""
    return hashlib.sha256(json.dumps(plan, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode('utf-8')).hexdigest()


def rule_digest(document):
    return hashlib.sha256((rules_manifest.RESOURCE_ROOT / document).read_bytes()).hexdigest()


def evidence_problem(evidence):
    items = [evidence] if isinstance(evidence, str) else evidence
    if not isinstance(items, list) or not items or any(not isinstance(i, str) or not i.strip() for i in items):
        return "A pass verdict needs evidence: screenshot/layout/report paths or the observed model values"
    missing = [i for i in items if (i.startswith("/") or PureWindowsPath(i).is_absolute()) and not Path(i).exists()]
    if missing:
        return f"Evidence files do not exist: {missing}"
    return None


def constraint_errors(document, item, pointer, scope):
    """Check all supplied constraint verdicts, including document exemptions."""
    expected = rules_manifest.hard_constraints((rules_manifest.RESOURCE_ROOT / document).read_text(encoding="utf-8"))
    if "constraints" not in item and (not expected or item.get("verdict") != "pass"):
        return []
    verdicts = item.get("constraints")
    if not isinstance(verdicts, list) or len(verdicts) != len(expected):
        return [{**scope, "check": "ruleReview", "pointer": pointer + "/constraints", "rule": RULE, "constraints": expected,
                 "message": f"Record one verdict per hard constraint of {document} ({len(expected)}), in document order"}]
    errors = []
    for index, (constraint, verdict) in enumerate(zip(expected, verdicts)):
        location = {**scope, "pointer": f"{pointer}/constraints/{index}", "constraint": constraint}
        if not isinstance(verdict, dict) or verdict.get("constraint") != constraint:
            errors.append({**location, "check": "ruleReview", "rule": RULE,
                           "message": "Retain the exact current constraint text in document order from review-skeleton"})
        value = verdict.get("verdict") if isinstance(verdict, dict) else None
        if value == "pass":
            problem = evidence_problem(verdict.get("evidence"))
            if problem:
                errors.append({**location, "check": "ruleReview", "rule": RULE, "message": problem})
        elif value == "notApplicable":
            if not isinstance(verdict.get("reason"), str) or not verdict["reason"].strip():
                errors.append({**location, "check": "ruleReview", "rule": RULE, "message": "notApplicable needs the specific reason"})
        elif value == "fail":
            errors.append({**location, "check": "ruleFinding", "rule": document, "finding": verdict.get("finding"),
                           "message": "Unresolved hard-constraint finding: repair the model, recapture and review again"})
        else:
            errors.append({**location, "check": "ruleReview", "rule": RULE, "allowedValues": list(VERDICTS),
                           "message": "Constraint verdict must be pass, fail or notApplicable"})
    return errors


def verdict_errors(entries, required, scope, base_pointer):
    """Exactly one valid verdict per required rule document."""
    errors, seen = [], {}
    for index, item in enumerate(entries):
        pointer = f"{base_pointer}/rules/{index}"
        document = item.get("rule", "").split("#", 1)[0] if isinstance(item, dict) and isinstance(item.get("rule"), str) else None
        if document is None:
            errors.append({**scope, "check": "ruleReview", "pointer": pointer, "rule": RULE, "message": "Each verdict names its rule document"})
            continue
        seen[document] = seen.get(document, 0) + 1
        if seen[document] > 1:
            errors.append({**scope, "check": "ruleReview", "pointer": pointer, "rule": document,
                           "message": "Record exactly one verdict per rule document"})
        if document not in required:
            errors.append({**scope, "check": "ruleReview", "pointer": pointer, "rule": document,
                           "message": "Rule document is not on this scope's accept card"})
            continue
        if item.get('sha256') != rule_digest(document):
            errors.append({**scope, "check": "reviewedRule", "pointer": pointer + "/sha256", "rule": document,
                           "message": "Rule bytes changed or the review digest is missing; reread and review this rule again"})
        verdict = item.get("verdict")
        if verdict not in VERDICTS:
            errors.append({**scope, "check": "ruleReview", "pointer": pointer, "rule": RULE, "allowedValues": list(VERDICTS),
                           "message": "Verdict must be pass, fail or notApplicable"})
        elif verdict == "fail":
            errors.append({**scope, "check": "ruleFinding", "pointer": pointer, "rule": item["rule"], "finding": item.get("finding"),
                           "message": "Unresolved rule finding: repair the model, recapture and review this rule again"})
        elif verdict == "pass":
            problem = evidence_problem(item.get("evidence"))
            if problem:
                errors.append({**scope, "check": "ruleReview", "pointer": pointer, "rule": RULE, "message": problem})
        elif not isinstance(item.get("reason"), str) or not item["reason"].strip():
            errors.append({**scope, "check": "ruleReview", "pointer": pointer, "rule": RULE, "message": "notApplicable needs the specific reason"})
        errors.extend(constraint_errors(document, item, pointer, scope))
    for document in required:
        if document not in seen:
            errors.append({**scope, "check": "ruleReview", "rule": document, "message": "Accept-card rule has no recorded verdict"})
    return errors


def valid_state(state):
    return (isinstance(state, dict) and all(key in state for key in STATE_KEYS)
            and all(isinstance(state[key], str) and bool(state[key].strip()) for key in ("projectId", "sessionId"))
            and (state["branchId"] is None or isinstance(state["branchId"], str) and bool(state["branchId"].strip()))
            and all(type(state[key]) is int and state[key] >= 0 for key in ("revision", "changeCounter")))


def header_errors(review, capture_state):
    errors = []
    mode = review.get("reviewMode")
    if mode not in MODES:
        errors.append({"check": "reviewMode", "rule": RULE, "allowedValues": list(MODES),
                       "message": "Record the actual review mode: independent (fresh-context reviewer) or fallback (same conversation)"})
    elif mode == "independent" and (not isinstance(review.get("reviewer"), str) or not review["reviewer"].strip()):
        errors.append({"check": "reviewMode", "rule": RULE, "message": "An independent review names the reviewer session/agent identity"})
    elif mode == "fallback" and (not isinstance(review.get("fallbackReason"), str) or not review["fallbackReason"].strip()):
        errors.append({"check": "reviewMode", "rule": RULE, "message": "A fallback review records why independent review was unavailable"})
    state = review.get("checkedState")
    if not valid_state(state) or set(state) != set(STATE_KEYS):
        errors.append({"check": "checkedState", "rule": RULE, "required": list(STATE_KEYS),
                       "message": "Bind the review to the reviewed model: checkedState {projectId, branchId, sessionId, revision, changeCounter}"})
    elif capture_state is not None and not valid_state(capture_state):
        errors.append({"check": "checkedState", "rule": RULE, "message": "Capture needs a valid after identity: projectId, branchId, sessionId and nonnegative integer revision/changeCounter"})
    elif capture_state is not None and any(state.get(k) != capture_state.get(k) for k in STATE_KEYS):
        errors.append({"check": "checkedState", "rule": RULE, "expected": {k: capture_state.get(k) for k in STATE_KEYS}, "actual": state,
                       "message": "The rule review describes another editor/model state; review the captured state again"})
    return errors


def check(pages, ledger, review, capture_state=None, project=True, root=None):
    """`capture_state` is the final capture's after identity; `project` requires the project card;
    `root` is the whole structure plan (navigation decides conditional AppShell rules)."""
    if root is None:
        root = {"pages": pages}
    errors = []
    if not isinstance(review, dict):
        review = {}
    if not pages:
        errors.append({"check": "ruleReview", "rule": RULE,
                       "message": "Review at least one planned Page; the selected scope is empty"})
    for pointer in pending_pointers(review):
        errors.append({"check": "ruleReview", "pointer": pointer, "rule": RULE,
                       "message": "Replace every __DECIDE__ value with the actual review result"})
    errors.extend(header_errors(review, capture_state))
    if review.get('checkedPlanSha256') != plan_digest(root):
        errors.append({"check": "checkedPlan", "rule": RULE,
                       "message": "The reviewed plan changed or its digest is missing; regenerate the skeleton and review the current plan"})
    if project:
        for error in coverage_errors(project_reads("accept", root), ledger):
            errors.append({**error, "scope": "project", "check": "acceptReads",
                           "message": "Run every prepare_plan.py rules PLAN --project --stage accept command with --log before reviewing"})
        entry = review.get("project")
        rules = entry.get("rules") if isinstance(entry, dict) else None
        if not isinstance(rules, list):
            errors.append({"scope": "project", "check": "ruleReview", "rule": RULE, "required": sorted(project_reads("accept", root)),
                           "message": "Record one verdict per project-card rule under project.rules"})
        else:
            errors.extend(verdict_errors(rules, sorted(project_reads("accept", root)), {"scope": "project"}, "/project"))
    entries = {}
    planned_pages = root.get("pages", pages) if isinstance(root, dict) else pages
    known_paths = {p.get("path") for p in planned_pages}
    review_pages = review.get("pages")
    if not isinstance(review_pages, list):
        errors.append({"check": "ruleReview", "pointer": "/pages", "rule": RULE,
                       "message": "Record Page reviews as a list"})
        review_pages = []
    for index, entry in enumerate(review_pages):
        pointer = f"/pages/{index}"
        path = entry.get("path") if isinstance(entry, dict) else None
        if not isinstance(path, str) or path not in known_paths:
            errors.append({"check": "ruleReview", "pointer": pointer, "rule": RULE,
                           "message": "Each Page review names a planned Page path"})
        elif path in entries:
            errors.append({"page": path, "check": "ruleReview", "pointer": pointer, "rule": RULE,
                           "message": "Record exactly one review per Page path"})
        else:
            entries[path] = (entry, pointer)
    for page in pages:
        path = page.get("path")
        for error in read_coverage_errors(page, ledger, "accept", root=root):
            errors.append({"page": path, **error, "check": "acceptReads",
                           "message": "Run every prepare_plan.py rules --stage accept command with --log before reviewing"})
        required = sorted(required_reads(page, "accept", root))
        entry, pointer = entries.get(path, (None, None))
        if entry is None or not isinstance(entry.get("rules"), list):
            errors.append({"page": path, "check": "ruleReview", "rule": RULE,
                           "message": "Record one verdict per accept-card rule for this Page", "required": required})
            continue
        errors.extend(verdict_errors(entry["rules"], required, {"page": path}, pointer))
    return {"passed": not errors, "reviewMode": review.get("reviewMode"), "reviewer": review.get("reviewer"),
            "reviewedPages": [p.get("path") for p in pages], "errors": errors,
            "notChecked": ["correctness of each reviewer judgement", "runtime cases", "save/reopen persistence"]
            + (["binding to a captured saved model (no capture supplied)"] if capture_state is None else [])}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("plan", type=Path)
    parser.add_argument("--ledger", type=Path, required=True)
    parser.add_argument("--review", type=Path, required=True)
    parser.add_argument("--capture", type=Path, help="Final verify_all capture.json; binds checkedState to its after identity")
    parser.add_argument("--page", help="Check one route; omit for every planned Page and the project card")
    args = parser.parse_args()
    plan = json.loads(args.plan.read_text(encoding="utf-8"))
    pages = [p for p in plan.get("pages", []) if args.page is None or p.get("path") == args.page]
    review = json.loads(args.review.read_text(encoding="utf-8"))
    capture = None
    if args.capture:
        document = json.loads(args.capture.read_text(encoding="utf-8"))
        capture = document.get("after") if isinstance(document, dict) else None
        if not valid_state(capture):
            parser.error("--capture requires a valid after identity: projectId, branchId, sessionId and nonnegative integer revision/changeCounter")
    result = check(pages, load_ledger(args.ledger), review, capture, project=args.page is None, root=plan)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    raise SystemExit(0 if result["passed"] else 1)


if __name__ == "__main__":
    main()
