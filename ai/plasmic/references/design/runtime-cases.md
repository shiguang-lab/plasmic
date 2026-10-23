# Runtime cases

`runtimeCases` is the executable evidence layer. Declaring one case turns on the
per-owner contract: every owner present on the page must supply its required
kinds. A partial list makes the structural gate fail, so plan by owner first,
then write all cases in one pass.

## Required shape

```json
{
  "id": "detail-record-1003",
  "kind": "<action kind from the task inventory>",
  "nodeName": "IdentityInfo",
  "given": {"routeParams": {"id": "<record-id-a>"}},
  "checks": [{"kind": "text", "text": "<record-id-a>", "present": true}],
  "assertPath": "/<collection>/detail/[id]",
  "evidence": {"path": "...", "sha256": "...", "quote": "verbatim source text"}
}
```

- `kind` must match the owner's required kinds (for example an AppShell needs
  `context-navigation`, a Table needs filter/search cases, Tabs need switching).
- `checks` use native Preview assert kinds only: `text`, `visible`, `count`, `value`.
- `evidence.quote` must appear verbatim in the declared file.

## Planning order

1. List every owner on the page that carries a runtime requirement.
2. For each owner, write its required kinds (navigation, filter/search, tabs,
   overlay open/close, row action effects, record resolution, mode readonly).
3. Record pages: two distinct identities must render distinct content; a
   page that declares modes additionally covers each mode and its restricted
   field state.
4. Write all cases, run them, then keep the executed assertion lines.

## Anti-pattern

Adding only the record cases to a page that also owns an AppShell or Table:
`runtimePlan` then reports missing kinds for those owners and the page fails.
