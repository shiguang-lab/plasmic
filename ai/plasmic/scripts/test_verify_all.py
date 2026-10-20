import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from verify_all import GATES, OVERVIEW_FIELDS, collect, run_suite, read_json, write_json, reusable_evidence, evidence_hashes
import test_verify_forms
import test_verify_shell_height


class SuiteTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        shell = test_verify_shell_height.ShellHeightTests()
        shell.setUp()
        form = test_verify_forms.FormCheckTests()
        form.setUp()
        self.model = shell.readback["results"][0]
        self.model.update(uuid="page", name="记录列表", pageMeta={"path": "/records"},
                          props=[], states=[], interactions=[], variants=[], variantGroups=[])
        menu = [{"key": "records", "label": "Records", "href": "/records"}]
        self.model["baseVariantTplTree"] = self.model["baseVariantTplTree"].replace('data-plasmic-component="plasmicOverseasAppShell"',
            'data-plasmic-component="plasmicOverseasAppShell" data-plasmic-name="AppShell" data-props=\'' + json.dumps({"menuItems": menu}) + '\'').replace(
                '</plasmic-component>', '<slot name="children">' + form.html + '</slot></plasmic-component>')
        self.overview = {"results": [{"__type": "Project", "id": "project", "components": [self.model], "devicePresets": [{"name": "Desktop", "width": 1440, "height": 1024}], "pageFrames": [{"componentUuid": "page", "width": 1440, "height": 1024}], "canvases": [{"name": "页面总览", "frames": [{"uuid": "frame", "componentUuid": "page", "x": 0, "y": 0, "width": 1440, "height": 1024}]}]}]}
        self.readback = {"results": [self.model], "read": {"depth": "all", "fields": ["baseVariantTplTree", "props", "states", "variants", "variantGroups", "interactions"]}}
        self.snapshot = shell.snapshot
        self.snapshot["checked"] = ["horizontal-overflow", "table-cell-control-overflow", "image-load"]
        self.snapshot["frames"][0].update(width=1440, read={"view": "full"}, images=[], problems=[])
        self.context = {"projectId": "project", "branchId": None, "sessionId": "editor-session", "revision": 1, "changeCounter": 0}
        self.config = {
            "structure": {"inventory": "structure.json"}, "forms": {"inventory": "forms.json"},
            "descriptions": {"inventory": "descriptions.json"}, "overlays": {"inventory": "overlays.json"},
            "slots": {"pages": [{"path": "/records", "intent": "intent.html"}]}, "shell_height": {},
        }
        write_json(self.root / "overview.json", self.overview)
        write_json(self.root / "pages.json", self.readback)
        write_json(self.root / "layouts.json", {"page": {"snapshot": self.snapshot}})
        self.write_capture()
        write_json(self.root / "structure.json", {"pages": [{"path": "/records", "name": "记录列表", "source": "requirement §Records", "pageHeader": None, "components": [], "copy": {"source": "requirement §Copy review", "excluded": [], "help": []}, "bindings": [], "bindingsNotApplicable": "Static fixture for native Form validation; no external business handlers"}],
                   "navigation": {"items": menu, "source": "requirement §Navigation"}})
        form.expected["pages"][0].pop("componentUuid")
        form.expected["pages"][0]["path"] = "/records"
        write_json(self.root / "forms.json", form.expected)
        for gate, key in [("descriptions", "groups"), ("overlays", "overlays")]:
            write_json(self.root / (gate + ".json"), {"pages": [{"path": "/records", key: []}]})
        (self.root / "intent.html").write_text(self.model["baseVariantTplTree"])

    def write_capture(self):
        self.capture = {"projectId": "project", "desktopVersion": "test", "build": {"rendererHash": "a" * 64, "desktopHash": "b" * 64},
                        "collectedAt": "2026-10-17T00:00:00+00:00", "before": copy.deepcopy(self.context),
                        "after": copy.deepcopy(self.context), "files": evidence_hashes(self.root),
                        "validation": {"componentUuids": ["page"], "result": {"check": "model", "valid": True, "errors": [], "warnings": []}}}
        write_json(self.root / "capture.json", self.capture)

    def run_suite(self):
        return run_suite(self.config, self.root, self.root, "project")

    def test_all_automatic_gates_pass(self):
        report = self.run_suite()
        self.assertTrue(report["passed"], report)
        self.assertEqual(report["acceptance"]["status"], "unverified")

    def test_changing_reviewed_inventory_cannot_pass_using_the_generated_output(self):
        import hashlib
        file = self.root / "structure.json"
        original = file.read_bytes()
        archived = self.root / "reviewed-baseline"
        archived.write_bytes(original)
        digest = hashlib.sha256(original).hexdigest()
        task = {"id": "run", "projectId": "project", "sessionId": self.context["sessionId"],
                "build": self.capture["build"], "pinned": {str(file): digest},
                "baseline": {str(file): {"file": str(archived), "sha256": digest}}}
        raw = json.dumps(task).encode()
        (self.root / "reference-evidence.json").write_bytes(raw)
        self.capture["prototypeTask"] = {"runId": "run", "sha256": hashlib.sha256(raw).hexdigest()}
        write_json(self.root / "capture.json", self.capture)
        changed = json.loads(original)
        changed["pages"][0]["copy"]["source"] = "weakened to match output"
        write_json(file, changed)
        report = self.run_suite()
        self.assertFalse(report["passed"])
        evidence = next(g for g in report["checks"] if g["gate"] == "evidence")
        self.assertIn("Reviewed baseline changed", " ".join(evidence["report"]["errors"]))
        self.assertEqual(report["acceptance"]["status"], "failed")

    def test_native_validation_is_mandatory_exact_and_literal(self):
        original = copy.deepcopy(self.capture)
        for change in (lambda c: c.pop("validation"),
                       lambda c: c["validation"].update(componentUuids=["other"]),
                       lambda c: c["validation"]["result"].update(valid="true"),
                       lambda c: c["validation"]["result"].update(valid=True, errors=["Invalid model"])):
            capture = copy.deepcopy(original)
            change(capture)
            write_json(self.root / "capture.json", capture)
            report = self.run_suite()
            self.assertEqual(next(c["status"] for c in report["checks"] if c["gate"] == "model"), "failed")
        for gate in ("model", "rendering"):
            write_json(self.root / "capture.json", original)
            config = {**self.config, gate: {"notApplicable": "Already reviewed"}}
            self.assertFalse(run_suite(config, self.root, self.root, "project")["passed"])

    def test_full_suite_cannot_bypass_source_presentation_and_component_plan(self):
        original = read_json(self.root / "structure.json")
        for key in ("name", "pageHeader", "components", "copy"):
            expected = copy.deepcopy(original)
            del expected["pages"][0][key]
            write_json(self.root / "structure.json", expected)
            report = self.run_suite()
            self.assertEqual(next(c["status"] for c in report["checks"] if c["gate"] == "structure"), "failed")

    def test_task_evidence_is_loaded_once_and_a_replacement_fails_integrity(self):
        raw = json.dumps({"id": "task", "projectId": "project", "sessionId": "editor-session", "build": self.capture["build"], "referenceFiles": []}).encode()
        file = self.root / "reference-evidence.json"
        file.write_bytes(raw)
        write_json(self.root / "capture.json", {**self.capture, "prototypeTask": {"runId": "task", "sha256": hashlib.sha256(raw).hexdigest()}})
        original = Path.read_bytes
        reads = 0

        def replace_after_load(path, *args, **kwargs):
            nonlocal reads
            data = original(path, *args, **kwargs)
            if path == file:
                reads += 1
                if reads == 1:
                    path.write_bytes(b'{"referenceFiles":["unreviewed.pen"]}')
            return data

        with patch.object(Path, "read_bytes", replace_after_load):
            report = self.run_suite()
        self.assertEqual(reads, 2)  # One pinned read, one final integrity check.
        self.assertEqual(next(c["status"] for c in report["checks"] if c["gate"] == "references"), "not_applicable")
        self.assertEqual(next(c["status"] for c in report["checks"] if c["gate"] == "evidence"), "failed")

    def test_reviewed_directory_names_are_checked_in_the_full_suite(self):
        self.config["page_layout"] = {"overviewName": "记录管理页面总览"}
        self.overview["results"][0]["canvases"][0]["name"] = "记录管理页面总览"
        write_json(self.root / "overview.json", self.overview)
        self.write_capture()
        self.assertTrue(self.run_suite()["passed"])
        self.overview["results"][0]["canvases"][0]["name"] = "Custom arena 1"
        write_json(self.root / "overview.json", self.overview)
        self.write_capture()
        report = self.run_suite()
        self.assertEqual(next(c["status"] for c in report["checks"] if c["gate"] == "page_layout"), "failed")
        self.overview["results"][0]["canvases"][0]["name"] = "记录管理页面总览"
        self.model["name"] = "GroupList"
        write_json(self.root / "overview.json", self.overview)
        write_json(self.root / "pages.json", self.readback)
        self.write_capture()
        report = self.run_suite()
        self.assertEqual(next(c["status"] for c in report["checks"] if c["gate"] == "structure"), "failed")

    def test_slot_and_page_layout_exemptions_cannot_hide_generated_content(self):
        for gate in ("slots", "page_layout"):
            with self.subTest(gate=gate):
                config = copy.deepcopy(self.config)
                config[gate] = {"notApplicable": "Checked through another inventory"}
                report = run_suite(config, self.root, self.root, "project")
                self.assertFalse(report["passed"])
                self.assertEqual(next(c["status"] for c in report["checks"] if c["gate"] == gate), "failed")
        self.assertEqual([check["gate"] for check in report["checks"]], ["evidence", *GATES])
        self.assertIn("save/reopen persistence", report["notChecked"])

    def test_json_uses_utf8_independently_of_system_encoding(self):
        path = self.root / "unicode.json"
        value = {"source": "requirement §记录"}
        original_write, original_read = Path.write_text, Path.read_text

        def write_text(target, data, *args, **kwargs):
            kwargs.setdefault("encoding", "cp1252")
            return original_write(target, data, *args, **kwargs)

        def read_text(target, *args, **kwargs):
            kwargs.setdefault("encoding", "cp1252")
            return original_read(target, *args, **kwargs)

        with patch.object(Path, "write_text", write_text), patch.object(Path, "read_text", read_text):
            write_json(path, value)
            self.assertEqual(json.loads(path.read_bytes()), value)
            self.assertEqual(read_json(path), value)

    def test_independent_failures_are_aggregated(self):
        (self.root / "forms.json").write_text("invalid JSON")
        write_json(self.root / "layouts.json", {"page": {"error": "Editor command timed out: metadata"}})
        self.write_capture()
        report = self.run_suite()
        self.assertFalse(report["passed"])
        self.assertEqual({item["gate"] for item in report["checks"] if item["status"] == "failed"}, {"forms", "shell_height", "rendering"})
        self.assertEqual(len(report["checks"]), 1 + len(GATES))

    def test_full_suite_requires_explicit_page_binding_scope(self):
        original = read_json(self.root / "structure.json")
        for bindings, reason in [(None, None), ({}, None), ([], None), ([], " ")]:
            expected = copy.deepcopy(original)
            expected["pages"][0].pop("bindingsNotApplicable")
            expected["pages"][0]["bindings"] = bindings
            if reason is not None:
                expected["pages"][0]["bindingsNotApplicable"] = reason
            write_json(self.root / "structure.json", expected)
            report = self.run_suite()
            gate = next(check for check in report["checks"] if check["gate"] == "structure")
            self.assertEqual(gate["status"], "failed")
            self.assertIn("source-derived bindings", gate["report"]["error"])

    def test_page_scope_checks_current_page_without_passing_full_project(self):
        sibling = copy.deepcopy(self.model)
        sibling.update(uuid="next", pageMeta={"path": "/next"}, baseVariantTplTree="<div></div>")
        project = self.overview["results"][0]
        project["components"].append(sibling)
        project["pageFrames"].append({"componentUuid": "next", "width": 1440, "height": 1024})
        project["canvases"][0]["frames"].append({"uuid": "next-frame", "componentUuid": "next", "x": 1520, "y": 0, "width": 1440, "height": 1024})
        write_json(self.root / "overview.json", self.overview)
        expected = read_json(self.root / "structure.json")
        expected["pages"].append({"path": "/next", "source": "requirement §Next"})
        write_json(self.root / "structure.json", expected)
        self.write_capture()
        write_json(self.root / "capture.json", {**self.capture, "pagePath": "/records"})
        result = run_suite(self.config, self.root, self.root, "project", "/records")
        self.assertTrue(result["passed"], result)
        self.assertEqual(result["pagePath"], "/records")
        self.assertFalse(self.run_suite()["passed"])
        self.assertIsNone(reusable_evidence(self.root, {"version": "test", "build": self.capture["build"]}, self.context))

    def test_page_scope_still_checks_current_events_and_global_overview(self):
        write_json(self.root / "capture.json", {**self.capture, "pagePath": "/records"})
        expected = read_json(self.root / "structure.json")
        expected["pages"][0].pop("bindingsNotApplicable")
        expected["pages"][0]["bindings"] = [{"nodeName": "AppShell", "source": "requirement §Action", "events": ["onClick"]}]
        write_json(self.root / "structure.json", expected)
        result = run_suite(self.config, self.root, self.root, "project", "/records")
        self.assertEqual(next(c["status"] for c in result["checks"] if c["gate"] == "structure"), "failed")
        with self.assertRaisesRegex(ValueError, "exactly one"):
            run_suite(self.config, self.root, self.root, "project", "/missing")

    def test_declared_bindings_check_real_props_and_events(self):
        expected = read_json(self.root / "structure.json")
        page = expected["pages"][0]
        page.pop("bindingsNotApplicable")
        page["bindings"] = [{"nodeName": "AppShell", "source": "requirement §Navigation", "props": ["menuItems"]}]
        write_json(self.root / "structure.json", expected)
        self.assertTrue(self.run_suite()["passed"])
        page["bindings"][0]["events"] = ["onMenuSelect"]
        write_json(self.root / "structure.json", expected)
        report = self.run_suite()
        self.assertFalse(report["passed"])
        self.assertEqual(next(c for c in report["checks"] if c["gate"] == "structure")["status"], "failed")

    def test_missing_gates_do_not_pass_and_exemptions_require_reason(self):
        del self.config["forms"]
        report = self.run_suite()
        self.assertFalse(report["passed"])
        self.assertEqual(next(item for item in report["checks"] if item["gate"] == "forms")["status"], "unverified")
        self.config["forms"] = {"notApplicable": "No business Forms in this reviewed scope"}
        self.assertFalse(self.run_suite()["passed"])
        self.config["forms"] = {"inventory": "forms.json"}
        self.config["descriptions"] = {"notApplicable": "No Descriptions in this reviewed scope or capture"}
        self.assertFalse(self.run_suite()["passed"])
        self.config["forms"] = {"notApplicable": ""}
        self.assertFalse(self.run_suite()["passed"])

    def test_omitted_implementation_cannot_exempt_source_inventory_gates(self):
        for gate in ("forms", "descriptions", "overlays"):
            config = copy.deepcopy(self.config)
            config[gate] = {"notApplicable": "No component was generated"}
            report = run_suite(config, self.root, self.root, "project")
            self.assertEqual(next(item for item in report["checks"] if item["gate"] == gate)["status"], "failed")

    def test_full_project_slot_and_region_checks_reject_missing_page_coverage(self):
        for gate in ("slots", "descriptions", "overlays"):
            config = copy.deepcopy(self.config)
            if gate == "slots":
                config[gate]["pages"] = []
            else:
                inventory = read_json(self.root / (gate + ".json"))
                inventory["pages"] = []
                write_json(self.root / (gate + ".json"), inventory)
            report = run_suite(config, self.root, self.root, "project")
            self.assertEqual(next(c["status"] for c in report["checks"] if c["gate"] == gate), "failed")

    def test_invalid_gate_input_does_not_abort_remaining_checks(self):
        write_json(self.root / "forms.json", [])
        self.config["shell_height"] = {"pages": []}
        report = self.run_suite()
        self.assertFalse(report["passed"])
        self.assertEqual(len(report["checks"]), 1 + len(GATES))
        failures = {item["gate"]: item for item in report["checks"] if item["status"] == "failed"}
        self.assertIn("errorType", failures["forms"]["report"])
        self.assertIn("shell_height", failures)

    def test_dynamic_menu_is_not_evaluated_or_silently_accepted(self):
        self.model["baseVariantTplTree"] = self.model["baseVariantTplTree"].replace(
            json.dumps({"menuItems": [{"key": "records", "label": "Records", "href": "/records"}]}),
            json.dumps({"menuItems": "{{ $state.menu }}"}))
        write_json(self.root / "pages.json", self.readback)
        self.write_capture()
        report = self.run_suite()
        structure = next(item for item in report["checks"] if item["gate"] == "structure")
        self.assertEqual(structure["status"], "failed")
        self.assertIn("Static menuItems", json.dumps(structure))

    def test_changed_context_and_incomplete_page_reads_fail(self):
        for field, value in [("projectId", "other"), ("branchId", "branch"), ("sessionId", "other"), ("revision", 2), ("changeCounter", 1)]:
            with self.subTest(field=field):
                capture = {**self.capture, "after": {**self.context, field: value}}
                write_json(self.root / "capture.json", capture)
                self.assertFalse(self.run_suite()["passed"])
        self.write_capture()
        write_json(self.root / "pages.json", {"results": [self.model, self.model]})
        self.assertFalse(self.run_suite()["passed"])

    def test_identity_types_cannot_be_bool_or_missing_strings(self):
        for field, value in [('revision', True), ('changeCounter', False), ('revision', -1),
                             ('branchId', 0), ('sessionId', ''), ('revision', '1')]:
            identity = {**self.context, field: value}
            capture = {**self.capture, 'before': identity, 'after': identity}
            write_json(self.root / 'capture.json', capture)
            with self.subTest(field=field, value=value):
                self.assertFalse(self.run_suite()['passed'])

    def test_collection_timestamp_must_be_an_aware_iso_timestamp(self):
        for value in ['garbage', '2026-10-17', '2026-10-17T00:00:00', '2026-99-17T00:00:00+00:00']:
            write_json(self.root / 'capture.json', {**self.capture, 'collectedAt': value})
            with self.subTest(value=value):
                self.assertFalse(self.run_suite()['passed'])

    def test_overview_project_identity_cannot_differ_from_capture(self):
        self.overview['results'][0]['id'] = 'other'
        write_json(self.root / 'overview.json', self.overview)
        self.write_capture()
        report = self.run_suite()
        self.assertFalse(report['passed'])
        self.assertEqual([item['gate'] for item in report['checks'] if item['status'] not in ('passed', 'not_applicable')], ['evidence'])

    def test_manifest_hash_mismatch_is_the_only_failing_gate(self):
        path = self.root / 'pages.json'
        path.write_text(path.read_text() + ' ')
        report = self.run_suite()
        self.assertFalse(report['passed'])
        self.assertEqual([item['gate'] for item in report['checks'] if item['status'] not in ('passed', 'not_applicable')], ['evidence'])

    def test_checked_inventory_and_intent_hashes_bind_the_loaded_bytes(self):
        original = Path.read_bytes
        for filename in ['forms.json', 'intent.html']:
            path = self.root / filename
            before = path.read_bytes()
            changed = False

            def replace_after_read(target, *args, **kwargs):
                nonlocal changed
                data = original(target, *args, **kwargs)
                if target.resolve() == path.resolve() and not changed:
                    changed = True
                    target.write_text('Unreviewed replacement')
                return data

            with self.subTest(file=filename), patch.object(Path, 'read_bytes', replace_after_read):
                report = self.run_suite()
                self.assertTrue(changed)
                self.assertFalse(report['passed'])
                self.assertEqual([item['gate'] for item in report['checks'] if item['status'] not in ('passed', 'not_applicable')], ['evidence'])
                recorded = {item['path']: item['sha256'] for item in report['checkedInputs']['files']}
                self.assertEqual(recorded[str(path.resolve())], hashlib.sha256(before).hexdigest())
            path.write_bytes(before)

    def test_loaded_models_are_bound_to_the_manifest_bytes_during_replay(self):
        original_text, original_bytes = Path.read_text, Path.read_bytes
        changed = False

        def replace_after_read(path, data):
            nonlocal changed
            if path == self.root / 'pages.json' and not changed:
                changed = True
                replacement = copy.deepcopy(self.readback)
                replacement['results'][0]['baseVariantTplTree'] = '<div>Unverified replacement</div>'
                write_json(path, replacement)
                self.write_capture()
            return data

        def read_text(path, *args, **kwargs):
            return replace_after_read(path, original_text(path, *args, **kwargs))

        def read_bytes(path, *args, **kwargs):
            return replace_after_read(path, original_bytes(path, *args, **kwargs))

        with patch.object(Path, 'read_text', read_text), patch.object(Path, 'read_bytes', read_bytes):
            report = self.run_suite()
        self.assertTrue(changed)
        self.assertFalse(report['passed'])
        self.assertEqual([item['gate'] for item in report['checks'] if item['status'] not in ('passed', 'not_applicable')], ['evidence'])

    def test_every_page_height_is_checked(self):
        other = {**self.model, "uuid": "other", "pageMeta": {"path": "/other"}}
        self.overview["results"][0]["components"].append(other)
        self.readback["results"].append(other)
        write_json(self.root / "overview.json", self.overview)
        write_json(self.root / "pages.json", self.readback)
        height = next(item for item in self.run_suite()["checks"] if item["gate"] == "shell_height")
        self.assertEqual(height["status"], "failed")
        self.assertEqual(len(height["report"]["pages"]), 2)

    def test_incomplete_or_tampered_offline_capture_cannot_pass(self):
        original = copy.deepcopy(self.capture)
        for key in ["files", "desktopVersion", "build", "collectedAt"]:
            damaged = copy.deepcopy(original)
            del damaged[key]
            write_json(self.root / "capture.json", damaged)
            self.assertFalse(self.run_suite()["passed"], key)
        for key in ["sessionId", "branchId", "revision", "changeCounter"]:
            damaged = copy.deepcopy(original)
            del damaged["before"][key]
            del damaged["after"][key]
            write_json(self.root / "capture.json", damaged)
            self.assertFalse(self.run_suite()["passed"], key)
        write_json(self.root / "capture.json", original)
        (self.root / "pages.json").write_text(json.dumps(self.readback) + " ")
        self.assertFalse(self.run_suite()["passed"])

    def test_hashed_partial_models_cannot_pass_or_be_reused(self):
        original = copy.deepcopy(self.model)
        state = {"version": "test", "buildId": "fixture-build", "build": {"rendererHash": "a" * 64, "desktopHash": "b" * 64}}
        for field in ["props", "states", "interactions", "variants", "variantGroups"]:
            broken = copy.deepcopy(original)
            del broken[field]
            write_json(self.root / "pages.json", {"results": [broken]})
            self.write_capture()
            self.assertFalse(self.run_suite()["passed"], field)
            self.assertFalse(reusable_evidence(self.root, state, self.context), field)

    def test_checked_inputs_record_current_expectations_and_verifier_source(self):
        first = self.run_suite()["checkedInputs"]
        files = {Path(item["path"]).name: item["sha256"] for item in first["files"]}
        self.assertEqual(files["forms.json"], hashlib.sha256((self.root / "forms.json").read_bytes()).hexdigest())
        self.assertEqual(files["verify_bindings.py"], hashlib.sha256(Path(__file__).with_name("verify_bindings.py").read_bytes()).hexdigest())
        write_json(self.root / "forms.json", {"pages": []})
        second = self.run_suite()
        self.assertFalse(second["passed"])
        self.assertNotEqual(first["files"], second["checkedInputs"]["files"])

    def test_cli_writes_markdown_json_and_preserves_prior_output(self):
        write_json(self.root / "suite.json", self.config)
        output = self.root / "report"
        command = [sys.executable, str(Path(__file__).with_name("verify_all.py")), "--project-id", "project",
                   "--evidence", str(self.root), "--expectations", str(self.root / "suite.json"), "--output", str(output)]
        run = subprocess.run(command, capture_output=True, text=True)
        self.assertEqual(run.returncode, 0, run.stderr + run.stdout)
        self.assertTrue(json.loads((output / "report.json").read_text())["passed"])
        self.assertIn("Not checked", (output / "report.md").read_text())
        before = (output / "report.json").read_bytes()
        self.assertNotEqual(subprocess.run(command, capture_output=True).returncode, 0)
        self.assertEqual(before, (output / "report.json").read_bytes())

    def test_collection_uses_targeted_snapshots_and_never_navigates_or_saves(self):
        calls = []
        fixture = self

        class Desktop:
            def call(self, method, input=None):
                if method == "get_build_info":
                    return {"version": "test", "buildId": "fixture-build", "build": fixture.capture["build"]}
                calls.append((method, input))
                if method == "get_app_state":
                    fixture.assertEqual(input, {"toolNames": []})
                    return {"ready": True, "projectId": "project", "version": "test", "buildId": "fixture-build", "build": {"rendererHash": "a" * 64, "desktopHash": "b" * 64}}
                if method == "snapshot_layout":
                    fixture.assertEqual(input, {"componentUuid": "page", "view": "full"})
                    return fixture.snapshot
                raise AssertionError(method)

            def execute(self, name, input=None):
                calls.append((name, input))
                if name == "validate":
                    fixture.assertEqual(input, {"componentUuids": ["page"]})
                    return {"check": "model", "valid": True, "errors": [], "warnings": []}
                if name == "identify":
                    return {}
                if name == "getEditorContext":
                    return fixture.context
                if name == "read":
                    if not input.get("componentUuids"):
                        fixture.assertEqual(input, {"view": "full", "fields": OVERVIEW_FIELDS})
                        fixture.assertNotIn("importedProjects", input["fields"])
                    return fixture.readback if input and input.get("componentUuids") else fixture.overview
                raise AssertionError(name)

        collect(Desktop(), "project", self.root)
        self.assertEqual([name for name, _ in calls], ["get_app_state", "identify", "getEditorContext", "read", "read", "snapshot_layout", "validate", "getEditorContext", "get_app_state"])
        self.assertIn(("read", {"view": "full", "fields": OVERVIEW_FIELDS}), calls)
        self.assertIn(("read", {"componentUuids": ["page"], "view": "full", "depth": "all"}), calls)
        fixture.readback["read"]["depth"] = 0
        with self.assertRaisesRegex(ValueError, "complete model reads"):
            collect(Desktop(), "project", self.root)
        calls.clear()
        with self.assertRaisesRegex(ValueError, "never switches"):
            collect(Desktop(), "wrong-project", self.root)
        self.assertEqual(len(calls), 1)

    def test_build_provenance_is_explicit_and_must_match_current_status(self):
        calls = []
        fixture = self
        class Desktop:
            def call(self, method, input=None):
                calls.append(method)
                if method == "get_app_state":
                    return {"ready": True, "projectId": "project", "version": "test", "buildId": "current"}
                if method == "get_build_info":
                    return {"version": "test", "buildId": "stale", "build": fixture.capture["build"]}
                raise AssertionError(method)
            def execute(self, name, input=None):
                raise AssertionError("No models may be collected from mismatched builds")
        with self.assertRaisesRegex(ValueError, "Desktop changed"):
            collect(Desktop(), "project", self.root)
        self.assertEqual(calls, ["get_app_state", "get_build_info"])

    def test_live_reuse_requires_exact_session_revision_build_and_intact_complete_evidence(self):
        fixture = self
        calls = []
        self.context["sessionId"] = "editor-session"
        state = {"ready": True, "projectId": "project", "version": "test", "buildId": "fixture-build", "build": {"rendererHash": "a" * 64, "desktopHash": "b" * 64}}

        class Desktop:
            def call(self, method, input=None):
                if method == "get_build_info":
                    return {"version": "test", "buildId": "fixture-build", "build": fixture.capture["build"]}
                calls.append(method)
                return state if method == "get_app_state" else fixture.snapshot

            def execute(self, name, input=None):
                calls.append(name)
                if name == "validate":
                    fixture.assertEqual(input, {"componentUuids": ["page"]})
                    return {"check": "model", "valid": True, "errors": [], "warnings": []}
                if name == "identify":
                    return {}
                if name == "getEditorContext":
                    return fixture.context
                return fixture.readback if input and input.get("componentUuids") else fixture.overview

        desktop = Desktop()
        collect(desktop, "project", self.root)
        self.assertTrue(reusable_evidence(self.root, state, self.context))
        output = self.root / "reused"
        output.mkdir()
        calls.clear()
        collect(desktop, "project", output, self.root)
        self.assertEqual(calls, ["get_app_state", "identify", "getEditorContext", "snapshot_layout", "validate", "getEditorContext", "get_app_state"])
        self.assertTrue(run_suite(self.config, self.root, output, "project")["passed"])
        # Runtime layout can regress without a model/session change. Reuse must
        # still measure it and fail the same shell-height gate as a fresh capture.
        original_snapshot = self.snapshot
        self.snapshot = copy.deepcopy(self.snapshot)
        self.snapshot["frames"][0]["elements"][0]["height"] = 742
        changed = self.root / "changed-layout"
        changed.mkdir()
        calls.clear()
        collect(desktop, "project", changed, self.root)
        self.assertNotIn("read", calls)
        self.assertIn("snapshot_layout", calls)
        report = run_suite(self.config, self.root, changed, "project")
        self.assertEqual(next(item["status"] for item in report["checks"] if item["gate"] == "evidence"), "passed")
        self.assertEqual(next(item["status"] for item in report["checks"] if item["gate"] == "shell_height"), "failed")
        self.snapshot = original_snapshot
        for key, value in [("sessionId", "reopened"), ("revision", 2), ("changeCounter", 1), ("branchId", "other"), ("projectId", "other")]:
            self.assertFalse(reusable_evidence(self.root, state, {**self.context, key: value}), key)
        self.assertFalse(reusable_evidence(self.root, {**state, "build": {"hash": "updated"}}, self.context))
        for key in ("version", "build"):
            incomplete = {**state, key: None}
            capture = json.loads((self.root / "capture.json").read_text())
            write_json(self.root / "capture.json", {**capture, "desktopVersion" if key == "version" else key: None})
            self.assertFalse(reusable_evidence(self.root, incomplete, self.context))
            write_json(self.root / "capture.json", capture)
        # Even a correctly hashed partial capture must be recollected, not cached.
        capture = json.loads((self.root / "capture.json").read_text())
        for frames in [[], [{"ready": False}], [{"ready": True, "truncated": True, "height": 1024}]]:
            write_json(self.root / "layouts.json", {"page": {"snapshot": {"frames": frames}}})
            write_json(self.root / "capture.json", {**capture, "files": evidence_hashes(self.root)})
            self.assertFalse(reusable_evidence(self.root, state, self.context))
        write_json(self.root / "layouts.json", {"page": {"snapshot": self.snapshot}})
        write_json(self.root / "capture.json", capture)
        # A bad expectation must still fail when expensive evidence collection is reused.
        write_json(self.root / "forms.json", {"pages": []})
        self.assertFalse(run_suite(self.config, self.root, output, "project")["passed"])
        (self.root / "pages.json").write_text('{"results": []}')
        self.assertFalse(reusable_evidence(self.root, state, self.context))
        calls.clear()
        fresh = self.root / "fresh"
        fresh.mkdir()
        collect(desktop, "project", fresh, self.root)
        self.assertEqual(calls.count("read"), 2)
        self.assertIn("snapshot_layout", calls)

    def test_reuse_rejects_a_context_change_during_copy(self):
        fixture = self
        self.context["sessionId"] = "session"

        class Desktop:
            contexts = 0

            def call(self, method, input=None):
                if method == "get_build_info":
                    return {"version": "test", "buildId": "fixture-build", "build": fixture.capture["build"]}
                return {"ready": True, "projectId": "project", "version": "test", "buildId": "fixture-build", "build": {"rendererHash": "a" * 64, "desktopHash": "b" * 64}} if method == "get_app_state" else fixture.snapshot

            def execute(self, name, input=None):
                if name == "getEditorContext":
                    self.contexts += 1
                    return {**fixture.context, "changeCounter": 1 if self.contexts == 4 else 0}
                if name == "read":
                    return fixture.readback if input and input.get("componentUuids") else fixture.overview
                return {}

        desktop = Desktop()
        collect(desktop, "project", self.root)
        output = self.root / "reused"
        output.mkdir()
        with self.assertRaisesRegex(ValueError, "changed during evidence reuse"):
            collect(desktop, "project", output, self.root)

    def test_reuse_pins_the_validated_manifest_during_copy(self):
        fixture = self

        class Desktop:
            def call(self, method, input=None):
                if method == "get_build_info":
                    return {"version": "test", "buildId": "fixture-build", "build": fixture.capture["build"]}
                return {"ready": True, "projectId": "project", "version": "test", "buildId": "fixture-build", "build": fixture.capture["build"]} if method == "get_app_state" else fixture.snapshot

            def execute(self, name, input=None):
                if name == "getEditorContext":
                    return fixture.context
                if name == "read":
                    return fixture.readback if input and input.get("componentUuids") else fixture.overview
                return {}

        def replace_after_validation(*args):
            validated = reusable_evidence(*args)
            self.assertTrue(validated)
            changed = copy.deepcopy(self.readback)
            changed["results"][0]["states"] = [{"name": "unvalidated"}]
            write_json(self.root / "pages.json", changed)
            self.write_capture()
            return validated

        output = self.root / "replaced"
        output.mkdir()
        with patch("verify_all.reusable_evidence", side_effect=replace_after_validation):
            with self.assertRaisesRegex(ValueError, "Evidence changed during copy"):
                collect(Desktop(), "project", output, self.root)

    def test_collection_rejects_a_build_change_on_fresh_and_reuse_paths(self):
        fixture = self
        for reuse in [None, self.root]:
            class Desktop:
                statuses = 0

                def call(self, method, input=None):
                    if method == "get_build_info":
                        build = fixture.capture["build"] if self.statuses < 2 else {**fixture.capture["build"], "rendererHash": "f" * 64}
                        return {"version": "test", "buildId": "fixture-build", "build": build}
                    if method != "get_app_state":
                        return fixture.snapshot
                    self.statuses += 1
                    build = fixture.capture["build"] if self.statuses == 1 else {**fixture.capture["build"], "rendererHash": "f" * 64}
                    return {"ready": True, "projectId": "project", "version": "test", "buildId": "fixture-build", "build": build}

                def execute(self, name, input=None):
                    if name == "getEditorContext":
                        return fixture.context
                    if name == "read":
                        return fixture.readback if input and input.get("componentUuids") else fixture.overview
                    return {}

            with self.subTest(reuse=bool(reuse)):
                output = self.root / ("changed-build-reused" if reuse else "changed-build-fresh")
                output.mkdir()
                with self.assertRaisesRegex(ValueError, "Desktop changed during collection"):
                    collect(Desktop(), "project", output, reuse)

    def test_incomplete_build_fingerprint_cannot_pass_or_be_reused(self):
        for build in [{"unrelated": 1}, {"rendererHash": "a" * 64}, {"rendererHash": "invalid", "desktopHash": "b" * 64},
                      {"rendererHash": "a" * 64, "desktopHash": "b" * 64, "sourceHash": None}]:
            with self.subTest(build=build):
                capture = {**self.capture, "build": build}
                write_json(self.root / "capture.json", capture)
                self.assertFalse(self.run_suite()["passed"])
                self.assertFalse(reusable_evidence(self.root, {"version": "test", "buildId": "fixture-build", "build": build}, self.context))

    def test_collection_rejects_other_status_changes_on_fresh_and_reuse_paths(self):
        fixture = self
        for reuse in [None, self.root]:
            for key, value in [('ready', False), ('projectId', 'other'), ('version', 'different')]:
                class Desktop:
                    statuses = 0

                    def call(self, method, input=None):
                        if method == "get_build_info":
                            return {"version": "test", "buildId": "fixture-build", "build": fixture.capture["build"]}
                        if method != 'get_app_state':
                            return fixture.snapshot
                        self.statuses += 1
                        state = dict(ready=True, projectId='project', version='test', buildId='fixture-build', build=fixture.capture['build'])
                        return state if self.statuses == 1 else {**state, key: value}

                    def execute(self, name, input=None):
                        if name == 'getEditorContext':
                            return fixture.context
                        if name == 'read':
                            return fixture.readback if input and input.get("componentUuids") else fixture.overview
                        return {}

                with self.subTest(reuse=bool(reuse), field=key):
                    output = self.root / f'changed-{key}-{bool(reuse)}'
                    output.mkdir()
                    with self.assertRaisesRegex(ValueError, 'Desktop changed during collection'):
                        collect(Desktop(), 'project', output, reuse)

    def test_reuse_rejects_invalid_layout_flags_and_numeric_viewport(self):
        state = {'version': 'test', 'build': self.capture['build']}
        for key, value in [('ready', 1), ('ready', 'true'), ('truncated', 0),
                           ('truncated', None), ('height', True), ('height', float('nan'))]:
            snapshot = copy.deepcopy(self.snapshot)
            snapshot['frames'][0][key] = value
            write_json(self.root / 'layouts.json', {'page': {'snapshot': snapshot}})
            self.write_capture()
            with self.subTest(field=key, value=value):
                self.assertFalse(reusable_evidence(self.root, state, self.context))


if __name__ == "__main__":
    unittest.main()
