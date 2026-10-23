# Rate

Library: [Ant Design v5](../index.md).

| Registered component | Registration key |
| --- | --- |
| Rate | `plasmic-antd5-rate` |

## Generation rules

### Editable or read-only rating

Read value/defaultValue, count, allowHalf, allowClear, disabled, tooltips and this wrapper's character/multiCharacter/symbols contract. The returned rating is numeric; custom symbols change presentation rather than the business scale. Pure detail views retain the intended non-editable policy.

## Acceptance checks

### Acceptance

Test zero, clear, partial/full ratings, hover without commit, supported keyboard events and the actual Form payload. Verify custom symbols/tooltips, disabled behavior and saved value/callback bindings rather than inferring completion from a decorative rating.
