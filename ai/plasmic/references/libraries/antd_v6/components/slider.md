# Slider

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Slider | `plasmic-antd6-slider` |

## Generation rules

### Scalar and range values

The registered Slider uses a scalar for one handle and a numeric array for range mode. Read the actual range configuration, min/max/step, marks, tooltip and value/defaultValue contract. Keep numeric bounds and meaningful zero; do not silently round, clamp or add business restrictions beyond the requirement. A precise value may need an adjacent [InputNumber](input-number.md), using one verified shared value owner.

### Events and acceptance

onChange reports interaction changes; onChangeComplete represents completion. Do not run an expensive business mutation on every movement when the requirement calls for a committed value. Test endpoints, step precision, keyboard changes, range ordering, disabled state and controlled/uncontrolled initialization. Verify marks and tooltip content at the required width and save/reopen bindings.
