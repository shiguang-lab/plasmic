# AppShell

Library: [Overseas](../index.md).

| Registered component | Registration key |
| --- | --- |
| AppShell | `plasmic-overseas-app-shell` |

## Standalone Page boilerplate

Start from the [golden boilerplate](../../../design/layout.md#standalone-appshell-golden-boilerplate): actual Page root `width:stretch; min-width:0; height:100vh; min-height:0; overflow:hidden`, AppShell instance `width:100%; height:100%; min-width:0; min-height:0`, business body in `children`. Configure a newly created Page's existing root before inserting its shell; do not append another root wrapper. These instance styles override the registration's fixed 1440×1024 defaults. Do not use `width:100%`, `height:stretch` or a max-height-only Page root. Reuse the existing shell when the host owns navigation.

If the host owns navigation, do not duplicate it. For a standalone admin preview use the registered `plasmic-overseas-app-shell` component and its Page body slot; never duplicate its layout markup. The shell owns the outer 16px padding, so the slotted business container must not add another outer padding. Its geometry is: 239px white sidebar, 64px brand/header, header horizontal padding 24px, content background neutral and padding 16px. The page body fills available width and has no forced white background; SearchForm and business cards own their own surfaces. Avoid another enclosing card. Use product branding and menu evidence from the original design. Configure AppShell menuItems once as the complete nested navigation tree with href routes; put detail and creation routes under their parent with hidden=true when they must not appear in the sidebar. AppShell derives breadcrumbs and selection from Plasmic pagePath, including all menu ancestors. Never pass a separate per-page breadcrumb list or render it again in business content. Do not add a standalone Page title/header, subtitle or explanatory intro. This includes detail Pages. Only an explicit current user request permits that area; templates and references do not opt in. Keep required section/component titles with their native owners, and requirement/process explanations outside the UI.

Use [viewport/layout rules](../../../design/layout.md) for root sizing, bounded scrolling and target device geometry. Standalone shell Pages use a definite viewport-height root; height:stretch with a percentage-height AppShell does not establish this contract. Apply the [shell height gate and Preview acceptance](../../../design/layout.md#viewport-shell-height-acceptance) before delivery and after save/reload.

## Menu routes and context

`menuItems` is the real registered array prop. Prefer a static complete tree when destinations and visibility are static. The shell uses `pagePath` for selection/breadcrumbs and passes each `href` to the host's Plasmic Link; it does not append the current query or transfer role/environment state itself. `appSource` and `language` controls do not establish cross-page persistence.

For required cross-page context, first read the installed host Link/router or global-context contract. Use that verified contract, or supported bindings when the destination genuinely depends on runtime state. Record which query keys must survive, destination-value precedence, and direct-entry/back-navigation behavior; do not blindly copy all current query parameters. A role query used in a prototype is not an authorization contract. Do not document implicit preservation or a global provider that the project does not actually have.

Dynamic `menuItems` bindings are supported by the expression contract, but cannot pass the static structure gate. Do not add an anonymous mapping expression to otherwise static menus merely as a convention. When dynamic menus are required, keep an independently reviewed tree for each relevant role/state and verify rendered visibility and link destinations in Preview. Do not execute arbitrary expressions in Python or treat an extracted static skeleton as proof of runtime behavior. See [structure acceptance](../../../requirement-alignment.md#structural-gate).
