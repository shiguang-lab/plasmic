# InputNumber

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Number Input | `plasmic-antd6-input-number` |

## Generation rules

### Design defaults

- Use for a freely entered quantity; finite numeric choices use Select or Radio, identifiers and phone numbers use Input.
- Set `width:100%` in a Form column (it does not fill by default). `min`, `max` and precision come from the requirement; the unit goes in the label or the control suffix.

### Usage and behavior

Numeric input state is numeric. Registered state and event types must match the actual runtime value; verify controlled/uncontrolled values and explicit zero against the installed contract.

### Range, precision and empty values

Read the actual min/max/step, controls, value/defaultValue and onChange contract. Empty is distinct from zero; do not convert an empty field to zero through a truthy fallback. Decimal/integer restrictions and formatting come from the requirement. Native numeric or string-mode capabilities must be verified before using them; do not add an unregistered precision/stringMode prop solely because another InputNumber wrapper supports it.

## Acceptance checks

### Acceptance

Test typing, increment/decrement, zero, negative/decimal values when allowed, empty/clearing and range boundaries. Keep Form as the value/validation owner and distinguish a component's editing behavior from a business validation rule. Check returned values, disabled/readOnly behavior and reopening a different record, including an invalid value corrected before submission.
