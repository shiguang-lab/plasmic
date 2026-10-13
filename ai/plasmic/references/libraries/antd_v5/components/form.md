# Form

Library: [Ant Design v5](../index.md).

| Registered component | Registration key |
| --- | --- |
| Form | `plasmic-antd5-form` |
| Form Field Group | `plasmic-antd5-form-group` |
| Form Field | `plasmic-antd5-form-item` |
| Form List | `plasmic-antd5-form-list` |

## Fields, modes and values

Read simplified mode's formItems/dataFormItems/submitSlot or advanced mode's real Form Field children. Keep one Form value owner, meaningful field names, actual initialValues and requirement-derived rules. Standard controls retain their direct Item child binding; checked controls use the real valuePropName. Do not add v6 tooltip, description, validateFirst or styles controls absent from this v5 registration.

Validation comes from the actual Form and Item rules. Submit through the registered submit/validateFields actions and onFinish values; failed validation performs no mutation and keeps recoverable input. Read actual ordered action/event arguments before binding refs. Async detail initialization and hidden/dependent values follow their verified runtime contract rather than assuming initialValues updates on every prop change.

## Form.Item, Form.List and Form Field Group

Field exposes label, children, name, rules, dependencies, shouldUpdate, noStyle and preserve. Native hiding is distinct from clearing/excluding a field. Lists own array paths and their registered add/remove/move operations; Group prefixes nested child names through this wrapper's context and is not a native Form.Group API. Stable row identity and current array position have different roles.

## Acceptance

Test required/invalid/corrected values, actual hidden-field policy, list insertion/removal/move, nested paths, duplicate submission, failed save and reopening another record. Error messages must be visible and attached to the actual field; do not duplicate labels/errors as decorative nodes. Verify real payloads and controlled values, then save/reopen. The current resource-root Form scanner targets the v6 wrapper and does not certify this library.
