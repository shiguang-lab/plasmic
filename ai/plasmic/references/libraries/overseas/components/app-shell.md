# AppShell

Library: [Overseas](../index.md).

| Registered component | Registration key |
| --- | --- |
| AppShell | `plasmic-overseas-app-shell` |

## Generation rules

### Design defaults

- One AppShell per standalone Page; it owns navigation, the header and the 16px content padding.
- Its children Slot holds one vertical Flex with gap 16 that fills the width; regions follow the [page type](../../../design/page-types.md); no extra outer padding or Page title.

### Standalone Page boilerplate

Start from the [golden boilerplate](../../../design/layout.md#standalone-appshell-golden-boilerplate): keep the Page's existing default root and insert AppShell directly, with business content in `children`. AppShell's outer DOM owns `width:100%; height:var(--viewport-height, 100vh); min-width:0; min-height:0; flex-shrink:0`; registration defaults remain `width:100%; height:100vh`. The Studio variable anchors height to the authored viewport while its iframe measures content; Preview/export use the live viewport fallback. Do not append another sizing wrapper or configure ancestor heights to fill the shell. Reuse the existing shell when the host owns navigation.

For a standalone admin preview use the registered `plasmic-overseas-app-shell` component and its Page body slot; never duplicate its layout markup. The shell owns the outer 16px padding, so the slotted business container must not add another outer padding. Its geometry is: 239px white sidebar, 64px brand/header, header horizontal padding 24px, content background neutral and padding 16px. The page body fills available width and has no forced white background; SearchForm and business cards own their own surfaces. Avoid another enclosing card. Use product branding and menu evidence from the original design. Configure AppShell menuItems once as the complete nested navigation tree with href routes; put detail and creation routes under their parent with hidden=true when they must not appear in the sidebar. AppShell derives breadcrumbs and selection from Plasmic pagePath, including all menu ancestors. Never pass a separate per-page breadcrumb list or render it again in business content. Apply [admin content entry](../../../design/layout.md#admin-content-entry) for Page headings and business copy.

Use [viewport/layout rules](../../../design/layout.md) for component-owned sizing, bounded scrolling and target device geometry. The shell fills viewport height independently of the Page root height. Apply the [shell height gate and Preview acceptance](../../../design/layout.md#viewport-shell-height-acceptance) before delivery and after save/reload.

### Menu routes and context

`menuItems` is the real registered array prop. Prefer a static complete tree when destinations and visibility are static. The shell uses `pagePath` for selection/breadcrumbs and passes each `href` to the host's Plasmic Link; it does not append the current query or transfer role/environment state itself. `appSource` and `language` controls do not establish cross-page persistence.

Route matches take priority over `selectedMenuKey`: exact paths win, followed by the longest menu path at a complete path-segment boundary. A hidden `/groups/detail` menu route therefore covers `/groups/detail/<id>`, retaining its breadcrumb ancestry and highlighting the nearest visible parent. `/groups-extra` does not match `/groups`, and `/` only matches itself. Query strings, hashes and trailing slashes do not affect matching. When no route matches, the explicit selection supplies the menu path, including for menus without hrefs. Navigation expands the selected item's visible submenu ancestors. Runtime menu expansion survives page remounts within the same window for an identical navigation tree (keys, hrefs, visibility, types and nesting); users can close a branch until the next navigation reveals it again. New windows initialize from their current route. Canvas instances keep expansion local to editing and separate from runtime navigation.

## Conditional rules

The compose card delivers each subsection only to a Page that meets its condition; acceptance reads them all.

### App context

Applies when the Page plan has `appContext.required: true`.

Recognize App 来源, App Source, app_source, appSource, appId/app_id/application_id, app_name, 应用标识/应用名称, multi-App requirements and equivalent identifiers of the current work App. Record a source-backed `appContext` decision using the [context inventory](../../../design/component-policy.md#app-context-inventory). When the requirement distinguishes Apps, keep the native header AppSource control. “No App source filter/form option” removes the business field, not the shell's working context. Only an explicit current instruction excluding the top-level/global switcher overrides this baseline; do not infer it from a SQL validation or form-field restriction. A generic application title alone does not establish multiple working Apps; resolve that semantic distinction from the source.

Populate `appSources` from the requirement/authorized configuration, not demo defaults. An empty array intentionally hides the native control and cannot stand in for unrecognized context. Bind `appSource` to the same native implicit state or verified shared context used by data queries, creation, export and navigation. AppShell already exposes a writable appSource state; reuse it when appropriate instead of creating another visual selector or redundant event/state layer. If using explicit shared state, onAppSourceChange updates that state. A header-only local change is insufficient.

Inventory in-scope consumers and verify app-switch plus their context-data/create/export/navigation cases. Check initial entry, option authorization, switched data, new-object source, export target, and supported direct entry/back navigation. Keep switcher context separate from business filter reset. One authorized App is not permission to fabricate another; show its real identity and report unavailable switching coverage. Cross-page persistence follows the actual host/router contract below.

### Cross-page context and dynamic menus

Applies when the structure plan's root `navigation` declares a `roleQuery`, or the Page's AppShell binds `menuItems` dynamically (`dynamicProps` or an expression).

For required cross-page context, first read the installed host Link/router or global-context contract. Use that verified contract, or supported bindings when the destination genuinely depends on runtime state. Record which query keys must survive, destination-value precedence, and direct-entry/back-navigation behavior; do not blindly copy all current query parameters. A role query used in a prototype is not an authorization contract. Do not document implicit preservation or a global provider that the project does not actually have.

Dynamic `menuItems` bindings are supported. The structure gate recognizes only static trees and the explicitly inventoried restricted `navigation.roleQuery` transform; other dynamic expressions remain statically unverified. Do not add an anonymous mapping expression to otherwise static menus merely as a convention. When dynamic menus are required, keep an independently reviewed tree for each relevant role/state and verify rendered visibility and link destinations in Preview. Do not execute arbitrary expressions in Python or treat an extracted static skeleton as proof of runtime behavior. See [structure acceptance](../../../requirement-alignment.md#structural-gate).
