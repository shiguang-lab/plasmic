# Checkbox

Library: [Ant Design v5](../index.md).

| Registered component | Registration key |
| --- | --- |
| Checkbox | `plasmic-antd5-checkbox` |
| Checkbox Group | `plasmic-antd5-checkbox-group` |

## Generation rules

### Checkbox and Checkbox.Group

A single Checkbox owns checked/defaultChecked, with its native event converted through the registered state helper. Group owns an array value and actual Checkbox children; read its callback separately. Indeterminate describes partial selection and is not a third stored boolean. In Form, use the actual checked valuePropName contract without a competing page binding.

## Acceptance checks

### Acceptance

Test false/true, group empty/partial/full selection, disabled items, clear and keyboard activation. Define the scope of any select-all action from the requirement; rendered checkboxes do not certify server-wide selection. Save/reopen and verify the real Form payload.
