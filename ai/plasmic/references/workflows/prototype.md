# Product prototype workflow

Resolve Team → Workspace → Project through [project management](../desktop-management.md), then reread identity and schemas. Edits require canEdit.

## Resolve scope and contracts

Read the actual source and [requirement alignment](../requirement-alignment.md). Freeze source-derived routes, fields, actions, native component mappings and UI-copy decisions outside the UI. Follow [context reading](../context-reading.md) for complete source coverage with bounded tool results.

For admin work read [admin design](../admin-design.md), [templates](../admin-templates.md) and [catalog](../templates/admin/catalog.json). Apply [content entry](../design/layout.md#admin-content-entry): no standalone Page title/header/subtitle/intro, including detail Pages, unless explicitly requested by the current user. Requirement/process explanations stay outside UI; retain real field help. Required tables, submitted fields and labeled read-only groups use registered Table/Column, Form/Item and Descriptions/Item. Card needs its own business surface; it is not a default region wrapper.

Before markup, follow [native component selection](../libraries/index.md#native-component-selection): discover existing business/library components by role, read candidate contracts, then choose components/compositions. Apply this to every functional widget, including actions, Tabs, feedback and overlays. Read only selected recipes and live Props/Slots/events/scopes. Install/upgrade required published libraries, then reread contracts. Report actual template reuse. Stability work reads [reproducibility](../reproducibility.md).

Before business writes run `python3 RESOURCE_ROOT/scripts/verify_mcp_contract.py --profile "/absolute/Desktop user-data" --report /absolute/task/mcp-contract.json`. Resolve build/resource capability mismatches before dependent generation; do not guess parameters or extend the platform during ordinary design work.

## Complete one Page at a time

New full-project generation of standalone fixed-viewport Overseas/Antd-v6 Pages must read and use the [controlled task](../prototype-tasks.md) and [unified verifier](../verification.md). Focused edits, host-owned/content-growing layouts and other library scopes use scoped checks and report unsupported coverage.

Plan routes, source-reviewed regions/behavior, runtime cases and current-Page Slot intent before content. Supplied .pen files require actual design_reference frame reads, paginated layout properties, screenshots and Page/state mappings before begin_page; filenames and HTML alone are insufficient. Follow the task contract for source pinning and phase commands.

Create planned empty native Pages first, with source-reviewed Chinese business names. Set page_layout.overviewName and rename the automatic group through updateCanvas before content. Follow [directory/node naming](../design/naming.md): Chinese directory names, English PascalCase internal nodes; explicit user language/name choices prevail. With no device request use one native Desktop column and one shared overview containing each Page UUID once; check devicePresets/pageFrames/canvases. Shorter viewports add no mobile columns. Reuse one [shell/layout](../design/layout.md) and appropriate [icons](../design/icons.md).

For the current Page:

1. Announce its route; build native editable structure and real states/events together. `data-props` is JSON; use supported expressions and actual scopes. Query results/totals must consume query state. Editable SQL uses an editor/TextArea, numeric bounds use InputNumber; `<pre>` is read-only. Mock data still needs working frontend effects and validation.
2. Save, then run verify_all with `--page /exact-route` and the reviewed suite. Correct failures before advancing. Run its mandatory gates. Missing expectations remain unverified.
3. Capture and **open** current Page pixels using [rendered inspection](../desktop-inspection.md). Compare hierarchy, copy, actual headers/rows and spacing with the source; inspect Tabs/overlays in their real states. A successful capture or data prop does not prove visible content.
4. Exercise source-pinned cases through top-level native `preview`, using fresh snapshot refs and actual DOM assertions. Cover applicable query/reset, validation recovery, two records, processing and [short-viewport shell scrolling](../design/layout.md#viewport-shell-height-acceptance). Close Preview before edits. Collect state images before the final review_visual, then complete_page; follow the task contract for deferred cases.

Do not write sibling business content until this Page's structure, image comparison and local runtime cases pass. Report failed/unavailable checks as pending. Preserve UUIDs/references when moving or renaming.

## Final acceptance

Save explicitly; leave/reopen in a new editor session and repeat affected model/image/runtime checks. Run the verifier without --page for the full project, finish the controlled task and audit its actual events as specified in the task contract. Reuse captures only with matching identity/build/hashes. Report source/resource versions, actual reuse, mock/API boundaries, evidence and limitations. Static checks and recorded observations do not independently prove visual fidelity or source interpretation.
