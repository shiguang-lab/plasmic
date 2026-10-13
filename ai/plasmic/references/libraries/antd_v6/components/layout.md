# Layout

Library: [Ant Design v6](../index.md).

| Registered component | Registration key |
| --- | --- |
| Layout | `plasmic-antd6-layout` |
| Layout.Content | `plasmic-antd6-layout-content` |
| Layout.Footer | `plasmic-antd6-layout-footer` |
| Layout.Header | `plasmic-antd6-layout-header` |
| Layout.Sider | `plasmic-antd6-layout-sider` |

## Shell and regions

Layout owns its Header, Footer, Content and Sider nodes. It is a layout primitive; a project using a host shell or [AppShell](app-shell.md) does not need another nested application shell. Read each region's real children Slot and the Layout hasSider contract. Keep navigation and content ownership explicit rather than reproducing the shell with decorative sibling blocks.

## Layout.Sider

Use the registered width, collapsed/collapsedWidth, collapsible, theme, breakpoint and onCollapse contract. A controlled collapsed binding has one owner. Responsive collapse is conditional on task scope; it must not change business routes or data state. Header/footer retain natural required height while Content fills or grows according to the Page sizing contract.

## Acceptance

Apply [shared layout](../../../design/layout.md) to bounded sizing and the shared Scrollbar. Verify expanded/collapsed navigation, content width, long content, shorter viewports, active routes and reachable footer. Each subcomponent stays in this document; keep one application shell per standalone page.
