# Layout

## Admin content entry

Inside an admin AppShell, start with the actual filters, form, Tabs, summary or data region. Do not add a standalone Page title/header, hero, subtitle or explanatory intro. The shell already owns navigation and breadcrumbs. This applies to list, create/edit and detail Pages. Only an explicit current user request for that area permits it; a template, Pen frame or generic detail-header recipe does not opt in. Keep entity names as real information fields and actions in functional toolbars. Legitimate section, Table/Card, Form group, Descriptions and Modal titles remain with their native owners; they do not justify a redundant Page heading.

Assess Header necessity before return navigation/actions; record the assessment in the task plan. Generic page-type titles (e.g. “券模板详情”), repeated record names/status/metadata, or actions alone do not justify a Header. Keep fields in their information group; shared actions in Tabs extra/page toolbar and region actions with their region, using registered Slots. Identity and decision-critical state across Tabs may justify proposing a Header, but the explicit-user-request rule still applies. Preserve explicit Header choices without unnecessary duplication; verify orientation, fields and action scope across Tabs in Preview.

Then choose return navigation:
- With an explicitly requested Header, put any needed return action inside its heading row using the library's composition; no separate return row/footer.
- Otherwise use existing shell/host breadcrumbs. Verify their parent/list route is clickable and correct; repair bindings and omit standalone “返回”/“返回列表”.
- Only without usable parent navigation, when the flow needs it, place one registered return action in the existing action area. Never create a Header, Card, footer or full-width return-only surface.

Form Cancel, previous-step and close keep their workflow semantics. Remove redundant return controls and empty wrappers/spacing across the whole page. Test the parent destination, direct entry and required list-state restoration in Preview; screenshots prove placement only.

