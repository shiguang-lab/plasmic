# Empty

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Empty | `plasmic-antd6-empty` |

## Generation rules

### Design defaults

- Use inside the empty region (Table and List render their own); the description says what is missing in business terms.
- Offer an action only when the user is allowed to create or change the filter.

### No content

Use Empty for an actual no-data or no-results region after loading has completed. Distinguish those conditions from request failure, missing prerequisites and denied access. Bind description and any children action to the actual condition; clear default demo content. A reset-filter or create action is shown only when meaningful and authorized.

## Acceptance checks

### Acceptance

Read [content-state composition](../compositions/content-states.md). Verify the correct condition, message, action and reserved region size, then transition to real data. Do not replace usable content with Empty during a background refresh or show it before an outstanding request resolves.
