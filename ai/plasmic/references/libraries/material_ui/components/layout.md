# Layout

Library: [Material UI](../index.md).

| Registered component | Registration key |
| --- | --- |
| Box | `plasmic-material-ui-box` |
| Container | `plasmic-material-ui-container` |
| Grid | `plasmic-material-ui-grid` |
| ImageList | `plasmic-material-ui-image-list` |
| ImageListItem | `plasmic-material-ui-image-list-item` |
| ImageListItemBar | `plasmic-material-ui-image-list-item-bar` |
| Stack | `plasmic-material-ui-stack` |

## Generation rules

Use Stack for one-dimensional arrangement, Grid for aligned columns, Container for content width and Box for a necessary styled/semantic container. ImageList and its children arrange image collections. Read the installed Grid API before setting responsive sizing; do not import Antd Row/Col props or a different MUI major's API.

Use the library's sx, spacing and breakpoint contracts and the current [theme](theme.md). Numeric sx spacing follows MUI theme semantics rather than necessarily representing pixels. Derive widths, gaps and responsive behavior from the task; no PC grid, fixed viewport or admin density is imposed. Keep the shared [layout](../../../design/layout.md) sizing, flow and scroll ownership rules.

## Acceptance checks

Check required widths, wrapping, content order and long-content shrink behavior. Verify image aspect ratios and captions. Confirm each intended scroll region has bounded sizing and the shared Scrollbar owns scrolling.
