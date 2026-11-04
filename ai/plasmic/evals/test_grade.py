import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from eval_evidence import codegen_inputs, freeze_codegen, init_codegen_run, review_binding, SEMANTIC_INDICES


HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
VERIFIERS = ["ai/plasmic/evals/verify-artifacts.mjs", "ai/plasmic/evals/replay-edits.test.ts", "scripts/prepare-plasmic-evals.mjs"]
CODEGEN_VERIFIERS = ["ai/plasmic/evals/verify-artifacts.mjs", "ai/plasmic/evals/eval_evidence.py", "ai/plasmic/evals/Orders.test.tsx"]
CASES = {case["id"]: case for case in json.loads((HERE / "evals.json").read_text())["evals"]}


def put(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value), encoding="utf-8")


def log(path, values):
    path.write_text("\n".join(json.dumps(value) for value in values), encoding="utf-8")


def hashes(base, names):
    return {name: hashlib.sha256((base / name).read_bytes()).hexdigest() for name in names}


class GradeTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.workspace = Path(self.directory.name) / "workspace"
        self.source = Path(self.directory.name) / "original"
        for name in ("src/orders-service.ts", "src/App.tsx", "package.json", "tsconfig.json", "src/Orders.tsx"):
            put(self.source / name, {"original": name})
        freeze_codegen(self.source, self.workspace)
        put(self.workspace / "model-fixtures.json", {"identities": {"mutating": "page", "editCard": "card", "coding": "orders"}})
        put(self.workspace / "artifact-verification.json", [])

    def review(self, run, case):
        put(run / "semantic-review.json", {"schemaVersion": 1, "binding": review_binding(CASES[case], self.workspace, run), "expectations": [{"index": index, "passed": True, "evidence": "Synthetic grader test only"} for index in SEMANTIC_INDICES[case]]})

    def run_fixture(self, case, name="with_skill", mode=None, padding=24):
        names = {2: "focused-prototype-edit", 3: "incremental-coding", 4: "explicit-official-cli"}
        run = self.workspace / "iteration-1" / f"eval-{case}-{names[case]}" / name / "run-1"
        if case == 3:
            init_codegen_run(self.workspace, run)
        else:
            run.mkdir(parents=True)
        put(run / "environment.json", {"projectId": "project"})
        (run / "outputs").mkdir()
        (run / "outputs/result.md").write_text("版本 2.3.0；Preview 未验证，重开未完成", encoding="utf-8")
        mode = mode or ("codegen" if case in (3, 4) else "prototype")
        resources = self.workspace / "resources"
        required = [str(resources / "references/workflows" / ("codegen.md" if case in (3, 4) else "prototype.md"))]
        log(run / "context-calls.jsonl", [{"status": 0, "args": ["context", "resolve", "--mode", mode], "stdout": json.dumps({"resourceRoot": str(resources), "mustRead": required})}])
        reads = [str(resources / "references" / name) for name in ("guide.md", "official-cli.md")] if case == 4 else required
        for name in reads:
            Path(name).parent.mkdir(parents=True, exist_ok=True)
            Path(name).write_text("Synthetic reference")
        log(run / "reference-reads.jsonl", [{"path": name, "bytes": 1} for name in reads])
        if case == 4:
            log(run / "official-calls.jsonl", [{"args": args} for args in [["--version"], ["info", "--help"], ["info", "--projects", "official-evaluation-project", "--host", "https://plasmic-studio.shiguanglab.com"]]])
        elif case == 3:
            log(run / "calls.jsonl", [{"tool": "execute", "ok": True, "input": {"name": "read", "input": {"componentUuids": ["orders"]}}}])
        else:
            log(run / "calls.jsonl", [{"tool": "execute", "ok": True, "input": {"name": name, "input": arguments}} for name, arguments in [
                ("read", {"componentUuids": ["page"]}),
                ("changeElement", {"componentUuid": "page", "elementUuid": "card", "styles": {"padding": f"{padding}px"}}),
                ("validate", {}), ("save", {}), ("read", {"componentUuids": ["page"]}),
            ]])
        self.review(run, case)
        return run

    def replay_record(self, run, status=0):
        put(run / "verification/replay.json", [])
        (run / "verification/replay.log").write_text("Synthetic checker result", encoding="utf-8")
        relative = lambda path: path.relative_to(self.workspace).as_posix()
        self.review(run, 2)
        return {"id": run.relative_to(self.workspace / "iteration-1").as_posix(), "kind": "editor-replay", "stable": True,
                "inputs": hashes(self.workspace, ["model-fixtures.json", relative(run / "calls.jsonl")]),
                "verifiers": hashes(REPO, VERIFIERS),
                "evidence": hashes(self.workspace, [relative(run / "verification/replay.json"), relative(run / "verification/replay.log")]),
                "checks": [{"status": status}]}

    def codegen_record(self, run):
        for name in ("Orders.test.tsx", "vitest.config.mjs", "behavior.log", "typecheck.log"):
            path = run / "verification" / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("Synthetic verification artifact")
        put(run / "verification/behavior-results.json", {"success": True, "numTotalTests": 3, "numPassedTests": 3, "numFailedTests": 0, "numPendingTests": 0})
        self.review(run, 3)
        evidence = [(run / "verification" / name).relative_to(self.workspace).as_posix() for name in ("Orders.test.tsx", "vitest.config.mjs", "behavior.log", "typecheck.log", "behavior-results.json")]
        return {"id": run.relative_to(self.workspace / "iteration-1").as_posix(), "kind": "codegen", "stable": True,
                "inputs": codegen_inputs(self.workspace, run), "verifiers": hashes(REPO, CODEGEN_VERIFIERS), "evidence": hashes(self.workspace, evidence),
                "checks": [{"kind": "behavior", "status": 0}, {"kind": "typecheck", "status": 0}]}

    def grade(self, run, records=None):
        if records is not None:
            put(self.workspace / "artifact-verification.json", records)
        subprocess.run([sys.executable, str(HERE / "grade.py"), str(self.workspace)], check=True, capture_output=True, text=True)
        return json.loads((run / "grading.json").read_text())

    def test_official_codegen_branch_does_not_require_native_reads(self):
        run = self.run_fixture(4)
        self.assertEqual(self.grade(run)["summary"]["passed"], 5)

    def test_obsolete_official_inspect_route_fails(self):
        run = self.run_fixture(4, mode="inspect")
        self.assertFalse(self.grade(run)["expectations"][0]["passed"])

    def test_official_branch_needs_both_exact_resolved_references(self):
        run = self.run_fixture(4)
        log(run / "reference-reads.jsonl", [{"path": "/other/references/guide.md", "bytes": 1}, {"path": "/resources/references/official-cli.md", "bytes": 1}])
        self.assertFalse(self.grade(run)["expectations"][0]["passed"])

    def test_current_unique_run_evidence_passes(self):
        run = self.run_fixture(2)
        self.assertEqual(self.grade(run, [self.replay_record(run)])["summary"]["passed"], 5)

    def test_changed_padding_trace_cannot_reuse_pass(self):
        run = self.run_fixture(2)
        record = self.replay_record(run)
        calls = run / "calls.jsonl"
        calls.write_text(calls.read_text().replace("24px", "8px"))
        self.assertFalse(self.grade(run, [record])["expectations"][2]["passed"])

    def test_old_global_pass_cannot_grade_current_run(self):
        run = self.run_fixture(2, padding=8)
        self.assertFalse(self.grade(run, [{"id": "real-editor-replay", "checks": [{"status": 0}]}])["expectations"][2]["passed"])

    def test_other_run_failure_does_not_contaminate_passing_run(self):
        good = self.run_fixture(2)
        bad = self.run_fixture(2, "old_skill", padding=8)
        records = [self.replay_record(good), self.replay_record(bad, status=1)]
        self.assertTrue(self.grade(good, records)["expectations"][2]["passed"])
        self.assertFalse(self.grade(bad)["expectations"][2]["passed"])

    def test_missing_duplicate_stale_or_unstable_evidence_fails(self):
        run = self.run_fixture(2)
        good = self.replay_record(run)
        variants = [[], [good, good]]
        for field in ["inputs", "verifiers", "evidence"]:
            stale = copy.deepcopy(good)
            stale[field][next(iter(stale[field]))] = "stale"
            variants.append([stale])
        unstable = copy.deepcopy(good)
        unstable["stable"] = False
        variants.append([unstable])
        empty = copy.deepcopy(good)
        empty["checks"] = []
        variants.append([empty])
        for records in variants:
            with self.subTest(records=records):
                self.assertFalse(self.grade(run, records)["expectations"][2]["passed"])
        (run / "verification/replay.log").unlink()
        self.assertFalse(self.grade(run, [good])["expectations"][2]["passed"])

    def test_codegen_current_evidence_passes_and_changed_source_invalidates_it(self):
        run = self.run_fixture(3)
        record = self.codegen_record(run)
        self.assertEqual(self.grade(run, [record])["summary"]["passed"], 5)
        (run / "target-project/src/Orders.tsx").write_text("export const BROKEN = ;")
        grade = self.grade(run, [record])
        self.assertFalse(grade["expectations"][1]["passed"])
        self.assertFalse(grade["expectations"][3]["passed"])

    def test_codegen_preservation_uses_original_not_baseline_output(self):
        baseline = self.run_fixture(3, "old_skill")
        candidate = self.run_fixture(3)
        (baseline / "target-project/src/orders-service.ts").write_text("unauthorized replacement")
        records = [self.codegen_record(baseline), self.codegen_record(candidate)]
        self.assertFalse(self.grade(baseline, records)["expectations"][2]["passed"])
        self.assertTrue(self.grade(candidate)["expectations"][2]["passed"])

    def test_codegen_requires_nonempty_distinct_successful_commands(self):
        run = self.run_fixture(3)
        record = self.codegen_record(run)
        for checks in ([], [{"kind": "behavior", "status": 0}], [{"kind": "behavior", "status": 0}] * 2,
                       [{"kind": "behavior", "status": 0}, {"kind": "typecheck", "status": False}],
                       [{"kind": "behavior", "status": 0}, {"kind": "typecheck", "status": 1}]):
            with self.subTest(checks=checks):
                altered = {**record, "checks": checks}
                self.assertFalse(self.grade(run, [altered])["expectations"][3]["passed"])

    def test_codegen_requires_exact_current_evidence_and_three_executed_tests(self):
        run = self.run_fixture(3)
        record = self.codegen_record(run)
        for field in ("inputs", "verifiers", "evidence"):
            stale = copy.deepcopy(record)
            stale[field][next(iter(stale[field]))] = "stale"
            self.assertFalse(self.grade(run, [stale])["expectations"][1]["passed"])
        put(run / "verification/behavior-results.json", {"success": True, "numTotalTests": 0, "numPassedTests": 0, "numFailedTests": 0, "numPendingTests": 0})
        record["evidence"] = hashes(self.workspace, list(record["evidence"]))
        self.assertFalse(self.grade(run, [record])["expectations"][1]["passed"])

    def test_codegen_missing_receipt_or_changed_original_fails(self):
        run = self.run_fixture(3)
        record = self.codegen_record(run)
        (run / "codegen-input.json").unlink()
        self.assertFalse(self.grade(run, [record])["expectations"][1]["passed"])
        (self.workspace / "inputs/codegen/src/orders-service.ts").write_text("changed original")
        self.assertFalse(self.grade(run, [record])["expectations"][2]["passed"])

    def test_semantic_verdict_requires_boolean_and_complete_unique_indices(self):
        run = self.run_fixture(4)
        review = json.loads((run / "semantic-review.json").read_text())
        for passed in ("false", "true", 1, 0, None, False):
            changed = copy.deepcopy(review)
            changed["expectations"][0]["passed"] = passed
            put(run / "semantic-review.json", changed)
            self.assertFalse(self.grade(run)["expectations"][4]["passed"], repr(passed))
        for entries in ([], review["expectations"] * 2, [{"index": 9, "passed": True, "evidence": "wrong index"}], [{"index": 4, "passed": True, "evidence": ""}]):
            put(run / "semantic-review.json", {**review, "expectations": entries})
            self.assertFalse(self.grade(run)["expectations"][4]["passed"])
        put(run / "semantic-review.json", review)
        self.assertTrue(self.grade(run)["expectations"][4]["passed"])

    def test_semantic_review_rejects_changed_rubric_source_trace_or_output(self):
        from eval_evidence import semantic_review
        run = self.run_fixture(4)
        changed_case = copy.deepcopy(CASES[4])
        changed_case["expectations"][4] = "Different acceptance condition"
        self.assertFalse(semantic_review(changed_case, self.workspace, run)[0])
        source = self.workspace / "resources/references/official-cli.md"
        for path in (source, run / "official-calls.jsonl", run / "outputs/result.md", self.workspace / "model-fixtures.json"):
            with self.subTest(path=path):
                before = path.read_bytes()
                path.write_bytes(before + b"\nchanged")
                self.assertFalse(semantic_review(CASES[4], self.workspace, run)[0])
                path.write_bytes(before)
        self.assertTrue(semantic_review(CASES[4], self.workspace, run)[0])

    def test_freezing_after_any_iteration_and_reinitializing_run_are_rejected(self):
        run = self.run_fixture(3)
        with self.assertRaisesRegex(ValueError, "before creating any"):
            freeze_codegen(self.source, self.workspace)
        with self.assertRaisesRegex(ValueError, "unused run"):
            init_codegen_run(self.workspace, run)

    def test_freezing_cannot_use_evaluation_output_tree(self):
        with self.assertRaisesRegex(ValueError, "separate trees"):
            freeze_codegen(self.workspace / "inputs/codegen", self.workspace)

    def test_review_template_is_pending_and_not_a_pass(self):
        run = self.run_fixture(4)
        result = subprocess.run([sys.executable, str(HERE / "eval_evidence.py"), "review-template", str(self.workspace), str(run), "4"], check=True, capture_output=True, text=True)
        template = json.loads(result.stdout)
        self.assertIsNone(template["expectations"][0]["passed"])
        put(run / "semantic-review.json", template)
        self.assertFalse(self.grade(run)["expectations"][4]["passed"])


if __name__ == "__main__":
    unittest.main()
