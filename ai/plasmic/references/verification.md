# Unified prototype verification

Use [verify_all.py](../scripts/verify_all.py) from the resolved `resourceRoot` for full-project checks of standalone fixed-viewport Pages against the supported Overseas/Antd-v6 contracts. It runs native model validation, rendered layout, structural/device/region gates and supplied-reference coverage; it does not derive expected behavior from generated models, save, publish, switch projects or exercise Preview. During generation use `--page /exact-route` for each Page before advancing; omit it for final full-project acceptance. Use focused individual gates for a local edit or mixed-library scope that does not fit these full-project checks.

## Reviewed suite configuration

Create a task-local `suite.json` from independently reviewed requirements. All file paths below resolve relative to that file. Keep the Page/field/menu inventories in their existing gate formats. Example:

```json
{
  "structure": {"inventory":"structure-expectation.json"},
  "page_layout": {},
  "forms": {"inventory":"form-inventory.json"},
  "descriptions": {"inventory":"description-inventory.json"},
  "overlays": {"inventory":"overlay-inventory.json"},
  "slots": {"pages":[{"path":"/records","intent":"records-intent.html"}]},
  "shell_height": {},
  "references": {"inventory":"reference-inventory.json"}
}
```

- `structure` also rejects Tables without real Column nodes or data, Columns without dataIndex/render content, and Cards containing only SearchForm/Steps. Required `components` independently check native region identities even when no Table/Form/Descriptions was generated. The [presentation/copy declarations](requirement-alignment.md#presentation-copy-and-native-components) reject recognized unrequested Page-heading areas and declared excluded literal process copy, and verify reviewed help text/bindings. They do not infer every visual heading or interpret arbitrary prose/dynamic messages. It checks routes, the static Overseas menu tree and declared bindings against [source expectations](requirement-alignment.md#structural-gate). Each Page must declare source-derived `bindings`. Use `dynamicProps`/`propStateDependencies` for data that must react to filters, `controls` for required editable fields/bounds/events, and `rowActions` for actual controls inside Column.render. These are static wiring checks, not proof of expression semantics. A purely static Page uses `bindings:[]` with a reviewed `bindingsNotApplicable` reason; omission fails.
- `structure` rejects authored raw controls/tables/dialogs, interactive ARIA roles and plain-element click targets unless a source-reviewed `elementFallbacks` entry names that exact widget. Invalid/unused exceptions fail. Plain content, containers and genuine links remain valid; a fallback never overrides a required native identity. CSS-only imitations and the truth of contract-gap reasons still require review. See [component selection](libraries/index.md#native-component-selection).
- `page_layout` always runs, defaulting to the live Desktop preset and overviewName 页面总览. Set overviewName to the source-reviewed Chinese business group name (or an explicit user-chosen name); wrong/default English names fail. It compares every Page device column size, requires one shared overview containing each Page reference exactly once, and rejects overlapping/wrong-size frames. For explicitly requested multiple devices set `{"presets":["Desktop","EXACT_NATIVE_PRESET"]}`. Source-defined business variants are separate from device sizes.
- `forms` inventories **every** Page, including `forms: []`, as described in [Form acceptance](libraries/antd_v6/components/form.md#project-inventory-and-acceptance).
- `descriptions` and `overlays` inventory every Page and check its regions using [Descriptions](libraries/antd_v6/components/descriptions.md) and [overlay policy](libraries/antd_v6/compositions/modal-drawer.md). An empty group/overlay list still checks that none exist on that Page.
- `model: {}` is automatic and mandatory: fresh native validate must report literal valid:true, no errors and the exact scoped Page IDs. Warnings are retained for review. This proves native invariants only.
- `rendering: {}` is automatic and mandatory: each scoped Page needs one ready, complete full snapshot with positive viewport dimensions and explicit image/problem lists. Reported clipping-aware overflow or unloaded images fail. Intentional table scrolling is not itself an overflow failure. Pixels and hidden states still need review.
- Full-suite structure inventories must declare each selected Page's directory name (checked against overview/full readbacks), pageHeader, required native components and copy review; missing declarations fail even outside a controlled task. Explicit authored node names are checked for PascalCase and duplicates; unnamed/default nodes and naming meaning require review.
- `slots` requires nonempty named component intent, rejects duplicate component and direct Slot names, and checks native Slot ownership for every named planned component, ignoring intervening layout markup. Full-project suites require all Pages; focused edits use the individual checker. Nonblank text is valid Card content; whitespace alone is empty. Prepare intent before content generation; do not copy actual readback to pass.
- `references` is required when the original prompt supplies Pen references. It checks actual Pen MCP layout/image evidence and semantic native-node mappings using [controlled task evidence](prototype-tasks.md#read-original-pen-references). Omit it only when the task has no supplied design references; no-reference status does not establish visual fidelity. It cannot be exempted based on omitted reads.
- `shell_height: {}` checks **every routed Page** and its targeted snapshot. Use this only for a project of standalone supported shells. AppShell owns viewport sizing; default Page roots and instances without dimension overrides are valid. The gate checks one root, one registered shell and actual shell/Layout/sidebar geometry rather than an ancestor CSS height chain. Ready/truncated flags must be literal booleans; viewport height and measured shell coordinates/heights must be finite numbers with positive heights. It does not establish Preview scrolling or persistence.

Forms accept Page `path`, unique `name`, or `componentUuid`. The suite also resolves those selectors for descriptions, overlays and slots. Multiple selectors must agree; no fuzzy name matching, route normalization or silent UUID fallback is performed. Reusable inventories should omit environment-specific UUIDs.

Structure and page_layout cannot be exempted in a routed-page project. Slots cannot be exempted when captured Pages contain component instances; checking other inventories is not a reason to skip Slot ownership. Reports always carry `acceptance.status:"unverified"` until source interpretation, actual Preview and save/reopen have separately been reviewed. A green automated result alone never proves complete acceptance.

Full suites require source-reviewed inventories for **forms, descriptions and overlays**, including explicit empty lists on Pages with none. Project-wide `notApplicable` for these gates fails even when no component was generated: omission cannot establish source inapplicability. For a different component library use its focused checks and report unsupported coverage. Model/rendering/structure/page_layout also cannot be exempted. Slots may be inapplicable only without component instances; shell_height may use `{"notApplicable":"Reviewed reason and scope"}` only without supported shells. Omitted gates are `unverified` and make the run incomplete.

Do not exempt a failing or dynamic menu merely to get a green report: dynamic role/state navigation still requires separate exercised evidence. For the supported recursive role-query transform, declare `navigation.roleQuery` with the reviewed `state`, `query` and `default` names/value alongside the independent literal `items`. The structure gate proves the entire recognized transform against that inventory without executing JavaScript; changed targets, labels, hidden/disabled flags, item type, icon, order, recursion, encoding or fallback precedence fail. Static menus retain the same registered fields; unsupported properties and unresolved bindings fail instead of being projected away. This transform requires literal hrefs without an existing query or fragment. Operator boundaries and line-terminator semantics remain significant; normalization must not turn invalid or changed JavaScript into the reviewed program. Unknown transforms remain statically unverified: report the unsupported expression and retain separate runtime evidence. Ordinary design tasks do not extend the checker or relabel failure as success; checker extensions and their tests belong to explicitly authorized platform work.

## Slot intent granularity

Intent records the components and **direct Slots you supply**, plus relevant ownership. It need not repeat CSS, IDs, complete data, expressions or every native text element. Declare every supplied nonempty Slot, including Button.children and Column.render; an omitted nonempty actual Slot is reported as an unprovided default. For example, this describes a table action's ownership without cloning generated markup:

```html
<plasmic-component data-plasmic-name="RecordsTable" data-plasmic-component="plasmic-antd6-table">
  <slot name="children">
    <plasmic-component data-plasmic-name="NameColumn" data-plasmic-component="plasmic-antd6-table-column"></plasmic-component>
    <plasmic-component data-plasmic-name="ActionColumn" data-plasmic-component="plasmic-antd6-table-column">
      <slot name="render">
        <plasmic-component data-plasmic-name="ViewRecord" data-plasmic-component="plasmic-antd6-button">
          <slot name="children">查看</slot>
        </plasmic-component>
      </slot>
    </plasmic-component>
  </slot>
</plasmic-component>
```

For a full Page, place this within the planned AppShell.children and include its other participating components/Slots. A name-only AppShell/Card/Table outline omits supplied Slot content and cannot establish acceptance. Native Form, Descriptions and overlay inventories independently verify fields and content; passing Slot ownership does not replace them.

## Collect and verify

Open the intended project in the signed-in Desktop first. `--profile` is its **user-data directory**, containing `mcp-connection.json`, not the suite configuration or a named preset. Live collection uses the same authenticated local RPC as Desktop MCP on macOS/Linux. Keep the connection file private; the runner does not copy its token into evidence.

```sh
python3 RESOURCE_ROOT/scripts/verify_all.py \
  --project-id PROJECT_ID \
  --profile "/absolute/path/to/Desktop user-data" \
  --expectations /absolute/path/to/suite.json \
  --output /absolute/path/to/new-verification-run
```

With `--page /exact-route`, the same suite/inventories may include planned sibling Pages: collection reads only this Page and its layout, region/Slot checks select this Page, while global routes/device/overview checks still run. Evidence records pagePath; a scoped capture cannot pass final full-project acceptance or be reused across scopes. Run `--help` for invocation; do not read checker implementation to discover ordinary usage.

After each Page gate, call get_screenshot for this Page and open the returned image. Record visible headers/rows, hierarchy, duplicate surfaces/titles and any clipping; then exercise Preview actions. Screenshot acquisition and App inspection feedback prove collection only, not visual approval. Failed or missing visual/runtime evidence prevents Page completion.

Supported full generation uses the [controlled task](prototype-tasks.md). Desktop intercepts real mutation calls and blocks cross-Page business writes before execution. It records actual reference/model/layout/image/runtime calls; do not write a retrospective timeline or a passed:true review file. A successful live --page verifier automatically registers structural_check using matching native read signatures. Source edits, stale builds/sessions, altered images/reports and missing runtime case outcomes block advancement. Offline replay does not register a live checkpoint.

During a task, the capture includes a hash-pinned reference-evidence.json snapshot of the actual Desktop recording. After save/reopen, Page checks and the final full report, call prototype_task finish, then audit its evidenceDirectory with `python3 RESOURCE_ROOT/scripts/verify_page_sequence.py /absolute/Desktop/prototype-runs/RUN_ID --report /absolute/task/page-sequence.json`. The script consumes actual Desktop events and files, not model-authored stage events. Its success verifies recording consistency; source interpretation and recorded visual judgments still need independent review.

The runner matches get_app_state.buildId with get_build_info before/after collection, retaining full build provenance in evidence. It identifies the session, reads only Project identity/components/canvases/pageFrames/devicePresets, then complete Pages with view:full,depth:all (at most 30 per call) and full layout per Page without navigating. Project/branch/session/revision/changeCounter and fingerprints must remain stable. Structural/property reads cannot replace full Page evidence. Do not edit during collection. A revision alone does not prove saving; explicit save/reopen acceptance stays separate.

The new output directory contains `overview.json`, `pages.json`, `layouts.json`, `capture.json`, `report.json` and `report.md`. Controlled tasks also capture `reference-evidence.json`; successful live Page registration writes `checkpoint.json`. Native validate input/result are retained in capture.json. Page snapshot errors remain visible in `layouts.json` and fail rendering/height checks. A collection error produces a failed report, retaining any evidence already collected. Existing output directories are refused to preserve prior runs. Reports record exact checker, inventory and intent hashes in `checkedInputs`. Inventories and intents are parsed from those same loaded bytes; changes to checked files during the run fail evidence integrity. Raw evidence remains reusable across rule changes only by rerunning every gate.

## Reuse within the same live design state

When another gate or a corrected expectation needs the same complete capture, pass `--reuse-evidence /absolute/path/to/previous-run` together with `--profile`. The runner checks live project, branch, editor session, revision, changeCounter, Desktop version/build fingerprints, complete models/layouts and file hashes. Renderer and Desktop SHA-256 fingerprints are required; a source fingerprint, when present, must also be valid. Missing build identity, a mismatch or damaged/incomplete capture causes fresh collection. Copies are pinned to the validated manifest hashes. A change during reuse, or a Desktop version/build/project change during either fresh or reused collection, fails the run. Only overview and complete Page models are reused; layout snapshots are always refreshed because runtime rendering can change without a model revision. Every configured gate runs again; previous pass/fail results are never cached.

Do not reuse the pre-save capture for post-reopen acceptance: run `--profile` without `--reuse-evidence` after save/reopen. Preview interactions, pixels and scroll checks remain mandatory and separate. Capture again after edits; use an idle editor during collection. An unchanged revision alone is insufficient because there may be unsaved edits.

Keep full evidence and reports on disk. The command prints gate statuses, report path and excluded checks; inspect each failed gate's full report and the relevant Page/subtree when fixing it. Do not print entire `pages.json` or `layouts.json` into the conversation for each gate. Reuse these exact files across the applicable checks, including the checks linked from component documents. Missing checks, unresolved scope and failed runtime tests remain unverified/failed, never omitted to save context.

## Replay and interpretation

Replay the same captured evidence without Desktop, including on Windows:

```sh
python3 RESOURCE_ROOT/scripts/verify_all.py \
  --project-id PROJECT_ID \
  --evidence /absolute/path/to/previous-verification-run \
  --expectations /absolute/path/to/suite.json \
  --output /absolute/path/to/new-replay-report
```

Exit 0 means all configured automated gates passed or have explicit applicability reasons. Exit 1 means failure or incomplete configuration/evidence. Reports distinguish `passed`, `failed`, `not_applicable` and `unverified`, preserve individual gate details and always list excluded acceptance dimensions. Both replay and live reuse require complete version/build/session metadata, a parseable collection timestamp with timezone and hashes for all three evidence files. The overview Project id must match the requested project. The manifest is pinned before reading; model checks use the exact loaded bytes, and their hashes must still match the manifest and disk files. Full Page readbacks include markup, props, states, variants, variant groups and interactions; missing fields or unresolved `<plasmic-node-ref>` children fail even when the remaining files have valid hashes. Live collection also checks the returned depth and selected-field coverage; shallow reads cannot be used as complete evidence. A replay proves only the captured state. Review source interpretation, actual Preview interactions/scrolling and saved/reopened models before claiming full acceptance.
