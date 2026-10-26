# Result

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Result | `plasmic-antd6-result` |

## Generation rules

### Design defaults

- Use for a Page-level outcome or error: the actual status, a short title, a one-sentence subtitle, then the next action (primary) and a return action.
- Centered in its owning content region. Follow the [result page layout](../../../design/page-types.md#result) for the page's surface, including its headerless Card; Result does not impose a separate Card policy.

### Page or region outcome

Use Result for a substantial success/error/access/not-found outcome, with actual title, subTitle, icon and extra actions. Bind status to the verified result; a rendered success illustration does not establish mutation success. A local field validation failure remains in Form and an ordinary transient success may use themed Message instead.

## Acceptance checks

### Acceptance

Check the affected scope, outcome text, authorized retry/return actions and the intended route/state after activation. Keep existing content when a recoverable regional failure does not invalidate it. Follow [content-state composition](../compositions/content-states.md) and verify keyboard access and usable layout at the required viewport.
