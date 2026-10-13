# Layout

## Viewport and scroll ownership

Use the live Studio Desktop device preset for PC requirements (currently 1440x1024); discover it through read.devicePresets rather than assuming a viewport. Explicit user dimensions take precedence. Keep only Desktop preview columns in Pages and one overview Arena referencing the existing routed Pages. Do not add per-page duplicate Arenas, test pages, mobile breakpoints or responsive overrides to PC-only scope.

For an explicitly fixed desktop design viewport WxH, keep the preview/artboard WxH and use the required minimum width only when that fixed-width contract is intentional. For a fluid application, the Page and shell fill the available width with minWidth:0; do not turn the current screenshot width into a permanent minimum. A viewport-bound shell uses height:100vh with minHeight:0 and fills its Page root; content-driven pages use natural height. A shorter live preview must fit its real viewport without making fixed navigation scroll away. Percentage widths alone can shrink inside a theme wrapper: inspect the full ancestor sizing chain. Verify the shell starts at (0,0), fills the viewport and keeps navigation/header fixed while content scrolls.

Use one bounded content region as the vertical scroll owner through the shared Scrollbar contract. Tables grow naturally with rows and pagination unless the requirement explicitly requests a bounded table viewport; do not add nested table-body scrolling or enlarge the artboard to reach pagination. Preserve horizontal scrolling and fixed columns when the actual table contract requires them. Verify flex/min-height sizing and reachability at the target viewport.

## Library and theme ownership

Read the [library index](../libraries/index.md) before selecting shell, layout or surface components. Reuse the actual host shell when it owns navigation; a standalone page uses the chosen library's supported shell composition. Library-specific geometry, padding, tokens, control sizes, Card ownership and spacing recipes belong to that library's index/components. Read those rules only when the project's actual registrations match; do not introduce an Antd component solely to satisfy a generic layout task.

Give each surface/edge one spacing owner, preserve complete business content and approved density, and use the selected library's real theme/style APIs. Verify model ownership, rendered geometry, long/empty content and scroll behavior independently, then save/reopen and recheck after edits.

## Structure and layout choice

Choose the smallest layout that expresses the content relationship. A row or column arranges related siblings; a grid aligns repeated columns and mixed spans; a surface groups a business region; a shell owns navigation and the page's bounded content. Layout wrappers do not introduce another surface or title. Keep semantic reading order in the authored tree, including conditionally visible content. Use the selected library's actual layout components and Slots; native semantic grouping is appropriate when it does not imitate an available library surface.

Do not use absolute positioning for ordinary forms, toolbars, summaries or page columns. Reserve overlays/absolute placement for an actual overlay or anchored decoration. Do not use blank nodes, line breaks, transforms or negative margins to repair flow. Remove redundant wrappers when they have no remaining semantic, layout, Slot or interaction responsibility; preserve node identity and expression references when moving existing content.

## Width, height and flex sizing

Define each region as content-sized, fixed, constrained or filling remaining space. A flex child with long text, controls or a table usually needs minWidth:0 to shrink; a bounded vertical flex chain needs minHeight:0 so its assigned scroll region can shrink. A child's height:100% requires a bounded parent; a missing height anywhere in the ancestor chain cannot be repaired by adding more percentages. Keep fixed toolbars/footers from shrinking and let the business body take the remaining space.

Controls fill their assigned field width when the layout requires it. Short action groups retain content width and do not stretch buttons to occupy leftover space. Keep fixed sidebars and operations at their required size; flexible main content absorbs the remainder. Use supported max-width constraints for readable detail/form content, centered or start-aligned according to the design. A tall empty card or a fixed-height form that clips new errors is not a spacing solution.

## Alignment and spacing ownership

Use the containing layout's supported gap/gutter for sibling spacing and the surface's padding for its inset. Inspect component-owned margins first: do not combine a parent gap with a child's existing bottom margin on the same boundary. Different libraries' spacing APIs and defaults must be read independently. Numeric spacing values come from the approved design, the selected library's tokens or its documented composition convention, rather than a universal hard-coded scale.

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
