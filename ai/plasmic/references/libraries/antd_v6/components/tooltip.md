# Tooltip

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Tooltip | `plasmic-antd6-tooltip` |

Read the installed Tooltip contract. Truncated text must expose its complete content through an actual Tooltip on hover or keyboard focus, only when it overflows. Browser title attributes and detail/copy actions do not replace it. Short or empty content must not create redundant popups.

Empty/null title disables fallback content. Editable children/title Slots retain their actual bindings; selection may reveal the overlay for editing without persisting open state. Verify hover/focus, complete content, overflow/non-overflow and empty/null title, and that hover never runs business actions or navigation. Check editor, Preview and saved/reopened readback; temporary reveals must not enter preview or exports.

Table cells follow the [Column ellipsis guidance](table.md#columns-and-content) and [render templates](table.md#render-templates) for custom Tooltip content and row render scope. Form label explanations use the real [Form.Item tooltip](form.md#label-help), rather than a separately composed help control.
