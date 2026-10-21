# Pen reference evidence

Read when supplied .pen files are part of the source. This is local evidence for read-only verification.

Apply [visual sources and component rules](requirement-alignment.md#visual-sources-and-component-rules) before mapping frames. A supplied draft is not automatically a strict-reproduction specification. Use each region's existing `decision` to record its intended structure and native implementation, including required adaptations; assess visual fidelity against that decision and the applicable component rules.

## Read original Pen references

For supplied .pen files, add references.inventory and references.evidence to the suite. Every Page maps actual source frame IDs and state regions to planned native node names:

```json
{"pages":[{"path":"/records","references":[{"id":"default","filePath":"/absolute/source.pen","nodeId":"ACTUAL_FRAME_ID"}],"regions":[{"referenceId":"default","nodeNames":["RecordsTable"],"decision":"Keep source hierarchy with the registered table"}]}]}
```

Use original absolute files through public Pen MCP/design_reference, never shell/JSON parsing of `.pen`. Read its live schemas and advertised skill; when `read_skill` advertises `path`, use `{"path":"execute.md"}`. design_reference index discovers top-level frames with pagination. Read current-Page frame properties at depth 1 or more, following nextOffset; include id/type/layout/width/height/padding/gap/justifyContent/alignItems. Read relevant descendants for typography/styles and acquire each frame screenshot. Layout text alone does not establish visual fidelity. Map every distinct state; consolidate only genuinely equivalent frames with a source-derived explanation.

Use design_reference's own paging schema: index/read limit is at most 50 and read depth is at most 3; continue with returned nextOffset and discovered child IDs. Native model read and snapshot_layout have separate limits, so their page sizes do not define Pen parameters.

Retain the actual MCP layout responses and source images in the local working directory, with source-file and image hashes. Reuse evidence only while the source identity is unchanged. Native Desktop remains the design device even for narrower references. Inspect image pixels with an image-capable reviewer; delivery of an image block does not prove perception. Without such review leave visual acceptance incomplete. Pen discovery/configuration follows the live design_reference contract.


## Local evidence input

Set `references` to `{"inventory":"reference-inventory.json","evidence":"reference-evidence.json"}` in the suite. The inventory above maps source states to actual model nodes. The evidence file retains the original MCP responses, source hashes and image paths independently of any editor session:

```json
{
  "referenceFiles": ["/absolute/source.pen"],
  "referenceHashes": {"/absolute/source.pen":"SOURCE_SHA256"},
  "references": {
    "[\"/absolute/source.pen\",\"FRAME_ID\"]": {
      "complete": true,
      "read": {"depth":1,"fields":["id","type","layout","width","height","padding","gap","justifyContent","alignItems"],"total":1},
      "pages": {"0":[{"id":"FRAME_ID","type":"frame"}]},
      "image": {
        "kind":"reference",
        "source":{"provider":"pen-mcp","filePath":"/absolute/source.pen","nodeId":"FRAME_ID"},
        "file":"/absolute/evidence/reference.webp",
        "sha256":"IMAGE_SHA256"
      }
    }
  }
}
```

Replace example values with the exact retained `design_reference` output. `pages` keys are contiguous response offsets and values are the complete returned item arrays; `read.total` must agree. Include all required layout fields and relevant descendants, not just the two identity fields illustrated above. The `references` key is the compact JSON array `[absolute filePath,nodeId]`; use lexical absolute source paths consistently. Compute SHA-256 from the original source/image bytes; hashing does not parse the Pen design. Image paths are absolute local files, not client profile internals. The verifier checks source/image hashes, complete layout coverage and named model mappings. It cannot establish that the agent actually perceived an image or interpreted the requirement correctly; independent trace and visual review remain required.
