# Admin design rules

Adapted from pen-antd-kit standards manifest 11.0.1: foundations/environment-layout, patterns/admin-app-shell, list-query, tabs, table-data, table-columns, forms-overlays, and quality/review-checklist. Source workspace: `/Users/yanxianliang/overseas/pen-antd-kit/pen-prototype-platform/standards/`. These are design conventions, not Pen APIs or component identifiers.

## Viewport and shell

Use the live Studio `Desktop` device preset by default for PC requirements (currently 1440×1024); discover it through MCP `read.devicePresets` rather than assuming 1920×1080. Explicit user dimensions take precedence. Keep only Desktop preview columns in Pages and one overview Arena for the requirement; its artboards reference the existing routed Pages. Do not deliver per-page duplicate Arenas, test pages or mobile/tablet frames. Do not generate mobile breakpoints or responsive overrides for PC-only scope. For a fixed viewport W×H, bound each root to `height/minHeight/maxHeight: Hpx`, `width: 100%`, and `minWidth: Wpx`; percentage widths alone can shrink inside the global theme wrapper. Confirm the rendered shell starts at (0, 0) and fills W×H. Scroll content/table bodies internally and keep pagination reachable; do not enlarge the artboard. If the host owns navigation, do not duplicate it. For a standalone admin preview use the registered `plasmic-overseas-app-shell` component and its Page body slot; never duplicate its layout markup. The shell owns the outer 16px padding, so the slotted business container must not add another outer padding. Its geometry is: 239px white sidebar, 64px brand/header, header horizontal padding 24px, content background neutral and padding 16px. The white page body fills available width; avoid another enclosing card. Use product branding and menu evidence from the original design. Do not add breadcrumbs or a decorative title/description block by default.

Use Antd6 tokens for color, typography, borders and radius. Blocks gap 16px; inline actions gap 8px; drawer footer gap 12px. A real content card typically uses border 1px, radius 8px and padding 16px vertically/20px horizontally; avoid nested cards and duplicated padding. Card titles 16px/600, counts secondary. The current Antd6 registration spells default control size `medium`; inspect the actual contract rather than passing Antd5 `middle`. Table defaults to `large`.

## Query and list structure

Query → list toolbar/Tabs → Table → pagination. Use a four-column query grid: three visible fields and actions in column four; expand additional fields with an Antd link button, actions at the end of the final row. Keep applied values distinct from drafts. Query/reset returns to page one; reset restores defined defaults. Do not fabricate a filter prohibited by the requirement.

Use Tabs for data scopes such as All/Mine. Each Tab's content slot owns its Table, pagination and state. Shared primary action belongs in Tabs extra; one primary page action. Do not draw tab labels above a sibling table. Remove outer top padding when Tabs already supplies it.

Use real Antd6 Table columns and render slots. Status uses Badge preset plus business text; Tag is for categories. Place operations last and fixed right, size the column to visible actions, filter by permissions before collapsing secondary actions into Dropdown. Long fields use ellipsis with their full value reachable via title/Tooltip/detail. Preserve meaningful 0/false. Wide content scrolls horizontally within the table, never widens the viewport.

Default page size 20 with options 20/50/100 unless the requirement says otherwise. Sample rows and total must agree, ideally at least three pages for pagination testing. Bound Table body scrolling so pagination remains reachable within the target viewport. Do not force a tall empty card; leave bottom spacing 16px once.

## Forms and state

Use real labeled inputs, Selects, Buttons and feedback. Modals/Drawers keep the full source page behind them, close unrelated menus, and retain a reachable footer. Simple row confirmations can use Popconfirm; richer impact/preflight content uses Modal. Keep destructive or unauthorized actions gated according to the source. Loading, failure, success and recovery states belong to the actual flow; do not manufacture generic state boards or placeholder future features.

## Review

Verify structure and visuals after save/reopen. Check exact viewport, shell consistency, one padding owner, control size, readable labels, row count/page totals, fixed operations, scroll reachability, tab content ownership, long values, overlay backdrop/footer, and required state transitions. Validate both default and task-changing states. No visible implementation notes or provenance artboards; keep evidence in the sidecar report. A structurally valid component can still render incorrectly: inspect actual screenshots and exercised interactions before acceptance.
