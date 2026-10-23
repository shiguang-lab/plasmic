# Rate

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Rate | `plasmic-antd6-rate` |

## Generation rules

Rating symbol Slots accept single nodes, arrays and text; hover events receive the numeric rating. Keep registered Slot/event types aligned with those native values.

### Rating and acceptance

Use actual value/defaultValue, count, allowHalf, allowClear, disabled and supported symbols/tooltips. Read-only rating and an editable rating field have different interaction requirements; do not leave an editable control in a pure detail region. Preserve zero and the declared rating scale rather than converting it to an absent value.

Verify initial/cleared/half/full ratings when supported, hover without committing, disabled behavior, keyboard changes and the submitted value. Keep custom symbols readable and interactive targets usable; check Form ownership and saved callback/state bindings.
