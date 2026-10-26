# Action-bar composition

**Hard constraints** (always delivered with any section):

- Actions in one group are 8px apart (Space size 8), including Modal and Drawer footers; same control size within a group.
- A right-aligned bar or footer orders cancel/back, secondary actions, then the one primary completion action last; inline form actions put submit before cancel, aligned with the controls through a label-less Form.Item.
- A page completion bar is its own white surface with `16px 20px` padding, the same horizontal inset as the Cards above it, and at most one short prerequisite sentence at its left.
- Order and position stay stable across enabled, disabled, loading and result states; one current primary action per region.

## Generation rules

Applies to [Ant Design v6](../index.md) actions/feedback. [Overseas](../../overseas/index.md) participates when SearchForm actions are present; [React UI](../../react_ui/index.md) participates when ActionGroup is used. Read only the actual participants after [library selection](../../index.md).

### Buttons and action bars

Use [Ant Design button guidance](https://ant.design/docs/spec/buttons), the [Button contract](https://ant.design/components/button/) and native [Modal defaults](https://ant.design/components/modal/) as component references. [Atlassian panel footers](https://atlassian.design/components/panel/usage) also place the secondary action before the primary action. The placement table below defines this project's LTR admin convention by context; it is not a universal ordering rule for every platform or toolbar. Explicit user-approved layouts and the target component's verified contract take precedence. Preserve the business page language and actual registered Props/Slots.

#### Placement and ordering

| Context | Placement and order |
| --- | --- |
| Routine Modal confirm/cancel pair | Follow [overlay footer selection](modal-drawer.md#footer-with-only-an-exit-button) and the [Modal footer contract](../components/modal.md#footer). Native cancel is on the left, confirmation on the right. |
| Drawer footer or page-level completion bar | Right-align the action group: cancel/back, secondary business actions, primary completion action. Cancel is first within the group, not necessarily at the far left of the whole bar. Keep concise status/prerequisite text at the bar's left when needed. |
| Inline form actions | Align with the form's control/content column and retain the native or approved form pattern, commonly submit followed by cancel. Do not apply the right-aligned footer rule automatically. Follow Antd's pattern: put the action Space in a Form.Item without `name`, whose label Slot holds one space and `colon:false`, so the shared labelCol aligns it with the controls. With a span `labelCol`, `noLabel` with `alignLabellessWithControls` is equivalent. Never offset the actions with margins. |
| List/business toolbar or page-header actions | Follow the owning region: [query/list composition](../../overseas/compositions/search-table.md#query-and-list-structure) places shared tabbed-list actions in Tabs extra and defines separate toolbar alignment; requested headers use their action area. Order by importance and usage, commonly primary business action before secondary actions. These groups do not acquire a cancel button unless a cancellable task exists. |
| SearchForm query/reset controls | Preserve the registered action-column contract and query/reset order; reset applies the SearchForm's initial/clear values and updates the query. It does not mean cancel. See [reset semantics](../../overseas/components/search-form.md#layout-and-state). |
| Multi-step flow | Previous/back precedes next/finish. Intermediate actions follow the actual step dependencies; do not add a second completion action with the same effect. |
| Table row actions | Use [ActionGroup](../../react_ui/components/action-group.md) ordering, folding and permission rules; do not turn every row into a primary-button group. |

Order secondary workflow actions by their real dependencies where applicable, with the terminal completion action last in a right-aligned footer. Keep positions stable across enabled, disabled, loading and result states; do not reorder buttons or promote cancel just because another action is disabled. A primary emphasis change is appropriate only for a requirement-defined workflow phase, not whichever action happens to be available.

Compose a page-level completion bar as its own white surface: a card-like bar with `16px 20px` padding (the Cards' 20px horizontal inset, so the right-aligned actions line up with the content edges above), the action group right-aligned inside a Space (or a flex group with the same 8px gap when Space is not registered), and at most one short prerequisite sentence at the left. Do not attach the buttons flush to the previous card's edge or let the bar inherit a grey page background. Keep the hint to a current prerequisite (`预跑成功后可保存 SQL`), never a process narrative (`提交后自动预跑，预跑成功后可保存 SQL / 上线`).

Keep ordinary actions in one row with the 8px inline gap; Drawer and Modal footers use the same 8px gap. Use the same control size and native theme treatment within a group, with natural label widths. Separate unrelated/destructive actions from completion actions by a distinct group/space; do not add a divider between every button. Fold low-frequency secondary actions when needed, but keep the current primary action and the task's cancel/back entry directly reachable. Keep native Modal/Drawer footer ownership. Only make a page bar sticky/fixed when the task needs it; reserve content space so it cannot cover the last field, validation error or pagination, and do not add a second scroll owner.

Read [Button](../components/button.md) for types, labels, htmlType and submission semantics.



#### Availability and acceptance

Derive visibility, enabled state and loading from the requirement's permissions, prerequisites and active operation. Follow existing permission filtering before folding. Explain unavailable prerequisites beside the affected region/bar in readable text; do not rely solely on a Tooltip attached to a disabled button. Invalid form fields normally use the native submit-and-show-validation path; do not disable submit solely to avoid displaying validation errors unless the requirement specifies that behavior.

During processing show loading on the initiating action, use the consuming flow's single submission guard and prevent conflicting operations. Keep safe cancellation/navigation available where supported; if closing is unsafe, apply the same restriction to cancel, X, Esc and mask according to the flow. Failure retains recoverable input and exposes the actual retry action. When later actions depend on a successful check, bind that success to the checked input/version and invalidate it after relevant edits; stale success must not unlock completion.

Before generation/editing, record each affected action group's context, ordered labels, actual effects, intended types, primary action, permission/prerequisite rules and required states in the task's acceptance matrix. Read back the real Button/Modal/Drawer/ActionGroup props and handlers, including native footer ownership and any `type`/`color`/`variant` precedence in the installed contract. In Preview check available, prerequisite-blocked, processing, failure and success states where applicable: enabled hierarchy, stable order, matching labels/effects, validation, single submission and safe cancel/close behavior. Verify keyboard focus/activation, supported Enter submission and long-label/footer reachability at the target viewport; then save/reopen and reread the affected groups. Record unexecuted cases as unverified. A screenshot of disabled buttons or a correct DOM order alone does not pass this acceptance.

#### Feedback and row confirmation

Read [Ant Design System Settings action calls](../components/config-provider.md#feedback-action-calls) for themed feedback wiring and [ActionGroup](../../react_ui/components/action-group.md) for row confirmation callbacks. Verify the Message first appears after the action, then dismisses; a later absence assertion alone cannot establish success. Do not suppress a missing-action error or replace an available Message action with a custom Toast.

Choose feedback from its purpose and the requirement. Copy, ordinary save, delete and status-change completion use a short Ant Design Message/toast; they must not insert a persistent page-top success Alert or change the list geometry. Use inline field errors for validation. Alert belongs to persistent contextual information, actionable failures or a result that the user must inspect. Notification is for longer asynchronous or cross-page information. Record exceptions explicitly when the requirement prescribes another behavior.

Read [Popconfirm](../components/popconfirm.md#row-confirmation-composition) for row-confirmation anchoring, dismissal and mutation timing. Its ActionGroup composition requires the native `span` named `RowActionAnchor` between Popconfirm and ActionGroup so Antd can obtain a DOM ref and position the popup. Modal is appropriate for source-required preflight results, input forms or substantial impact/diff review.

For existing copy actions, exercise repeated use and verify the new row/total as well as message dismissal and stable layout. For actions requiring row confirmation, apply [Popconfirm acceptance](../components/popconfirm.md), including another row and relevant permissions. Do not add copy or confirmation features solely to run this checklist.

### Native navigation

Bind navigation through the actual [ActionGroup](../../react_ui/components/action-group.md) or [Form event/ref contract](../components/form.md#events-and-ref-actions). Derive destinations from the requirement and validated values; verify the complete route/state handoff in Preview.
