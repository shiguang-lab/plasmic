# Popconfirm

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Popconfirm | `plasmic-antd6-popconfirm` |

## Generation rules

### Design defaults

- Use for confirming a quick destructive or state-changing action anchored to its row or button; an action with wide impact uses a Modal.
- Title `确认` + action + object + `？`; the confirm label repeats the action; placement above the trigger.

### Usage and behavior

When the requirement calls for confirmation of a single-row delete, enable/disable or another consequence that fits a short sentence, use registered Popconfirm. Anchor it to that row's action control or ActionGroup, including actions selected from More; close the menu and keep the source list visible without a modal mask. Include the object, consequence, cancel and an action-specific confirm label; `okButtonProps:{"danger":true}` marks a destructive confirmation. Execute the mutation only on confirm. Cancel/outside dismissal must not change the record, and must clear pending confirmation so another row works. Never replace these row confirmations with Modal. Modal remains appropriate for source-required preflight results, input forms or substantial impact/diff review.

#### Row confirmation composition

Around a single Button, the native click trigger opens Popconfirm; leave `open` unset. Around an ActionGroup, use this structure in the Table Column's render Slot: `Popconfirm → children → span RowActionAnchor → ActionGroup`. The native `span` is the positioning anchor: ActionGroup does not forward a DOM ref, so passing it directly as Popconfirm's child leaves the popup without an anchor. This span is a necessary semantic container, not a custom action widget. Give it `display:inline-block` so it has a measurable box without changing ActionGroup's native styles.

Control this Popconfirm with a Page state containing the pending `{key, rowId}`. ActionGroup onAction sets that state for confirmed keys and runs other keys directly. Popconfirm `open` binds to `pending?.rowId === row.id`, so only the clicked row opens. onConfirm checks the current permission/context, performs the mutation, then clears the state; onCancel clears it, and onOpenChange clears it only when its argument is false. Title, description and okText may derive from the pending key. Keep the DOM anchor when generating native React code too.

In Preview exercise a More-menu confirmation, cancel/confirm, repeated use on another row and permission gates. Verify the popover anchor and viewport bounds without a modal backdrop; no mutation occurs before confirmation or on dismissal. Save/reopen and reread actual props and handlers.
