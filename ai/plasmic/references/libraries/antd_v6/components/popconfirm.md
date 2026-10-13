# Popconfirm

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Popconfirm | `plasmic-antd6-popconfirm` |

Use registered Popconfirm for single-row delete, enable/disable and other actions whose consequence fits a short sentence. Anchor it to that row's action control or ActionGroup, including actions selected from More; close the menu and keep the source list visible without a modal mask. Include the object, consequence, cancel and an action-specific confirm label; apply danger to destructive confirmation. Execute the mutation only on confirm. Cancel/outside dismissal must not change the record, and must clear pending confirmation so another row works. Never replace these row confirmations with Modal. Modal remains appropriate for source-required preflight results, input forms or substantial impact/diff review.

In Preview exercise a More-menu confirmation, cancel/confirm, repeated use on another row and permission gates. Verify the popover anchor and viewport bounds without a modal backdrop; no mutation occurs before confirmation or on dismissal. Save/reopen and reread actual props and handlers.
