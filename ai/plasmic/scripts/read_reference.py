#!/usr/bin/env python3
"""Read complete Markdown sections without loading unrelated sibling sections."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys


def sections(content):
    lines = content.splitlines(keepends=True)
    headings, counts = [], {}
    fence = None
    for index, line in enumerate(lines):
        marker = re.match(r"^\s*(`{3,}|~{3,})", line)
        if marker:
            value = marker[1]
            if fence is None:
                fence = value
            elif value[0] == fence[0] and len(value) >= len(fence):
                fence = None
            continue
        match = re.match(r"^(#{1,6}) (.+?)\s*$", line) if fence is None else None
        if not match:
            continue
        slug = re.sub(r"[^\w -]", "", match[2].lower()).replace(" ", "-")
        count = counts.get(slug, 0)
        counts[slug] = count + 1
        headings.append({"anchor": slug + (f"-{count}" if count else ""),
                         "level": len(match[1]), "start": index})
    for i, heading in enumerate(headings):
        heading["end"] = next((other["start"] for other in headings[i + 1:]
                               if other["level"] <= heading["level"]), len(lines))
    return lines, headings


def selected_lines(content, anchors=None):
    """Exact emitted line indices, including the preamble and ancestor introductions."""
    lines, headings = sections(content)
    if not anchors:
        return set(range(len(lines)))
    by_anchor = {item["anchor"]: item for item in headings}
    missing = set(anchors) - by_anchor.keys()
    if missing:
        raise ValueError(f"Unknown sections: {sorted(missing)}; use --outline")
    # Always retain the document's title, registration metadata and reading route.
    preamble_end = next((h["start"] for h in headings if h["level"] > 1), len(lines))
    selected = set(range(preamble_end))
    for anchor in anchors:
        section = by_anchor[anchor]
        selected.update(range(section["start"], section["end"]))
        # Nested rules inherit their parent introductions, not unrelated siblings.
        for parent in headings:
            if parent["start"] < section["start"] < parent["end"] and parent["level"] < section["level"]:
                intro_end = next((h["start"] for h in headings if h["start"] > parent["start"]), parent["end"])
                selected.update(range(parent["start"], intro_end))
    return selected


def select(content, anchors):
    selected = selected_lines(content, anchors)
    return "".join(line for i, line in enumerate(content.splitlines(keepends=True)) if i in selected)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("file", type=Path)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--section", action="append", help="Exact heading anchor; repeat for multiple sections")
    mode.add_argument("--outline", action="store_true")
    parser.add_argument("--log", type=Path, help="Append read scope/hash/bytes to a task-local JSONL ledger")
    args = parser.parse_args()
    sys.stdout.reconfigure(encoding="utf-8", newline="\n")
    content = args.file.read_text(encoding="utf-8")
    if args.outline:
        lines, headings = sections(content)
        output = json.dumps([{**{k: v for k, v in h.items() if k in ("anchor", "level")},
                              "bytes": len("".join(lines[h["start"]:h["end"]]).encode())}
                             for h in headings], ensure_ascii=False)
    else:
        output = select(content, args.section) if args.section else content
    record = {"path": args.file.resolve().as_posix(), "sha256": hashlib.sha256(content.encode()).hexdigest(),
              "sections": args.section or [], "outline": args.outline, "bytes": len(output.encode())}
    # A closed/truncated output must never certify a read in the ledger. Flush
    # all reference bytes before recording their successful delivery.
    sys.stdout.write(json.dumps(record, ensure_ascii=False) + "\n" + output + "\n")
    sys.stdout.flush()
    if args.log:
        with args.log.open("a", encoding="utf-8") as file:
            file.write(json.dumps(record, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
