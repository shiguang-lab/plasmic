#!/usr/bin/env python3
"""Check Pen frame coverage and semantic mappings against actual Desktop evidence.

Checks recorded layout/image acquisition and model region identities, not visual
fidelity or the correctness of source interpretation/adaptation decisions.
"""
import hashlib
import json
import os
from pathlib import Path
from verify_forms import TextTree, node_name, walk

REQUIRED_FIELDS = {"id", "type", "layout", "width", "height", "padding", "gap", "justifyContent", "alignItems"}


def complete_layout(evidence, node_id):
    read, pages = evidence.get("read", {}), evidence.get("pages", {})
    if (evidence.get("complete") is not True or type(read.get("depth")) is not int or not 1 <= read["depth"] <= 3
            or not REQUIRED_FIELDS.issubset(read.get("fields", [])) or type(read.get("total")) is not int or read["total"] <= 0
            or not isinstance(pages, dict) or not pages):
        return False
    cursor, items = 0, []
    try:
        for offset in sorted(pages, key=int):
            part = pages[offset]
            if str(int(offset)) != str(offset) or int(offset) != cursor or not isinstance(part, list) or not part:
                return False
            items.extend(part)
            cursor += len(part)
        return cursor == read["total"] and any(n.get("id") == node_id and n.get("type") in ("frame", "group") for n in items)
    except (TypeError, ValueError, AttributeError):
        return False


def reference_problems(ref, evidence):
    """Validate the existing retained Pen evidence for one source region."""
    if (not isinstance(ref, dict) or not all(isinstance(ref.get(key), str) and ref[key].strip() for key in ("filePath", "nodeId"))
            or not Path(ref["filePath"]).is_absolute()):
        return ["Reference requires an absolute original filePath and actual nodeId"]
    if not isinstance(evidence, dict):
        return ["Retained reference evidence must be an object"]
    errors = []
    # Pen/Node resolves paths lexically; do not follow /tmp symlinks here.
    file = os.path.abspath(ref["filePath"])
    key = json.dumps([file, ref["nodeId"]], ensure_ascii=False, separators=(",", ":"))
    recorded = evidence.get("references", {}).get(key, {})
    if not isinstance(recorded, dict):
        return ["Complete paginated native Pen layout and original image evidence required"]
    try:
        source_valid = hashlib.sha256(Path(file).read_bytes()).hexdigest() == evidence.get("referenceHashes", {}).get(file)
    except OSError:
        source_valid = False
    if not source_valid:
        errors.append("Original Pen source hash is missing or changed")
    if file not in evidence.get("referenceFiles", []) or not complete_layout(recorded, ref["nodeId"]):
        errors.append("Complete paginated native Pen layout read required; text-only summaries are insufficient")
    image = recorded.get("image", {})
    try:
        valid = (isinstance(image, dict) and image.get("kind") == "reference" and image.get("source", {}).get("provider") == "pen-mcp"
                 and image["source"]["filePath"] == file and image["source"]["nodeId"] == ref["nodeId"]
                 and Path(image["file"]).is_absolute()
                 and hashlib.sha256(Path(image["file"]).read_bytes()).hexdigest() == image.get("sha256"))
    except (OSError, KeyError, TypeError):
        valid = False
    if not valid:
        errors.append("Intact screenshot from the original supplied Pen MCP frame required")
    return errors


def check(expected, readback, evidence):
    errors = []
    models = {model["uuid"]: model for model in readback["results"]}
    for page in expected["pages"]:
        model = models.get(page["componentUuid"])
        refs, regions = page.get("references", []), page.get("regions", [])
        if not model or not refs or not regions or len({ref.get("id") for ref in refs}) != len(refs):
            errors.append({"page": page.get("path"), "error": "Exact Page, distinct reference IDs and semantic regions required"})
            continue
        names = {node_name(n) for n in walk(TextTree(model["baseVariantTplTree"]).root)}
        by_id = {ref["id"]: ref for ref in refs}
        mapped = set()
        for region in regions:
            mapped.add(region.get("referenceId"))
            if (region.get("referenceId") not in by_id or not isinstance(region.get("decision"), str) or not region["decision"].strip()
                    or not region.get("nodeNames") or any(name not in names for name in region["nodeNames"])):
                errors.append({"page": page.get("path"), "region": region, "error": "Reference region must map to actual named native nodes with a reviewed semantic decision"})
        if mapped != set(by_id):
            errors.append({"page": page.get("path"), "error": "Every reference state requires a semantic region mapping"})
        for ref in refs:
            errors.extend({"page": page.get("path"), "referenceId": ref["id"], "error": problem}
                          for problem in reference_problems(ref, evidence))
    return {"passed": not errors, "errors": errors, "notChecked": ["correctness of source interpretation", "visual fidelity and adaptation decisions"]}
