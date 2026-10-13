# Switch

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Switch | `plasmic-antd6-switch` |

## Boolean field or immediate action

A Switch expresses a boolean on/off state. Read the registered checked/defaultChecked and onChange(checked) contract; do not bind value instead of checked. Inside a business Form, keep it as the real Item control and let Form own the field. An immediate server mutation is a separate workflow: permission, pending state, rejection recovery and confirmation come from the requirement rather than from the Switch itself.

## Acceptance

Exercise initial false/true, toggling, controlled and uncontrolled values, disabled behavior and the real Form payload. For an immediate action, verify exactly one mutation, the required pending policy and restored state after failure. The label must explain the enabled condition; apply [keyboard/name checks](../../../design/accessibility.md).
