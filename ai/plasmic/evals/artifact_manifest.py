#!/usr/bin/env python3
"""Seal or check a durable evaluation workspace; this never recovers missing evidence."""
import argparse
import hashlib
import json
from pathlib import Path


MANIFEST = "artifact-manifest.json"
EXCLUDED = {"node_modules", ".git", "__pycache__"}


def inventory(root):
    files = {}
    for path in sorted(root.rglob("*")):
        relative = path.relative_to(root)
        if EXCLUDED.intersection(relative.parts) or relative.as_posix() == MANIFEST:
            continue
        if path.is_symlink():
            raise ValueError(f"Snapshot evidence instead of linking external files: {relative}")
        if path.is_file():
            files[relative.as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
    return files


def seal(root):
    files = inventory(root)
    if not files:
        raise ValueError("Cannot seal an empty workspace")
    with (root / MANIFEST).open("x", encoding="utf-8") as stream:
        json.dump({"schemaVersion": 1, "files": files}, stream, indent=2, ensure_ascii=False)
        stream.write("\n")
    return {"passed": True, "files": len(files), "manifest": str(root / MANIFEST)}


def check(root):
    manifest = json.loads((root / MANIFEST).read_text(encoding="utf-8"))
    expected = manifest.get("files")
    if manifest.get("schemaVersion") != 1 or not isinstance(expected, dict) or not expected:
        raise ValueError("Expected a nonempty version-1 artifact manifest")
    actual = inventory(root)
    missing = sorted(set(expected) - set(actual))
    added = sorted(set(actual) - set(expected))
    changed = sorted(name for name in expected.keys() & actual.keys() if expected[name] != actual[name])
    return {"passed": not (missing or added or changed), "missing": missing, "added": added, "changed": changed}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["seal", "check"])
    parser.add_argument("workspace", type=Path)
    args = parser.parse_args()
    try:
        report = (seal if args.action == "seal" else check)(args.workspace.resolve())
    except (OSError, ValueError) as error:
        report = {"passed": False, "error": str(error)}
    print(json.dumps(report, ensure_ascii=False, indent=2))
    raise SystemExit(0 if report["passed"] else 1)


if __name__ == "__main__":
    main()
