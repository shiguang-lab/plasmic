# Input

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Input | `plasmic-antd6-input` |
| Input.OTP | `plasmic-antd6-input-otp` |
| Input.Password | `plasmic-antd6-input-password` |
| Input.Search | `plasmic-antd6-input-search` |
| Input.TextArea | `plasmic-antd6-textarea` |

## Generation rules

### Design defaults

- Use Input for free text and textual identifiers; TextArea for multi-line text (`autoSize`, at least 3 rows; code or query text uses a monospace TextArea of at least 8 rows); Input.Search only for one keyword search outside a SearchForm.
- The control fills its Form or SearchForm column.
- Placeholder states a format or example, otherwise `请输入` + the field noun; `allowClear` in query fields and optional form fields; `maxLength` from the requirement.

### Value and field ownership

Apply [field semantics](../selection.md#field-semantics) before choosing Input. A time/date/quantity serialized as a string is not automatically a text field; use its semantic control and verified value conversion. Textual identifiers and explicit source-required text interactions retain Input.

Use Input for ordinary text, Input.TextArea for multi-line text and Input.Password for an actual secret field. Keep the real control directly inside its owning [Form.Item](form.md#formitem); the Form owns its value and validation. Standalone Input uses its registered value state. Input/Password/TextArea onChange receives the native event; the registration's state helper extracts event.target.value. Do not bind an event object as the business value or assume all Input variants use that signature.

Editable SQL/code needs an actual installed editor or TextArea. A syntax-colored `<pre>` is read-only content. Bind the editor's real value to formatting/validation/submission; typing after a successful validation/preflight must invalidate that result when required. Test changing the text and reading it back through the workflow, rather than only triggering buttons against an unchanged sample string.

Read actual size, variant, disabled, readOnly, allowClear and maxLength controls. Placeholder is an example or hint, not the label. Prefix/suffix are inside the control; field instructions and external actions belong to the surrounding composition. Do not add unsupported addon props from another Antd version. TextArea autoSize and field width must accommodate its required content without clipping validation below it.

### Search and OTP

Input.Search forwards a string through onChange and onSearch. One search action owns Enter/button submission; do not issue duplicate requests from both callbacks. Its loading state follows the actual query. Input.OTP is native: onChange fires with the complete string once every cell is filled, and onInput receives the array of cell values on each edit; a partially filled code must not run completion work. Password visibility remains the native interaction and must not change the stored value. These variants are maintained here rather than in separate files.

## Acceptance checks

### Acceptance

Test typing, clearing, empty/long text, explicit disabled/readOnly, Enter and any prefix/suffix at the requested width. Exercise Password reveal, TextArea growth, Search query/reset and incomplete/complete OTP only when used. Verify real Form errors, unchanged value ownership and saved bindings; keyboard/name checks follow [accessibility](../../../design/accessibility.md).
