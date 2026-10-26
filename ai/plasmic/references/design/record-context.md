# Record context

A record action (查看/详情/编辑/编辑条件, row or card) opens a destination that renders **the clicked record**. Navigation alone is not completion: the same Page opened from two different records must show two different subjects.

## Contract

- Declare the destination as a record Page: `recordPage: true`, `routePattern` with one dynamic segment per identity (`/<collection>/detail/[id]`), `params: ["id"]`, and `recordSource` naming where the record comes from.
- The Page `path` is the Plasmic page path itself, with its `[param]` segments (`/<collection>/detail/[id]`), and `routePattern` equals it, so the same Page serves every identity. Concrete Preview URLs such as `/<collection>/detail/<record-id>` appear only in runtime case `assertPath` and `given.routeParams`.
- Declare the action with `kind` and `carries`, where `kind` is the task inventory's own action name (for example a read action, an edit action, or a read-only variant) and `carries` is the identity field; the destination's `params` must include that name. The gate never hardcodes action names.
- The destination resolves the identity from its own route (`$ctx.params.<name>` or the router contract) and renders all dependent fields from it. A fallback first-row/sample record is only acceptable as an explicitly labelled empty state, never as the resolved result.
- Do **not** pass records through globals, `window`, query strings, page state, or a shared store. Those mechanisms look wired in one session and fail after refresh, deep link, back/forward, or a second record.
- Keep the previous Page's identity when returning; back/forward must restore the same record.

## Acceptance

1. Two records of different types/statuses open their own content (headers, key fields, and record-scoped actions differ), including when moving from record A's Page to record B's without a reload; Form fields show B's values.
2. Refresh, deep link (`/<collection>/detail/<record-id>`), back and forward all keep the same record.
3. Unknown identity shows the declared not-found/empty state, not another record's data.
4. A state-changing action on the record updates that record, and returning to the list shows the same row updated.

## Route and mode inventory

Declare these fields per record Page in the page inventory before generation:

```json
{
  "path": "/<collection>/edit/[id]/[mode]",
  "recordPage": true,
  "routePattern": "/<collection>/edit/[id]/[mode]",
  "params": ["id", "mode"],
  "recordSource": "page state groups matched by $ctx.params.id",
  "modes": ["edit", "condition"],
  "readOnlyMode": "condition"
}
```

- `path` equals `routePattern` (the Plasmic page path); every segment placeholder must appear in `params`.
- `modes` is only for Pages that change behavior by action (for example edit versus condition-only edit). A mode Page must contain `[mode]` in `routePattern`, `mode` in `params`, and at least one control bound to `$ctx.params.mode` (for example `Form.disabled`), so the mode is enforced by the Page itself, never by the click handler.
- `readOnlyMode` must be one of `modes`; the read-only mode disables every field outside the editable scope and keeps the editable scope (for example the SQL editor) interactive.
- Actions declare `kind` and `carries`; two actions that only differ by editing scope are distinct kinds whose hrefs differ by the mode segment, never by a flag or global.

## Generation checklist

1. Build the page inventory first: routes, params, modes, record source, per-action kind and destination.
2. Generate each record Page from that inventory; bind every record field to the resolved record, not to a sample constant.
3. Bind the Form's `initialValues` (or Form.Item `initialValue`) to the resolved record; never bind a control `value` directly, because the form store overwrites it. Initial values apply only when the Form mounts: when Preview moves between two records of the same Page without a reload, remount the Form for the new identity through a supported mechanism or call its `setFieldsValue` ref action on the param change, and verify it.
4. After save/reopen, open two records and both modes in Preview and assert the visible differences.
5. Only then report the action as implemented; a route changing is not evidence.

## Detection

- `verify_structure.py → recordContext`: record Pages must declare route params and the action must carry one of them into a declared record Page.
- `verify_runtime.py → record_case_errors`: each record Page needs at least two record cases in its `runtimeCases` (or owner case arrays), with distinct `given.routeParams` and distinct positive destination-text checks (`present:true`). Business names or other record-specific content can prove resolution without displaying raw IDs. Negative-only checks and differently ordered copies of the same positive text cannot prove distinct records; denied/not-found cases remain additional cases. The runtime gate requires the planned assertions executed against their concrete `assertPath`.
- Structure passing alone is not evidence: run the Preview cases and keep the assertion lines.
