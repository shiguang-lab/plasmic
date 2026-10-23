# Table selection + bulk-action composition

## Generation rules

Applies to actual [Ant Design v6](../index.md) [Table](../components/table.md), [Button](../components/button.md) and the required [Popconfirm](../components/popconfirm.md) or [Modal](../components/modal.md). Read [React UI](../../react_ui/index.md) only when its ActionGroup participates. Do not install another library merely to fit this recipe.

### Selection scope and permissions

Define whether selection means current-page records, retained explicit keys across pages or a verified all-matching operation. The current Table wrapper's selectedRowKeys do not establish a server-wide selection capability. Use stable row keys and the actual selection callbacks; never infer the selected payload from visible row positions. Define reset/preservation on query, scope, permission and dataset changes from the requirement.

Show the applicable selected count and actions in the owning region's toolbar. Apply actual permissions and prerequisites to the selected records before enabling the action. Do not assume a user's permission for one row applies to every selected row, or claim an all-record effect from a checked header. Unsupported selection scope must be reported or implemented through an actual approved contract.

### Confirmation and outcome

Confirmation is present only when required for the actual consequence. Keep the displayed count/objects/effect consistent with the immutable payload snapshot; changed selection invalidates that snapshot. Use a short anchored confirmation for a fitting small effect, or a required Modal for substantial review/input. No mutation happens on menu opening, initial selection or cancel.

One explicit action owns the mutation and duplicate-submit guard. Preserve recoverable selection on failure; reset, retain or remove completed keys according to the actual outcome, including partial success only when the API exposes it. Refresh the owning list separately from the completed write and use one truthful feedback path.

## Acceptance checks

### Acceptance

Exercise zero/one/many selections, changing pages/filters, unauthorized or disabled rows, selection changed after confirmation, cancel, failure/retry and the required success cleanup. Verify exact selected keys, actual request/result and reachable toolbar. Save/reopen bindings and inspect selection behavior independently of a checked-checkbox screenshot.
