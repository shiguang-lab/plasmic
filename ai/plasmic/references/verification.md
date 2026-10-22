# Unified prototype verification

Use [verify_all.py](../scripts/verify_all.py) from the resolved `resourceRoot` for full-project checks of standalone fixed-viewport Pages against the supported Overseas/Antd-v6 contracts. It runs native model validation, rendered layout, structural/device/region gates and supplied-reference coverage; it does not derive expected behavior from generated models, save, publish, switch projects or exercise Preview. During generation use `--page /exact-route` for each Page before advancing; omit it for final full-project acceptance. Use focused individual gates for a local edit or mixed-library scope that does not fit these full-project checks.

## Single-Page execution

For one supported Page, keep only the requested Page and its in-scope overlays in the source inventories. Select the reviewer through [review mode](review-mode.md); the main agent owns generation and repairs. Complete selection preflight before markup, then use `--page /exact-route` with the applicable suite below. This narrows scope; it does not waive component rules, hidden Tabs/overlays or negative cases. Do not design unrelated destination Pages to satisfy a test. Report explicitly excluded cross-page transitions as unexecuted. Fix a round's collected issues together, rerun affected saved-model checks, and exercise the fixes in the next Preview round.

## Reviewed suite configuration

Create a local `suite.json` from independently reviewed requirements. All paths resolve relative to that file. The following is the suite envelope; inventory fields are documented in the linked region references and [requirement alignment](requirement-alignment.md). Prepare source-derived inventories before generation and each Page's Slot intent before its scoped check. The final full run requires every intent file. The agent owns the execution plan and progress; the verifier reads evidence and writes reports without changing Desktop task state or restricting navigation.

```json
{
  "structure": {"inventory":"structure-expectation.json"},
  "page_layout": {},
  "forms": {"inventory":"form-inventory.json"},
  "descriptions": {"inventory":"description-inventory.json"},
  "overlays": {"inventory":"overlay-inventory.json"},
  "slots": {"pages":[{"path":"/records","intent":"records-intent.html"}]},
  "shell_height": {},
  "references": {"inventory":"reference-inventory.json","evidence":"reference-evidence.json"}
}
```

