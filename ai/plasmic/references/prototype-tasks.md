# Controlled native Page generation

Use for new full-project standalone fixed-viewport Overseas/Antd-v6 Pages covered by the [unified suite](verification.md). Focused edits and other library/layout scopes retain scoped verification. This is task-local evidence and ordering, not another persisted Studio model.

## Prepare source expectations

Call `prototype_task {action:"plan_schema"}` before preparing a new suite. Its `planSchema` is the machine-readable format for `{suite,documents}`; `planExample` contains a complete minimal suite, all four inventories and Slot-intent markup. Save each example document under the matching `suite.*.inventory` path only as a format starting point; replace its source, routes, native contracts, fields and cases from the current requirements. Pen tasks also need the declared reference inventory. `validate_plan` reports independent format errors together and points back to this public action; semantic ownership/coverage checks still apply. Do not inspect client implementation to discover formats.

Prepare suite.json and source-derived structure/forms/descriptions/overlays inventories before content. Declare every planned route in each inventory, with empty arrays for reviewed inapplicability. Each Page has path, Chinese business name, source citation and a unique `screen` identifying its logical screen in the requirement. Record types, Tabs, overlays and state frames of a source-defined shared screen stay on that Page; independently specified business flows retain their separate screen identities under [route inventory](requirement-alignment.md#inventory-before-routes). Source interpretation still needs independent review.

Each Page declares pageHeader:null by default, required native `components`, reviewed `copy:{source,excluded,help}`, and nonempty runtimeCases. Header exceptions require an explicit current user request. elementFallbacks names exact targets, verified registration gaps and source citations; apply [native component selection](libraries/index.md#native-component-selection). Review requirement explanations separately from actual field help.

Inventory applicable SearchForm `onSearch`/`onReset`, row actions and Form submit/ref actions in the reviewed bindings, with their native event arguments and affected data state. Required events cannot be empty callbacks. A nonempty callback or a state named for an action still does not prove its business effect; runtime cases must assert the query/reset result, distinct-record action, validation failure and subsequent success. Read registered rule shapes and handle hidden default Slots explicitly before freezing intent.

Use `plan_schema` for field types and complete runnable examples. The declarations below explain acceptance semantics; they are not an alternative JSON schema. Independently reviewed expectations come from the requirement, not generated output.

Each components entry declares a source-derived role and purpose before selecting its component. In this controlled library suite, role is widget (ordinary region/control), content-scope (Tabs), category (Tag or Column tag display), row-actions (ActionGroup in a reviewed fixed-right Column.render with positive width), or pagination (one native paging owner with a bound showTotal). The role is task acceptance metadata, never a Studio prop. Include every Table.Column and its field/presentation decision. Use props for partial native property constraints, dynamicProps for bound property paths, and owner:{nodeName,slot} for real registered Slot ownership. Binding paths may address nested native fields such as pagination.total. These checks do not infer source meaning from CSS or option text; independently review classification and coverage.

Inventory each active native pager as pagination; disable unneeded Table pagination. A source-required standalone Pagination names its separate dataOwner region and disables that Table's pager, so two controls cannot own the same table's paging. Retain the source decision and total/query runtime cases.

Runtime cases pin IDs, source, ordered native Preview actions and exact DOM assertions. Actions: open/close/snapshot/click/hover/fill/select/press/scroll. Pin input values, keys, deltas and target role/name, never ephemeral refs. Assertions support text/visible presence, role/name count and control value. Cover applicable query/reset, validation failure/recovery, distinct records, overlays/processing and short viewport scrolling. A read-only Page can snapshot and assert content. Only cross-Page cases awaiting an unfinished destination may be deferred:true with targetPath; every Page needs nondeferred cases.

Plan Slot-intent file paths for all routes but prepare detailed markup only for the current Page. Run verify_mcp_contract.py with --profile and --expectations suite.json before writes. The Desktop validates types, complete route coverage and duplicate logical screens at task start. Fix malformed inventories before freezing them.

## Read original Pen references

For supplied .pen files, add references.inventory to the suite. Every Page maps actual source frame IDs and state regions to planned native node names:

```json
{"pages":[{"path":"/records","references":[{"id":"default","filePath":"/absolute/source.pen","nodeId":"ACTUAL_FRAME_ID"}],"regions":[{"referenceId":"default","nodeNames":["RecordsTable"],"decision":"Keep source hierarchy with the registered table"}]}]}
```

Use original absolute files through public Pen MCP/design_reference, never shell/JSON parsing of `.pen`. Read its live schemas and advertised skill; when `read_skill` advertises `path`, use `{"path":"execute.md"}`. design_reference index discovers top-level frames with pagination. Inside the task, read current-Page frame properties at depth 1 or more, following nextOffset; include id/type/layout/width/height/padding/gap/justifyContent/alignItems. Read relevant descendants for typography/styles and acquire each frame screenshot. Layout text alone does not establish visual fidelity. Map every distinct state; consolidate only genuinely equivalent frames with a source-derived explanation.

Actual calls are archived by Desktop, with source-file and image hashes. cancel/resume retains them; changed source files invalidate reuse. An unchanged paginated read can retain its source image. Native Desktop remains the design device even for narrower references. Inspect image pixels with an image-capable reviewer; delivery of an image block does not prove perception. Without such review leave visual acceptance incomplete. Pen discovery/configuration follows the live design_reference contract.

## Start and advance

```json
{"action":"start","projectId":"PROJECT_ID","suitePath":"/absolute/task/suite.json","resourceRoot":"RESOLVED_RESOURCE_ROOT","resourceRelease":"RESOLVED_RELEASE_ID","sourceFiles":["/absolute/requirement.md"],"referenceFiles":["/absolute/source.pen"]}
```

Use prototype_task directly. sourceFiles contains original requirements or retained URL copies; referenceFiles contains original .pen files, or [] when none supplied. Start before Page content. The task archives reviewed inputs and pins the actual verification scripts under resourceRoot, then binds project/branch/build. Create planned empty Pages and the named overview; only the current Page may receive shell or business content. Keep directory names Chinese and internal nodes English PascalCase, unless the user specifies otherwise.

For each Page:

1. Read its Pen frames/screenshots and expected registered component contracts through execute read(view:contract), including source-declared widgets and cross-library dependencies omitted from a draft. Prepare current-Page Slot intent, then call begin_page with the live schema's required arguments. Its contract/intent checks must pass before content writes.
2. Generate structure, native state and events on this Page. insertHtml requires actual contract reads for every registered widget. Contract failures require correcting the operation, not weakening source expectations.
3. Save. Run verify_all.py --page /exact-route with the suite. A passing live capture automatically registers structural_check using exact model/layout/validate evidence, session/build and archived input hashes. Correct failures before continuing.
4. Acquire and inspect a current-Page get_screenshot after structural_check. Exercise native preview cases with begin_case, fresh snapshot refs, pinned actions and exact assert checks. State-specific Preview screenshots cover Tabs, overlays and processing. Saved initial-state changes are not runtime evidence and writes are blocked during active cases. cancel_case leaves the case pending for fixes.
5. review_visual records referenceId, generatedEvidenceId, matched/adapted/failed and concrete observations. Adaptation needs reason/source. Each distinct source state needs its own current screenshot; no-reference tasks use referenceId page. Recorded observations are not an independent quality verdict.
6. Close Preview and complete_page. Missing structure, image comparisons or local cases block advancement. Then begin the next Page. Run deferred cases after all Pages complete.

Shared/library or actual untracked changes invalidate affected checks. Save-only revision changes preserve them. Reopen invalidates model/runtime/image acceptance, while unchanged original reference evidence remains available. status reports pending cases and a compact nextAction; keep complete artifacts on disk.

Before each Page's final capture, review every task-owned root/descendant name, native layout component use, hidden demonstration Slot, unrequested title/copy and scroll owner. Follow the source-reviewed column widths and operation-column ownership; changing the output does not change frozen expectations. Any later mutation requires fresh structural, image and runtime evidence. Never use a weakened verifier or single-Page replay as a whole-project acceptance result.

## Recovery and completion

cancel records an incomplete task and stops design writes; it does not remove its project/baseline binding. The Desktop restores that binding after restart. resume continues the same task and source evidence. A changed reviewed input must be restored from its archived baseline or passed through revise. revise permits additive checks only, retaining routes and every original expectation; it invalidates affected acceptance. It cannot delete dynamic bindings, change rules to match output or rewrite original requirements/verifiers. Implementation Slot intents can be revised while preserving named source targets and all business expectations; the affected Page must pass fresh checks. Prepare intent from actual component contracts before begin_page.

Use open_design with the bound projectId and reopen:true to save/reload in a new editor session. Cross-project/dashboard navigation is blocked during the task; inspect libraries using fromProject. After reopen repeat structural/image/runtime checks. Run full verify_all, then finish; all Pages, deferred cases, save/reopen and a matching full report are mandatory.

Audit actual evidence with `python3 RESOURCE_ROOT/scripts/verify_page_sequence.py EVIDENCE_DIRECTORY --report /absolute/task/sequence.json`. Report recorded_checks_complete only when finish and this audit pass. Otherwise report generated/saved with acceptance incomplete and concrete failed/pending checks. Source interpretation and independent visual quality remain separate. Keep only current route/IDs, decisions, evidence paths and pending cases across [context compaction](context-reading.md); never reconstruct a success timeline.