Keep requirement rationale, P0/P1 scope, implementation/API notes, acceptance instructions and simulation controls in task evidence. Permission simulation switches and current-role debug badges are also outside the page; express record access through the relevant actions and fields under one current user, following [permission presentation](permissions.md#presentation-without-simulation-controls). UI copy consists of actual labels/data/actions, concise field help and actionable feedback needed by the product user. Interpret a requirement's behavior; do not paste its explanatory sentences into the page. Source-reviewed copy and native component mappings are checked with the [structural inventory](../requirement-alignment.md#presentation-copy-and-native-components).

## Standalone AppShell golden boilerplate

The shared Overseas/Antd-v6 AppShell owns its outer width, viewport height, viewport minimum height, zero minimum width and non-shrinking flex sizing. Its inline height uses Studio's authored `--viewport-height`, falling back to `100vh` in Preview and exported applications; registration defaults remain `width:100%; height:100vh`. This prevents auto-growing Studio iframes from feeding their measured content height back into the shell. Navigation stays visible and business cards, forms and tables grow naturally inside its bounded content region. Studio's per-user "Show full page height" canvas view sets `--canvas-content-height:auto`; the shell then grows with its content, keeps the authored viewport as its minimum and stops scrolling its content region. That view is canvas-only and does not change the saved design, Preview or exports, so verify bounded scrolling with the view turned off.

Keep the Page root created by `createComponent`, including its default vertical layout and `width:stretch; height:stretch`. Insert AppShell directly into that existing root without another sizing wrapper. AppShell does not depend on an ancestor height chain, so do not add Page-root viewport-height overrides or percentage-height shell overrides. Ordinary Pages retain their normal layout and scroll contract. Reuse the host shell when it already owns navigation.

The outer div below represents the actual Page root, not an extra child wrapper. Replace the imported project ID and menu with the live registration and reviewed route inventory; insert business content in `children`.

```html
<div style="display:flex;flex-direction:column;width:stretch;height:stretch">
  <plasmic-component data-plasmic-component="plasmic-overseas-app-shell"
    data-plasmic-project="IMPORTED_PROJECT_ID" data-plasmic-name="AppShell"
    data-props='{"menuItems":[{"key":"records","label":"记录","href":"/records"}]}'>
    <slot name="children"><div style="width:100%;min-width:0">Business content</div></slot>
  </plasmic-component>
</div>
```

AppShell fills its containing width rather than using `100vw`. Keep its Page and any necessary theme-provider wrappers at the available width with no outer padding or margin. Check the installed library version and saved instance styles: new instances inherit the imported definition's saved defaults, which can differ from current host registration defaults. Upgrading a dependency does not establish that existing instance dimensions changed. For fluid shells, replace stale fixed instance dimensions with the verified `width:100%; height:100vh` contract. Inspect actual geometry: clipping or a matching artboard size alone does not prove viewport fill.

## Viewport and scroll ownership

Use the live Studio Desktop device preset for PC requirements (currently 1440x1024); discover it through read.devicePresets rather than assuming a viewport. Explicit user dimensions take precedence. Keep only Desktop preview columns in Pages and one overview Arena referencing every existing routed Page exactly once. Use `createComponent` defaults for new Pages; inspect returned project `pageFrames` and `canvases`. Viewport testing at a shorter height does not add another device column or artboard. Do not add per-page duplicate Arenas, test pages, mobile breakpoints or responsive overrides to PC-only scope.

For an explicitly fixed desktop design viewport WxH, keep the preview/artboard WxH and use the required minimum width only when that fixed-width contract is intentional. For a fluid application, the Page and shell fill the available width with minWidth:0; do not turn the current screenshot width into a permanent minimum. A shorter live preview must fit its real viewport without making fixed navigation scroll away. Verify the shell starts at (0,0), fills the viewport and keeps navigation/header fixed while content scrolls.

For a standalone application using the shared Overseas/Antd-v6 AppShell, viewport height belongs to the component's outer DOM element. Its internal Layout fills that height, and the header/sidebar remain stationary while business content scrolls. A default vertical Page root or an auto-height theme wrapper does not need a fixed height to support this shell. Do not change generic Page creation, stretch business cards, or enlarge the artboard to establish shell height. Content embedded in an existing host follows that host's own sizing and scroll ownership.

Use one bounded content region as the vertical scroll owner through the shared Scrollbar contract. Tables grow naturally with rows and pagination unless the requirement explicitly requests a bounded table viewport; do not add nested table-body scrolling or enlarge the artboard to reach pagination. Preserve horizontal scrolling and fixed columns when the actual table contract requires them. Verify flex/min-height sizing and reachability at the target viewport.

Inspect default overlay trigger Slots as well as business content. An externally controlled Modal must not leave an unused default trigger outside AppShell. Such siblings still add document height even when the shell itself is correctly sized; clear unused Slots and fix ownership rather than growing the Desktop artboard.

### Viewport shell height acceptance

Before accepting each affected standalone shell page:

1. Read the Page model and check one root and exactly one registered AppShell, with business content in its own Slot. No explicit root height or instance dimension is required: the shared AppShell owns viewport sizing. Keep the business body content-sized; do not stretch cards or add blank content to make the shell appear taller. After a subsequent content edit, remeasure the shell rather than repairing ancestor heights.
2. At the required artboard, compare the actual AppShell outer box, internal Layout and sidebar with the frame: top=0 and bottom=viewport height, within 1 CSS px. AppShell and Layout must also reach left=0 and right=viewport width; the sidebar retains its own width. Reject gaps and overflow. Root overflow:hidden and a matching document contentHeight can conceal an oversized child; measure its actual box, including the Studio selection bounds, rather than its clipped visible portion. Record page/frame identity, viewport and measured boxes. Check both short content and a populated long table.
3. In real Preview, repeat at a width larger than the design artboard, a shorter height and with overflowing content. This distinguishes fluid sizing from fixed dimensions that happen to match the artboard. The shell follows the viewport, navigation/header stay in place, the content region owns vertical scrolling and the last action remains reachable. A resized static screenshot does not test a different live viewport.
4. After an authorized edit, save/reopen, reread the affected Page and repeat the geometry check. For an explicitly requested shell/editor regression, additionally test a subsequent content edit using [engineering verification](../engineering/component-contracts.md). Ordinary delivery and read-only review do not introduce artificial edits. Missing geometry or untested Preview scrolling remains unverified; general model/rendering checks do not establish viewport fill.

For the shared Overseas/Antd-v6 AppShell, run [verify_shell_height.py](../../scripts/verify_shell_height.py) from resourceRoot against a full read of one Page and its component-targeted snapshot_layout JSON:

```sh
python3 scripts/verify_shell_height.py page-read.json page-layout.json
```

The gate rejects a missing/ambiguous Page root, shell or snapshot, a rendered shell/Layout that does not fill the viewport width, and a shell/Layout/sidebar that does not fill its height. It checks model structure and actual artboard geometry, without requiring authored ancestor heights or instance sizing styles. Wider Preview, subsequent-edit regression, Preview scroll and save/reload checks above still require separate evidence. Full-project generation checks every routed shell Page separately; one passing page does not pass its siblings. Other shell libraries use their verified registrations and rendered structure with the same geometry acceptance criteria.

## Library and theme ownership

Read the [library index](../libraries/index.md) before selecting shell, layout or surface components. Reuse the actual host shell when it owns navigation; a standalone page uses the chosen library's supported shell composition. Library-specific geometry, padding, tokens, control sizes, Card ownership and spacing recipes belong to that library's index/components. Read those rules only when the project's actual registrations match; do not introduce an Antd component solely to satisfy a generic layout task.

Give each surface/edge one spacing owner, preserve complete business content and approved density, and use the selected library's real theme/style APIs. Verify model ownership, rendered geometry, long/empty content and scroll behavior independently, then save/reopen and recheck after edits.

## Structure and layout choice

Implement the Page's decided [structure](page-structure.md), using its [page type](page-types.md) as a starting skeleton when applicable. Choose the smallest layout that expresses the content relationship. A row or column arranges related siblings; a grid aligns repeated columns and mixed spans; a surface groups a business region; a shell owns navigation and the page's bounded content. Layout wrappers do not introduce another surface or title. Keep semantic reading order in the authored tree, including conditionally visible content. Use the selected library's actual layout components and Slots; native semantic grouping is appropriate when it does not imitate an available library surface.

Do not use absolute positioning for ordinary forms, toolbars, summaries or page columns. Reserve overlays/absolute placement for an actual overlay or anchored decoration. Do not use blank nodes, line breaks, transforms or negative margins to repair flow. Remove redundant wrappers when they have no remaining semantic, layout, Slot or interaction responsibility; preserve node identity and expression references when moving existing content.

## Width, height and flex sizing

Define each region as content-sized, fixed, constrained or filling remaining space. A flex child with long text, controls or a table usually needs minWidth:0 to shrink; a bounded vertical flex chain needs minHeight:0 so its assigned scroll region can shrink. A child's height:100% requires a bounded parent; a missing height anywhere in the ancestor chain cannot be repaired by adding more percentages. Keep fixed toolbars/footers from shrinking and let the business body take the remaining space.

Controls fill their assigned field width when the layout requires it. Short action groups retain content width and do not stretch buttons to occupy leftover space. Keep fixed sidebars and operations at their required size; flexible main content absorbs the remainder. Page content fills the shell content area; a max-width constraint needs an approved design or requirement. A tall empty card or a fixed-height form that clips new errors is not a spacing solution.

## Alignment and spacing ownership

Use the containing layout's supported gap/gutter for sibling spacing and the surface's padding for its inset. Inspect component-owned margins first: do not combine a parent gap with a child's existing bottom margin on the same boundary. Different libraries' spacing APIs and defaults must be read independently. Numeric spacing, width, size and type values come from the approved design or requirement; without one, use the [admin design scale](scale.md).

Align labels, controls, supporting text and actions by their roles. Use baseline alignment for mixed text where appropriate; center alignment suits compact controls, while multi-line descriptions generally align to the start. Align a toolbar to its content region, not to an arbitrary label glyph. Inspect the actual rendered border/body edge before measuring insets. Conditional content must not leave an unexplained empty column, duplicated divider or missing final bottom inset.

## Content overflow and media

Choose overflow per content role before layout: required identifiers and instructions remain complete through wrapping or a verified access mechanism; an approved one-line summary may ellipsize with the actual library's complete-content interaction. Do not truncate data strings to fit a screenshot. Preserve valid zero/false and distinguish missing values according to the requirement. Long URLs, names, translated labels and unbroken codes must not widen the Page or cover adjacent actions.

Keep images at their intended aspect ratio using the supported fit contract; do not distort them by forcing unrelated width and height. Reserve meaningful media dimensions to avoid layout jumps when images load or fail. Check fallback/empty content and text alongside the image. Repeated cards/list rows use stable content structure, but do not force equal content heights by clipping required text.

## Responsive requirements

Responsive behavior is conditional on task scope. For a fluid or multi-device task, derive reflow thresholds from the minimum usable widths of its real content. Reduce column count, stack related regions and allow action wrapping before controls collide; do not shrink fonts to preserve a desktop screenshot. Preserve reading/tab order after reflow and keep the primary action reachable. Use the target library's registered breakpoint/column contract or the project's existing responsive styling system. Do not create another breakpoint model.

For PC-only work, verify the requested desktop viewport and the actual shorter Preview height, without adding unrequested mobile variants. For responsive work, test the required smallest/largest widths and near each authored reflow boundary; include the longest labels, populated multi-selects, expanded filters, validation errors and open overlays. Table horizontal scrolling may be intentional; unexpected document horizontal scrolling is a failure.

## Sticky regions, overlays and acceptance

Sticky/affixed regions belong to the correct scrolling ancestor and must leave room for their real height. Do not cover the last row, anchor target, form error or footer with a fixed toolbar. Portal overlays must stay reachable within the actual viewport and follow the owning component's placement/stacking contract; increasing arbitrary z-index values is not a substitute for checking ownership. Application scroll regions use the shared Scrollbar; when a native/virtualized component requires a wrapper, reuse an existing integration with that Scrollbar. Do not create a parallel plain-element scrollbar or wrap it in a second scrolling element. Preserve a Table's supported horizontal scrolling through its actual contract.

Record region ownership, sizing, spacing boundaries and required reflow/overflow behavior before editing. Verify normal, long, empty, loading, hidden-section and error-expanded content where those states exist. Measure relevant ancestor and component edges in real Preview, test both scroll axes and reachable actions, and save/reopen to verify persisted Props/Slots and layout. Model validity and one static screenshot do not prove shrink, scroll or responsive behavior. Apply [keyboard and focus rules](accessibility.md) to the same delivered layout.
