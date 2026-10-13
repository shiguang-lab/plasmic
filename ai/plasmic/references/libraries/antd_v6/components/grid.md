# Grid

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Col | `plasmic-antd6-col` |
| Row | `plasmic-antd6-row` |

## Row and Col

Grid is maintained as one component-family document for the registered Row and Col. Row owns gutter, alignment, justification and wrapping; Col owns span, offset, order, flex and breakpoint configurations. Antd spans use a 24-column row. Plan normal and full-row allocations from actual available width, labels and content; account for offsets before deciding whether a row fits.

## Sizing and responsive use

The current Row control exposes numeric gutter; Col breakpoint controls expose objects. Read supported binding forms before using a native API shape beyond those controls. Do not assume CSS grid-template-columns or gap props apply to Row/Col. Use responsive Col configurations only when the task requires reflow, retaining authored reading order rather than using order to create a conflicting keyboard sequence.

## Acceptance

Check rendered gutter and cell edges, full-row/paired fields, longest values, error-expanded content and conditional cells. Apply [Form layout](../compositions/form-layout.md) for forms and [shared layout](../../../design/layout.md) for ownership. Test required widths near reflow boundaries, page overflow and save/reopen of real Row/Col props.
