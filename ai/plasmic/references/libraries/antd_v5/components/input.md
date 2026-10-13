# Input

Library: [Ant Design v5](../index.md).

| Registered component | Registration key |
| --- | --- |
| Input | `plasmic-antd5-input` |
| Password Input | `plasmic-antd5-input-password` |
| Text Area | `plasmic-antd5-textarea` |

## Input, Password and TextArea

Select the registered text control from its actual role: ordinary text, secret text or multi-line content. These v5 registrations use value/defaultValue and native onChange(event), whose state helper reads event.target.value. Inside [Form](form.md), the real Item owns the value. Do not bind the event object or add v6 Search/OTP registrations that are not in this library.

Read the exposed bordered, disabled, readOnly, allowClear, maxLength and decoration contracts per variant. Password and TextArea expose different subsets; TextArea autoSize controls growth. Labels/instructions remain outside the control's prefix/suffix/addon content. Native capabilities absent from the registration require verification, not an invented prop.

## Acceptance

Verify typing, clear, Enter, long text, actual disabled/readOnly and Form errors. Test Password reveal and TextArea growth when used, with complete content and preserved value ownership. Save/reopen real bindings and apply [keyboard checks](../../../design/accessibility.md).