| Gate | Required scope and what it checks |
| --- | --- |
| `structure` | Exact routes, reviewed directory names, navigation, bindings, required native identities, source roles/props/Slots and declared UI-copy decisions. Requires each Page's `name`, `pageHeader`, `components`, `nodes`, `copy` and `bindings` (or empty bindings plus a reviewed `bindingsNotApplicable`). See [source inventory](requirement-alignment.md#structural-gate). |
| `page_layout` | Always runs: native device columns, one named overview referencing every Page exactly once, correct sizes and no overlap. Defaults to Desktop and overviewName 页面总览; set the reviewed name and explicitly requested `presets` in the suite. |
| `forms` | Every Page's native Form/field ownership and rules, including explicit `forms:[]` when the source has none. See [Form inventory](libraries/antd_v6/components/form.md#project-inventory-and-acceptance). |
| `descriptions` / `overlays` | Every Page's required information groups and overlays, including explicit empty lists; identities, content/ownership and supported footer rules. See [Descriptions](libraries/antd_v6/components/descriptions.md) and [overlays](libraries/antd_v6/compositions/modal-drawer.md). |
| `slots` | Named pre-generation component intent and every supplied direct Slot; see [granularity](#slot-intent-granularity). May be inapplicable only when there are no component instances. |
| `model` | Automatic: fresh native validate must return literal valid:true, no errors and exact scoped Page IDs. Retain warnings for review. |
| `rendering` | Automatic: each Page has a ready, complete full snapshot with positive viewport dimensions, explicit image/problem lists and the current required checks. Overflow, sticky-cell control overflow and unloaded images fail; supported horizontal Table scrolling itself is valid. See [rendered inspection](desktop-inspection.md#geometry-and-static-screenshots). |
| `references` | Required for supplied Pen references: actual MCP layout/image evidence and native-node mappings under [Pen evidence](design-references.md). Omit only when none were supplied. |
| `shell_height` | Every routed supported shell Page's structure, shell/Layout viewport width and shell/Layout/sidebar viewport height. AppShell owns sizing; ancestor/instance dimension overrides are not required. See [geometry acceptance](design/layout.md#viewport-shell-height-acceptance). |

Full suites cover standalone fixed-viewport Overseas/Antd-v6 Pages. All routes must appear in Form, Descriptions and overlay inventories, even when their reviewed lists are empty. Project-wide `notApplicable` cannot replace these inventories. Model, rendering, structure and page_layout cannot be exempted. `shell_height` accepts `{"notApplicable":"Reviewed reason and scope"}` only without supported shells. Omitted gates make the run incomplete. Other libraries/layouts use focused checks and report unsupported coverage.

Forms, Descriptions, overlays and Slots resolve Page selectors by exact `path`, unique `name` or `componentUuid`; supplied selectors must agree. No fuzzy matching, route normalization or silent UUID fallback. Prefer paths for reusable plans before Page creation.

Structure also runs [purpose-first selection](libraries/antd_v6/selection.md) using the same inventory: all functional instances need reviewed roles/rules, with feedback event expectations and compatible native identities. Missing coverage and wrong presentation fail; source meaning and runtime remain independent reviews. Structure rejects Tables without native Columns or an explicit data value/binding, Columns without dataIndex/render, Cards wrapping only SearchForm/Steps and undeclared raw interactive widgets. An explicit empty dataset is valid; verify its empty-state behavior in Preview. Exact reviewed `elementFallbacks` do not override required native identities. It checks [authored names/copy](design/content-review.md) in both directions against the source plan, including owners, hidden text and native UI props. Missing or changed nodes/copy fail; semantic meaning still needs source review. Required prop/event presence and `$state` references do not prove business effects. These limits require independent source, pixel and Preview review, not weaker expectations.

Retain two distinct content reviews under [content before presentation](requirement-alignment.md#content-before-presentation): source versus the pre-generation expectation, then that same expectation versus the saved model. For query fields declare each Item's native name/label and owner in components so structure checks can detect missing targets, changed keys and wrong Slots. A correct colSpan, equal item count or screenshot of a collapsed region does not establish field completeness. Missing source review, a missing expectation or a help-only invocation leaves coverage unverified; do not report it as passed or proceed to functional Preview on that basis.

The same preflight and structure gate verify per-Page [template-source evidence](admin-templates.md#source-evidence-before-composition): selected names/project, planned reference/import mode, adaptation and capture path/hash. Complete models/contracts, including catalog-owned nested templates, must match the selection and stable source identity. Captures and catalog are fingerprinted as checked inputs. Missing selections/captures or directory-only summaries fail. No-fit reasons need source review. Source-read PASS leaves interpretation, actual insertion/detachment and adaptation unverified; retain their separate operation/model evidence.

The same structure/selection checks now apply [protected component defaults and real source exceptions](design/component-policy.md). SearchForm supports reviewed four-column (6) and three-column (8) modes; inspect the original visual evidence for the owning reference's multi-row three-column condition. Other grid values require explicit requirement-document evidence. The checks independently reject mismatched modes, unauthorized row/initial-collapse changes, Item widening, ActionGroup limits/triggers and ordinary Dropdown trigger changes even when task props match the generated output. Required App context cannot be hidden with appSources:[]; native implicit state, explicit state actions and data-query arguments retain their real contracts. Multiple explicit page sizes require the native size changer. Source files cited by exceptions, App context and cases are hashed among checked inputs.

Static PASS excludes runtime acceptance. Review [business outcomes](design/component-policy.md#business-outcome-cases) and [permissions](design/permissions.md): case shape cannot prove a correct role matrix, real identity setup or submission guards; Message-only checks cannot prove data effects. Prepare the existing [runtime manifest](design/component-policy.md#native-runtime-evidence) with `prepare_plan.py runtime-manifest`, fill actual assertion trace lines after Preview, then run `verify_runtime.py`. Its per-case statuses distinguish passes, actual failures, unexecuted cases and invalid evidence. Permission, cancellation, transitions/text, App consumers and paging need cases. Missing/duplicate cases, changed hashes/model/session or failed/mismatched checks fail. Source/fixture authenticity, handler-only execution and pixels remain separate reviews.

The script reports `acceptance.status:"unverified"` when automated gates pass, and `"failed"` otherwise. This is expected for a static pass, not a request to wait for acceptance.status:passed. Separate source, Preview and save/reopen reviews do not update it; retain those outcomes separately.

Do not exempt a failing or dynamic menu merely to get a green report: dynamic role/state navigation still requires separate exercised evidence. For the supported recursive role-query transform, declare `navigation.roleQuery` with the reviewed `state`, `query` and `default` names/value alongside the independent literal `items`. The structure gate proves the entire recognized transform against that inventory without executing JavaScript; changed targets, labels, hidden/disabled flags, item type, icon, order, recursion, encoding or fallback precedence fail. Static menus retain the same registered fields; unsupported properties and unresolved bindings fail instead of being projected away. This transform requires literal hrefs without an existing query or fragment. Operator boundaries and line-terminator semantics remain significant; normalization must not turn invalid or changed JavaScript into the reviewed program. Unknown transforms remain statically unverified: report the unsupported expression and retain separate runtime evidence. Ordinary design tasks do not extend the checker or relabel failure as success; checker extensions and their tests belong to explicitly authorized platform work.

## Slot intent granularity

Intent records the components and **direct Slots you supply**, plus relevant ownership. It need not repeat CSS, IDs, complete data, expressions or every native text element. Declare every supplied nonempty Slot, including Button.children and Column.render; an omitted nonempty actual Slot is reported as an unprovided default. Explicit empty Slots declare cleared defaults and must remain empty in readback, including when their content is hidden by CSS. For example, this fragment describes the native row-action owner; its data, items and bindings are reviewed separately, not cloned into Slot intent:

```html
<plasmic-component data-plasmic-name="RecordsTable" data-plasmic-component="plasmic-antd6-table">
  <slot name="children">
    <plasmic-component data-plasmic-name="NameColumn" data-plasmic-component="plasmic-antd6-table-column"></plasmic-component>
    <plasmic-component data-plasmic-name="ActionColumn" data-plasmic-component="plasmic-antd6-table-column">
      <slot name="render">
        <plasmic-component data-plasmic-name="RowActions" data-plasmic-component="plasmic-react-ui-action-group"></plasmic-component>
      </slot>
    </plasmic-component>
  </slot>
</plasmic-component>
```

For a full Page, place this within the planned AppShell.children and include its other participating components/Slots. A name-only AppShell/Card/Table outline omits supplied Slot content and cannot establish acceptance. Native Form, Descriptions and overlay inventories independently verify fields and content; passing Slot ownership does not replace them.

## Collect and verify

Open the intended project in the signed-in Desktop. For prototype work, prepare the actual suite/inventories/intent before composition and save in edit mode before collection. `--profile` is its **user-data directory** containing `mcp-connection.json`. Live collection uses authenticated local RPC on macOS/Linux; its token is not copied into evidence.

```sh
python3 RESOURCE_ROOT/scripts/verify_all.py \
  --project-id PROJECT_ID \
  --profile "/absolute/path/to/Desktop user-data" \
  --expectations /absolute/path/to/suite.json \
  --output /absolute/path/to/new-verification-run
```

With `--page /exact-route`, the same suite/inventories may include planned sibling Pages: collection reads only this Page and its layout, region/Slot checks select this Page, while global routes/device/overview checks still run. Evidence records pagePath; a scoped capture cannot pass final full-project acceptance or be reused across scopes. Run `--help` for invocation; do not read checker implementation to discover ordinary usage.

Before Preview, read the actual `report.json`: `passed:true`, all applicable `checks[*].status` passed, reviewed reasons for not_applicable, correct `projectId`/`pagePath`, current `capture.after` model identity and unchanged `checkedInputs`. Any edit/input change requires rechecking. Selection preflight, native validate, save or screenshot success cannot substitute for this report.

After each Page gate, open get_screenshot pixels; record headers/rows, hierarchy, duplicate titles/surfaces and clipping. Repair findings and recheck before advancing. Preview follows the [execution stages](workflows/prototype.md#execution-plan-and-completion-evidence) and [review rounds](workflows/prototype.md#final-preview-review) after all in-scope Pages/destinations are complete. Capture success does not establish visual or runtime acceptance.

Keep actual reference/model/layout/image/runtime calls, observations and pending cases in the local working directory. A passing scoped report checks the captured Page only. After save/reopen, collect fresh evidence, run the full report and independently review source coverage, pixels and Preview outcomes. Do not synthesize a successful runtime trace or infer execution order from a final model.

The runner matches get_app_state.buildId with get_build_info before/after collection, retaining full build provenance in evidence. It identifies the session, reads only Project identity/components/canvases/pageFrames/devicePresets, then complete Pages with view:full,depth:all (at most 30 per call) and full layout per Page without navigating. Project/branch/session/revision/changeCounter and fingerprints must remain stable. Structural/property reads cannot replace full Page evidence. Do not edit during collection. A revision alone does not prove saving; explicit save/reopen acceptance stays separate.

The new output directory contains `overview.json`, `pages.json`, `layouts.json`, `capture.json`, `report.json` and `report.md`. Pen layout/image evidence is a separate local input under `references.evidence`. Native validate input/result are retained in capture.json. Page snapshot errors remain visible in `layouts.json` and fail rendering/height checks. A collection error produces a failed report, retaining any evidence already collected. Existing output directories are refused to preserve prior runs. Reports record exact checker, inventory and intent hashes in `checkedInputs`. Inventories and intents are parsed from those same loaded bytes; changes to checked files during the run fail evidence integrity. Raw evidence remains reusable across rule changes only by rerunning every gate.

## Reuse within the same live design state

When another gate or a corrected expectation needs the same complete capture, pass `--reuse-evidence /absolute/path/to/previous-run` together with `--profile`. The runner checks live project, branch, editor session, revision, changeCounter, Desktop version/build fingerprints, complete models/layouts and file hashes. Renderer and Desktop SHA-256 fingerprints are required; a source fingerprint, when present, must also be valid. Missing build identity, a mismatch or damaged/incomplete capture causes fresh collection. Copies are pinned to the validated manifest hashes. A change during reuse, or a Desktop version/build/project change during either fresh or reused collection, fails the run. Only overview and complete Page models are reused; layout snapshots are always refreshed because runtime rendering can change without a model revision. Every configured gate runs again; previous pass/fail results are never cached.

Do not reuse the pre-save capture for post-reopen acceptance: run `--profile` without `--reuse-evidence` after save/reopen. Preview interactions, pixels and scroll checks remain mandatory and separate. Capture again after edits; use an idle editor during collection. An unchanged revision alone is insufficient because there may be unsaved edits.

Keep full evidence and reports on disk. The command prints gate statuses, report path and excluded checks; inspect each failed gate's full report and the relevant Page/subtree when fixing it. Do not print entire `pages.json` or `layouts.json` into the conversation for each gate. Reuse these exact files across the applicable checks, including the checks linked from component documents. Missing checks, unresolved scope and failed runtime tests remain unverified/failed, never omitted to save context.

For plan-format examples, native IDs/shared actions and focused JSON reads, use the existing [selection preparation workflow](libraries/antd_v6/selection.md#runnable-plan-format-and-mechanical-preparation). `verify_selection.py --report FILE` retains the complete diagnostic batch in FILE while printing a bounded summary with field pointers; inspect that batch before repairing. It does not reduce coverage or substitute for live template reads, source review or Preview.

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
