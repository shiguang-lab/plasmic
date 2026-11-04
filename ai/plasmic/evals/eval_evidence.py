#!/usr/bin/env python3
"""Prepare immutable evaluation inputs and bind checks/reviews to their exact sources."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil


HERE = Path(__file__).resolve().parent
SEMANTIC_INDICES = {1: [3], 2: [3], 3: [4], 4: [4], 5: [3, 4], 6: [4]}
PRESERVED_CODEGEN_FILES = ("src/orders-service.ts", "src/App.tsx", "package.json", "tsconfig.json")
EXCLUDED = {"node_modules", ".git", "__pycache__"}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def json_digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def tree(root):
    result = {}
    for path in sorted(root.rglob("*")):
        relative = path.relative_to(root)
        if EXCLUDED.intersection(relative.parts):
            continue
        if path.is_symlink():
            raise ValueError(f"Evidence must be snapshotted, not symlinked: {path}")
        if path.is_file():
            result[relative.as_posix()] = digest(path)
    return result


def frozen_codegen(workspace):
    path = workspace / "inputs/codegen-manifest.json"
    manifest = json.loads(path.read_text())
    files = tree(workspace / "inputs/codegen")
    if manifest.get("schemaVersion") != 1 or not files or manifest.get("files") != files:
        raise ValueError("Frozen codegen input is missing or changed")
    if not set(PRESERVED_CODEGEN_FILES) <= files.keys():
        raise ValueError("Original codegen input must contain service, App, package.json and tsconfig.json")
    return files


def freeze_codegen(source, workspace):
    source, workspace = source.resolve(), workspace.resolve()
    if source == workspace or workspace in source.parents or source in workspace.parents:
        raise ValueError("Original input and evaluation workspace must be separate trees")
    if any(workspace.glob("iteration-*")):
        raise ValueError("Freeze original inputs before creating any evaluation iteration")
    files = tree(source)
    if not set(PRESERVED_CODEGEN_FILES) <= files.keys():
        raise ValueError("Original codegen input must contain service, App, package.json and tsconfig.json")
    destination = workspace / "inputs/codegen"
    destination.mkdir(parents=True, exist_ok=False)
    for name in files:
        output = destination / name
        output.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source / name, output)
    if tree(source) != files or tree(destination) != files:
        raise ValueError("Original input changed during freezing; prepare a new workspace")
    with (workspace / "inputs/codegen-manifest.json").open("x") as stream:
        json.dump({"schemaVersion": 1, "source": str(source), "files": files}, stream, indent=2)
    return {"files": len(files), "snapshot": str(destination)}


def init_codegen_run(workspace, run):
    workspace, run = workspace.resolve(), run.resolve()
    relative = run.relative_to(workspace)
    if len(relative.parts) != 4 or relative.parts[:2] != ("iteration-1", "eval-3-incremental-coding") or not relative.parts[-1].startswith("run-"):
        raise ValueError("Expected iteration-1/eval-3-incremental-coding/<variant>/run-N")
    if any((run / name).exists() for name in ("target-project", "codegen-input.json", "outputs", "calls.jsonl", "context-calls.jsonl", "reference-reads.jsonl")):
        raise ValueError("Initialize an unused run before providing it to an executor")
    files = frozen_codegen(workspace)
    receipt = {"manifestSha256": digest(workspace / "inputs/codegen-manifest.json")}
    target = run / "target-project"
    target.mkdir(parents=True, exist_ok=False)
    for name in files:
        output = target / name
        output.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(workspace / "inputs/codegen" / name, output)
    if tree(target) != files or frozen_codegen(workspace) != files or receipt["manifestSha256"] != digest(workspace / "inputs/codegen-manifest.json"):
        raise ValueError("Input changed during run initialization; discard this run")
    with (run / "codegen-input.json").open("x") as stream:
        json.dump(receipt, stream)
    return {"target": str(target), **receipt}


def codegen_inputs(workspace, run):
    files = frozen_codegen(workspace)
    receipt = json.loads((run / "codegen-input.json").read_text())
    if receipt != {"manifestSha256": digest(workspace / "inputs/codegen-manifest.json")}:
        raise ValueError("Run was not initialized from the current frozen original input")
    target = tree(run / "target-project")
    if not target:
        raise ValueError("Missing generated target project")
    inputs = {"inputs/codegen/" + name: value for name, value in files.items()}
    inputs.update({(run / "target-project" / name).relative_to(workspace).as_posix(): value for name, value in target.items()})
    for path in (workspace / "inputs/codegen-manifest.json", workspace / "model-fixtures.json", run / "codegen-input.json", run / "environment.json", run / "calls.jsonl"):
        inputs[path.relative_to(workspace).as_posix()] = digest(path)
    return inputs


def preserved_codegen_files(workspace, run):
    original = frozen_codegen(workspace)
    codegen_inputs(workspace, run)
    return all(digest(run / "target-project" / name) == original[name] for name in PRESERVED_CODEGEN_FILES)


def review_binding(case, workspace, run):
    files = {"model-fixtures.json": digest(workspace / "model-fixtures.json")}
    for name in ("environment.json", "calls.jsonl", "context-calls.jsonl", "reference-reads.jsonl", "official-calls.jsonl", "model-state.json", "codegen-input.json"):
        path = run / name
        files[path.relative_to(workspace).as_posix()] = digest(path) if path.is_file() else None
    for folder in (run / "target-project", run / "verification", workspace / "inputs"):
        files.update({(folder / name).relative_to(workspace).as_posix(): value for name, value in tree(folder).items()})
    sources = {}
    references = run / "reference-reads.jsonl"
    if references.exists():
        for line in references.read_text().splitlines():
            if line.strip():
                source = Path(json.loads(line)["path"])
                sources[str(source)] = digest(source)
    environment = json.loads((run / "environment.json").read_text())
    for key in ("skillPath", "modelFixture"):
        if environment.get(key):
            source = Path(environment[key])
            if source.is_dir():
                source = source / "SKILL.md"
            sources[str(source)] = digest(source)
    return {"caseSha256": json_digest(case), "outputSha256": digest(run / "outputs/result.md"), "files": files, "sources": sources}


def semantic_review(case, workspace, run):
    try:
        review = json.loads((run / "semantic-review.json").read_text())
        if set(review) != {"schemaVersion", "binding", "expectations"} or review["schemaVersion"] != 1 or review["binding"] != review_binding(case, workspace, run):
            return {}, "Missing or stale case/source/output-bound semantic review"
        entries = review["expectations"]
        if not isinstance(entries, list) or len(entries) != len(SEMANTIC_INDICES[case["id"]]):
            return {}, "Semantic review needs exactly the required expectation indices"
        indexed = {}
        for entry in entries:
            if not isinstance(entry, dict) or set(entry) != {"index", "passed", "evidence"} or type(entry["index"]) is not int or type(entry["passed"]) is not bool or not isinstance(entry["evidence"], str) or not entry["evidence"].strip() or entry["index"] in indexed:
                return {}, "Malformed semantic verdict: require unique integer index, boolean passed and nonempty evidence"
            indexed[entry["index"]] = entry
        if set(indexed) != set(SEMANTIC_INDICES[case["id"]]):
            return {}, "Semantic review indices do not match this case"
        return indexed, ""
    except (OSError, ValueError, KeyError, TypeError):
        return {}, "Missing, invalid or stale semantic review sources"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="action", required=True)
    freeze = sub.add_parser("freeze-codegen")
    freeze.add_argument("source", type=Path)
    freeze.add_argument("workspace", type=Path)
    for name in ("init-codegen-run", "codegen-inputs", "review-template"):
        command = sub.add_parser(name)
        command.add_argument("workspace", type=Path)
        command.add_argument("run", type=Path, help="Absolute or workspace-relative run directory")
        if name == "review-template":
            command.add_argument("case", type=int)
    args = parser.parse_args()
    workspace = args.workspace.resolve()
    try:
        if args.action == "freeze-codegen":
            result = freeze_codegen(args.source, workspace)
        else:
            run = args.run.resolve() if args.run.is_absolute() else workspace / args.run
            if args.action == "init-codegen-run":
                result = init_codegen_run(workspace, run)
            elif args.action == "codegen-inputs":
                result = codegen_inputs(workspace, run)
            else:
                case = next(case for case in json.loads((HERE / "evals.json").read_text())["evals"] if case["id"] == args.case)
                result = {"schemaVersion": 1, "binding": review_binding(case, workspace, run), "expectations": [{"index": index, "passed": None, "evidence": ""} for index in SEMANTIC_INDICES[case["id"]]]}
    except (OSError, ValueError, KeyError, StopIteration) as error:
        parser.exit(1, f"{error}\n")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
