# Product prototype workflow

Resolve Team → Workspace → Project through [project management](../desktop-management.md), then reread identity and schemas. Edits require canEdit.

## Resolve scope and contracts

Read the actual source and [requirement alignment](../requirement-alignment.md). Freeze source-derived routes, fields, actions, native component mappings and UI-copy decisions outside the UI. Follow [context reading](../context-reading.md) for complete source coverage with bounded tool results.

For admin work read [admin design](../admin-design.md), [templates](../admin-templates.md) and [catalog](../templates/admin/catalog.json). Apply [content entry](../design/layout.md#admin-content-entry): no standalone Page title/header/subtitle/intro, including detail Pages, unless explicitly requested by the current user. Requirement/process explanations stay outside UI; retain real field help. Required tables, submitted fields and labeled read-only groups use registered Table/Column, Form/Item and Descriptions/Item. Card needs its own business surface; it is not a default region wrapper.

Before markup, follow [native component selection](../libraries/index.md#native-component-selection): classify source roles, discover candidates and read the applicable composition before choosing components. Include native display presets, actions, feedback and cross-library dependencies. Record roles, key props and Slot owners in the source inventory. Install required libraries and read their actual contracts before freezing intent. Report actual template reuse. Stability work reads [reproducibility](../reproducibility.md).

For Overseas/Antd-v6 list scopes, read [query/list composition](../libraries/overseas/compositions/search-table.md) before choosing the switch or freezing the inventory. Content scopes use Tabs; Radio.Group selects a field value.

After preparing the source suite, run `python3 RESOURCE_ROOT/scripts/verify_mcp_contract.py --profile "/absolute/Desktop user-data" --expectations /absolute/task/suite.json --report /absolute/task/mcp-contract.json`. Correct contract/inventory failures before business writes.

## Complete one Page at a time

New full-project generation of standalone fixed-viewport Overseas/Antd-v6 Pages must read and use the [controlled task](../prototype-tasks.md) and [unified verifier](../verification.md). Focused edits, host-owned/content-growing layouts and other library scopes use scoped checks and report unsupported coverage.

Plan logical screens, routes, source-reviewed regions/behavior and runtime cases before content. Each Page declares a unique source `screen`; record types, Tabs and overlays of that screen remain states of one Page. Prepare detailed Slot intent only for the current Page. Supplied .pen files require actual design_reference frame reads, paginated layout properties, screenshots and Page/state mappings before begin_page. Follow the task contract for source pinning and phase commands.

Start the controlled task before creating planned empty native Pages. Use source-reviewed Chinese business names; set page_layout.overviewName and rename the automatic group through updateCanvas. Follow [directory/node naming](../design/naming.md): Chinese directory names, English PascalCase internal nodes; explicit user choices prevail. Use one native Desktop column by default and one overview containing every Page once. Compose the [shell/layout](../design/layout.md), [icons](../design/icons.md) and business content only for the current Page.

For the current Page:

1. Announce its route; build native editable structure and real states/events together. `data-props` is JSON; use supported expressions and actual scopes. Query results/totals must consume query state. Editable SQL uses an editor/TextArea, numeric bounds use InputNumber; `<pre>` is read-only. Mock data still needs working frontend effects and validation.
2. Save, then run verify_all with `--page /exact-route` and the reviewed suite. Correct failures before advancing. Run its mandatory gates. Missing expectations remain unverified.
3. Capture and **open** current Page pixels using [rendered inspection](../desktop-inspection.md). Compare hierarchy, copy, actual headers/rows and spacing with the source; inspect Tabs/overlays in their real states. A successful capture or data prop does not prove visible content.
4. Exercise source-pinned cases through top-level native `preview`, using fresh snapshot refs and actual DOM assertions. Cover applicable query/reset, validation recovery, two records, processing and [short-viewport shell scrolling](../design/layout.md#viewport-shell-height-acceptance). If preview fails, keep this Page's runtime acceptance incomplete and report its error; do not substitute reference browsing/import/capture or saved-state edits. External reference tools are available only in a ready, editable project's edit page, for actual external sources. Close Preview before edits. Collect state images before the final review_visual, then complete_page; follow the task contract for deferred cases.

Do not write sibling business content until this Page's structure, image comparison and local runtime cases pass. Report failed/unavailable checks as pending. Preserve UUIDs/references when moving or renaming.

## Final acceptance

Save explicitly; use open_design with the same projectId and reopen:true for a fresh session, then repeat model/image/runtime checks. Run the full verifier, finish the task and audit its actual events. Reuse captures only with matching identity/build/hashes. Report recorded_checks_complete only after finish and the sequence audit pass; otherwise state “generated/saved; acceptance incomplete” with failures. Report source/resource versions, reuse, mock/API boundaries, evidence and limitations. Static checks do not prove visual fidelity or source interpretation.
