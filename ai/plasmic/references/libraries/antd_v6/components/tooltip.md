# Tooltip

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Tooltip | `plasmic-antd6-tooltip` |

## Generation rules

### Design defaults

- Use for supplemental help on an icon, the full value of a truncated cell, or the meaning of a metric; never for required information or the only path to an action.
- Content is one or two short lines.

### Usage and behavior

Read the installed Tooltip contract: it is the native Ant Design Tooltip and opens on its trigger whether or not the content overflows; it has no overflow detection. Truncated table text keeps its complete value through native Column ellipsis (the cell's native title). When the requirement calls for a styled popup, compose a Tooltip whose title binds the complete value; bind an empty or null title for empty values so they create no popup.

Empty/null title disables fallback content. Editable children/title Slots retain their actual bindings; selection may reveal the overlay for editing without persisting open state. Verify hover/focus, complete content, long and short values and empty/null title, and that hover never runs business actions or navigation. Check editor, Preview and saved/reopened readback; temporary reveals must not enter preview or exports.

Table cells follow the [Column ellipsis guidance](table.md#columns-and-content) and [render templates](table.md#render-templates) for custom Tooltip content and row render scope. Form label explanations use the real [Form.Item tooltip](form.md#label-help), rather than a separately composed help control.
