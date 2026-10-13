# Desktop MCP minimal examples

Discover current schemas through `get_app_state` first. These are tool argument objects, not raw Studio REST requests. Replace placeholder UUIDs with identities from public model reads.

Call `execute` to identify the session (use the actual model and client):

```json
{"name":"identify","input":{"model":"ACTUAL_MODEL","client":"ACTUAL_CLIENT","skill":"plasmic"}}
```

Call `execute` for a project overview, full components (at most 30 per call), or element subtrees respectively:

```json
{"name":"read","input":{}}
```

```json
{"name":"read","input":{"componentUuids":["uuid-1","uuid-2"]}}
```

```json
{"name":"read","input":{"elements":[{"componentUuid":"page-uuid","elementUuid":"element-uuid"}]}}
```

`components` is an overview output collection, not a read input key. A subtree does not replace the full Page model for state/interaction or full-page gates.

Call `snapshot_layout` directly for each Page without `navigate`:

```json
{"componentUuid":"page-uuid"}
```

This pins a background canvas without changing the active arena/selection. Check frame readiness and truncation. Use [rendered inspection](desktop-inspection.md) for actual Preview interactions.

Call `execute_batch` to update an existing root and shell in one undoable transaction:

```json
{"operations":[
  {"name":"changeElement","input":{"componentUuid":"page-uuid","elementUuid":"root-uuid","styles":{"width":"100%","min-width":"0","height":"100vh","min-height":"0","overflow":"hidden"}}},
  {"name":"changeElement","input":{"componentUuid":"page-uuid","elementUuid":"shell-uuid","styles":{"width":"100%","height":"100%","min-width":"0","min-height":"0"}}}
]}
```

All target IDs must already exist. A failed batch rolls back its model changes; a successful batch remains unsaved. Discover newly created IDs in a separate read before another batch. After checking the actual results and validation, call `execute`:

```json
{"name":"save","input":{}}
```

Successful output has this shape (revision is illustrative):

```json
{"projectId":"project-uuid","revision":42,"saved":true}
```

Record the receipt with project/branch identity; it is not an idempotency key for replaying edits. Save errors must not be reported as success. Reopen/reread and repeat affected checks separately. For collecting gate inputs and running the script suite, use [unified verification](verification.md).
