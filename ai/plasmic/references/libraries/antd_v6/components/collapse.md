# Collapse

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Collapse | `plasmic-antd6-collapse` |
| Collapse.Panel | `plasmic-antd6-collapse-item` |

## Generation rules

### Related expandable sections

Use Collapse for sections that may be individually expanded or follow an explicit accordion rule. Read actual activeKey/defaultActiveKey, accordion, items/children and onChange contract. Keys are stable business identifiers, not array positions that change when sections are inserted. Collapse.Panel uses the installed child registration and lives in this document.

### Content and acceptance

Temporary canvas reveal does not persist expanded business state. Keep required form fields and their validation/values under the real Form preserve and visibility policy; do not treat a collapsed valid field as absent. Verify default, expanded/collapsed, disabled and controlled states, relevant keys after reordering, keyboard operation and hidden error reveal. Check complete content and scroll reachability after expansion.
