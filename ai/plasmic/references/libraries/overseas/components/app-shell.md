# AppShell

Library: [Overseas](../index.md).

| Registered component | Registration key |
| --- | --- |
| AppShell | `plasmic-overseas-app-shell` |

If the host owns navigation, do not duplicate it. For a standalone admin preview use the registered `plasmic-overseas-app-shell` component and its Page body slot; never duplicate its layout markup. The shell owns the outer 16px padding, so the slotted business container must not add another outer padding. Its geometry is: 239px white sidebar, 64px brand/header, header horizontal padding 24px, content background neutral and padding 16px. The page body fills available width and has no forced white background; SearchForm and business cards own their own surfaces. Avoid another enclosing card. Use product branding and menu evidence from the original design. Configure AppShell menuItems once as the complete nested navigation tree with href routes; put detail and creation routes under their parent with hidden=true when they must not appear in the sidebar. AppShell derives breadcrumbs and selection from Plasmic pagePath, including all menu ancestors. Never pass a separate per-page breadcrumb list or render it again in business content. Do not add a decorative title/description block by default.

Use [viewport/layout rules](../../../design/layout.md) for root sizing, bounded scrolling and target device geometry. Standalone shell Pages use a definite viewport-height root; height:stretch with a percentage-height AppShell does not establish this contract. Apply the [shell height gate and Preview acceptance](../../../design/layout.md#viewport-shell-height-acceptance) before delivery and after save/reload.
