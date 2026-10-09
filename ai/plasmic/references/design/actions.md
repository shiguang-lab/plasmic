# Actions

## Buttons and action bars

Use [Ant Design button guidance](https://ant.design/docs/spec/buttons), the [Button contract](https://ant.design/components/button/) and native [Modal defaults](https://ant.design/components/modal/) as component references. [Atlassian panel footers](https://atlassian.design/components/panel/usage) also place the secondary action before the primary action. The placement table below defines this project's LTR admin convention by context; it is not a universal ordering rule for every platform or toolbar. Explicit user-approved layouts and the target component's verified contract take precedence. Preserve the business page language and actual registered Props/Slots.

### Placement and ordering

| Context | Placement and order |
| --- | --- |
| Routine Modal confirm/cancel pair | Retain the native footer: cancel on the left, confirmation on the right. Follow [forms and state](../design/forms.md#forms-and-state) for locale-owned text and submission bindings. |
| Drawer footer or page-level completion bar | Right-align the action group: cancel/back, secondary business actions, primary completion action. Cancel is first within the group, not necessarily at the far left of the whole bar. Keep concise status/prerequisite text at the bar's left when needed. |
| Inline form actions | Align with the form's control/content column and retain the native or approved form pattern, commonly submit followed by cancel. Do not apply the right-aligned footer rule automatically. |
| List/business toolbar or page-header actions | Follow the owning region's layout: list-query business actions align left; header actions occupy the header's action area. Order by importance and usage, commonly primary business action before secondary actions. These groups do not acquire a cancel button unless a cancellable task exists. |
| SearchForm query/reset controls | Preserve the registered SearchForm action-column contract and query/reset order; reset clears filters and does not mean cancel. |
| Multi-step flow | Previous/back precedes next/finish. Intermediate actions follow the actual step dependencies; do not add a second completion action with the same effect. |
| Table row actions | Use the existing ActionGroup ordering, folding and permission rules in [table column widths](../design/lists.md#table-column-widths); do not turn every row into a primary-button group. |

Order secondary workflow actions by their real dependencies where applicable, with the terminal completion action last in a right-aligned footer. Keep positions stable across enabled, disabled, loading and result states; do not reorder buttons or promote cancel just because another action is disabled. A primary emphasis change is appropriate only for a requirement-defined workflow phase, not whichever action happens to be available.

Keep ordinary actions in one row with the existing inline gap of 8px; Drawer footer actions retain the existing 12px gap. Use the same control size and native theme treatment within a group, with natural label widths. Separate unrelated/destructive actions from completion actions by a distinct group/space; do not add a divider between every button. Fold low-frequency secondary actions when needed, but keep the current primary action and the task's cancel/back entry directly reachable. Keep native Modal/Drawer footer ownership. Only make a page bar sticky/fixed when the task needs it; reserve content space so it cannot cover the last field, validation error or pagination, and do not add a second scroll owner.

### Types and labels

Each action group has at most one primary action, derived from the user's main task in that region. Coordinate with the existing one-primary-page-action convention: do not independently promote every Card, row or auxiliary operation. A group with no dominant action may use only default buttons. Loading/disabled are states of the intended type, not new hierarchy roles; a disabled screenshot alone cannot prove the enabled hierarchy.

| Meaning | Button treatment |
| --- | --- |
| Main task completion | `primary`; use the actual theme/contract, not a hand-painted brand color. |
| Secondary business action | `default`; use `text` for low-emphasis auxiliary actions where the owning pattern supports it. |
| Cancel/back in a completion footer | `default` by default; a verified native/approved pattern may use `text`. Ordinary cancellation does not use `primary` or `danger`. |
| Add an item inside a collection | `dashed` when the owning component/pattern calls for it; not a generic secondary-action style. |
| Navigation | Real supported Link/href navigation; a visual `link` Button type alone does not establish routing semantics. Table action appearance follows its ActionGroup contract. |
| Destructive/risky change | Use the supported `danger` treatment for verified destructive consequences, such as deletion or revoking access. Publish/go-live is not automatically danger. Confirmation and default focus follow the actual risk/requirement; a protective confirmation may emphasize cancel when that is the recommended choice. |

Use concise action/result labels consistent with the surrounding instructions and actual event: distinguish save, submit for approval, run, publish, cancel editing, return and stop a running task. Do not use a generic submit label for an operation described elsewhere as a run/test, or claim a close action stops backend work. Keep the routine Modal's default locale-owned OK/Cancel text; use supported text overrides for a source-required specific action or risk consequence, without rebuilding its footer. Do not manually insert spaces into two-character Chinese labels; preserve native typography/spacing.

Visual `type` and native `htmlType` are separate contracts. Only the intended validated form submission uses submit semantics; cancel, navigation and auxiliary operations must not accidentally submit or reset the Form. Follow the installed Form/ref action contracts, including footer actions outside Form; do not wire both native submission and a click handler to perform the same mutation twice.

### Availability and acceptance

Derive visibility, enabled state and loading from the requirement's permissions, prerequisites and active operation. Follow existing permission filtering before folding. Explain unavailable prerequisites beside the affected region/bar in readable text; do not rely solely on a Tooltip attached to a disabled button. Invalid form fields normally use the native submit-and-show-validation path; do not disable submit solely to avoid displaying validation errors unless the requirement specifies that behavior.

During processing show loading on the initiating action, use the shared duplicate-submit guard and prevent conflicting operations. Keep safe cancellation/navigation available where supported; if closing is unsafe, apply the same restriction to cancel, X, Esc and mask according to the flow. Failure retains recoverable input and exposes the actual retry action. When later actions depend on a successful check, bind that success to the checked input/version and invalidate it after relevant edits; stale success must not unlock completion.

Before generation/editing, record each affected action group's context, ordered labels, actual effects, intended types, primary action, permission/prerequisite rules and required states in the task's acceptance matrix. Read back the real Button/Modal/Drawer/ActionGroup props and handlers, including native footer ownership and any `type`/`color`/`variant` precedence in the installed contract. In Preview check available, prerequisite-blocked, processing, failure and success states where applicable: enabled hierarchy, stable order, matching labels/effects, validation, single submission and safe cancel/close behavior. Verify keyboard focus/activation, supported Enter submission and long-label/footer reachability at the target viewport; then save/reopen and reread the affected groups. Record unexecuted cases as unverified. A screenshot of disabled buttons or a correct DOM order alone does not pass this acceptance.

### Feedback and row confirmation

Read the live feedback contract before binding callbacks. The Antd6 ConfigProvider global action `showMessage(type, content, duration)` supplies themed Message feedback; generated previews must bind `$globalActions` for custom callbacks too. ActionGroup row items can declare `confirm` with title/description/okText/cancelText; `onAction` fires only after confirmation. Verify these behaviors in real preview, since valid expressions and successful model validation do not prove runtime feedback.

Choose feedback from its purpose and the requirement. Copy, ordinary save, delete and status-change completion use a short Ant Design Message/toast; they must not insert a persistent page-top success Alert or change the list geometry. Use inline field errors for validation. Alert belongs to persistent contextual information, actionable failures or a result that the user must inspect. Notification is for longer asynchronous or cross-page information. Record exceptions explicitly when the requirement prescribes another behavior.

Use registered Popconfirm for single-row delete, enable/disable and other actions whose consequence fits a short sentence. Anchor it to that row's action control or ActionGroup, including actions selected from More; close the menu and keep the source list visible without a modal mask. Include the object, consequence, cancel and an action-specific confirm label; apply danger to destructive confirmation. Execute the mutation only on confirm. Cancel/outside dismissal must not change the record, and must clear pending confirmation so another row works. Never replace these row confirmations with Modal. Modal remains appropriate for source-required preflight results, input forms or substantial impact/diff review.

Acceptance must exercise repeated copy, automatic message dismissal, and unchanged filter/Table/pagination positions; verify the copied row and total rather than the toast alone. Exercise row confirmation through More, cancel and confirm, check that no mutation occurs before confirmation, and inspect the popover anchor, viewport bounds and absence of a modal backdrop in a screenshot. Recheck another row, permission gates and save/reopen. Component props and model validation alone do not pass these checks.


## Native navigation

ActionGroup navigation uses item href so the registered Plasmic Link performs routing; onAction is for local actions, not window.location replacement. Navigation after successful form validation uses the native navigation interaction on Form onFinish, deriving its destination from validated values. The submit button calls Form submit and has no unconditional href. Discover the current schema; if this native action is unavailable report the blocked operation without upgrading the editor as part of a design task.
