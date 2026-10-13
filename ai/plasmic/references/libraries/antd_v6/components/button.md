# Button

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Button | `plasmic-antd6-button` |

## Types and labels

Each action group has at most one primary action, derived from the user's main task in that region. Coordinate with the existing one-primary-page-action convention: do not independently promote every Card, row or auxiliary operation. A group with no dominant action may use only default buttons. Loading/disabled are states of the intended type, not new hierarchy roles; a disabled screenshot alone cannot prove the enabled hierarchy.

| Meaning | Button treatment |
| --- | --- |
| Main task completion | `primary`; use the actual theme/contract, not a hand-painted brand color. |
| Secondary business action | `default`; use `text` for low-emphasis auxiliary actions where the owning pattern supports it. |
| Cancel/back in a completion footer | `default` by default; a verified native/approved pattern may use `text`. Ordinary cancellation does not use `primary` or `danger`. |
| Add an item inside a collection | `dashed` when the owning component/pattern calls for it; not a generic secondary-action style. |
| Navigation | Real supported Link/href navigation; a visual `link` Button type alone does not establish routing semantics. Table action appearance follows its ActionGroup contract. |
| Destructive/risky change | Use the supported `danger` treatment for verified destructive consequences, such as deletion or revoking access. Publish/go-live is not automatically danger. Confirmation and default focus follow the actual risk/requirement; a protective confirmation may emphasize cancel when that is the recommended choice. |

Use concise action/result labels consistent with the surrounding instructions and actual event: distinguish save, submit for approval, run, publish, cancel editing, return and stop a running task. Do not use a generic submit label for an operation described elsewhere as a run/test, or claim a close action stops backend work. Routine Modal labels follow its [footer contract](modal.md#footer). Do not manually insert spaces into two-character Chinese labels; preserve native typography/spacing.

Visual `type` and native `htmlType` are separate contracts. Only the intended validated form submission uses submit semantics; cancel, navigation and auxiliary operations must not accidentally submit or reset the Form. Follow the installed Form/ref action contracts, including footer actions outside Form; do not wire both native submission and a click handler to perform the same mutation twice.

Use [action-bar composition](../compositions/action-bars.md) for contextual order, alignment, grouped availability and combined Preview acceptance.
