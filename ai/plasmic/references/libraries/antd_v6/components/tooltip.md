# Tooltip

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Tooltip | `plasmic-antd6-tooltip` |

## Generation rules

### Design defaults

- Use for supplemental help on an icon, the complete value of truncated table text, or the meaning of a metric; never for required instructions or the only path to an action. Text columns expected to exceed their width follow the [Column ellipsis + Tooltip pattern](table.md#columns-and-content).
- Keep explanatory content concise. A truncated-value Tooltip preserves the complete value and may wrap across more lines.

### Usage and behavior

Read the installed Tooltip contract: it is the native Ant Design Tooltip and opens on its configured trigger whether or not the content overflows; it has no overflow detection. For long-text table columns, set Column `ellipsis:{showTitle:false}` and compose Tooltip in the native render Slot with `placement:topLeft`. Column controls truncation and suppresses the browser title; Tooltip exposes the complete current-row value. Bind the title Slot or titleText fallback and children to the same intended value, preserving 0/false; use an empty title for null/undefined/empty values. Multi-line and multi-field custom content use the same row scope. See [Column rules](table.md#columns-and-content) for the presentation decision and example.

Empty/null title disables fallback content. Editable children/title Slots retain their actual bindings; selection may reveal the overlay for editing without persisting open state. Verify hover/focus, complete content, long and short values and empty/null title, and that hover never runs business actions or navigation. Check editor, Preview and saved/reopened readback; temporary reveals must not enter preview or exports.

Table cells follow the [Column ellipsis guidance](table.md#columns-and-content) and [render templates](table.md#render-templates) for custom Tooltip content and row render scope. Form label explanations use the real [Form.Item tooltip](form.md#label-help), rather than a separately composed help control.
