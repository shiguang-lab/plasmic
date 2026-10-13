# Masonry

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Masonry | `plasmic-antd6-masonry` |

## Variable-height tiles

Use Masonry for actual variable-height tiles when that arrangement fits the content and reading order. This maintained wrapper accepts items with key/data.content and renders that content as text; columns and gutter are registered. It does not expose an arbitrary editable tile render Slot. Use registered Card/Grid composition when rich editable tile structure is required instead of inventing itemRender.

## Acceptance

Remove sample tiles, preserve stable keys and complete content, and verify column/gutter geometry with short/long/empty items. Check reading order, the required width/reflow and natural height under [shared layout](../../../design/layout.md). Do not clip content to make all tiles look equal.
