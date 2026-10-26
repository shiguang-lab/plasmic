# Unified prototype verification

Use [verify_all.py](../scripts/verify_all.py) from resolved `resourceRoot` for full-project standalone fixed-viewport Overseas/Antd-v6 Pages. It checks native models, rendered layout, structure/devices/regions and supplied-reference coverage; it does not derive expectations, save, publish, switch projects or exercise Preview. During generation run `--page /exact-route` before advancing; omit it for final full-project acceptance. Local edits/mixed libraries use focused gates.

## Single-Page execution

For one Page, inventories cover that Page and its overlays. Select the [review mode](review-mode.md); the main agent generates and repairs. Finish selection preflight before markup, then use `--page /exact-route` below. Component rules, hidden Tabs/overlays and negative cases remain required. Report excluded cross-page transitions as unexecuted; do not generate destinations for tests. Fix collected issues together, rerun affected saved-model checks, then exercise fixes in Preview.

Review [copy economy](design/content-review.md#copy-economy). The structural gate checks every copy entry's role budget and repeated prose; wording, meaning and placement still need reviewer judgement.

Deviation fields (`layoutReason`, `controlWidthReason`, `nonStatusReason`, `bindingsNotApplicable`, override `reason`) are generation claims. Reviewers verify that a hashed source quote or measured geometry supports each deviation, one reason object per instance. Prose-only deviations fail even if gates pass.

## Reviewed suite configuration

Derive the suite and every region inventory from the reviewed Page plan instead of writing them again:

```sh
python3 RESOURCE_ROOT/scripts/prepare_plan.py inventories /task/structure-expectation.json --reads /task/compose-reads.jsonl --output-dir /task/inventories
```

It writes `forms-inventory.json`, `description-inventory.json`, `overlay-inventory.json`, one Slot intent per Page under `intents/`, and `suite.json`, all from the plan's components, owner Slots, nodes and copy. Values the plan cannot decide stay `"__DECIDE__"`: each horizontal Page Form's rendered `labelWidth.measuredPx` with its `measuredFrom` layout capture (the planning `estimatedPx` is derived), a reason for each control outside a Form/SearchForm, and each footer action's `effect`. Decide them from the source and measurements; for any other difference, correct the plan and derive into a new directory. Paths in `suite.json` resolve relative to it. Verifiers only read evidence and write reports; they never change Desktop state or navigation.

```json
{
  "structure": {"inventory":"../structure-expectation.json","reads":"compose-reads.jsonl"},
  "page_layout": {},
  "forms": {"inventory":"forms-inventory.json"},
  "descriptions": {"inventory":"description-inventory.json"},
  "overlays": {"inventory":"overlay-inventory.json"},
  "slots": {"pages":[{"path":"/records","intent":"intents/records.html"}]},
  "shell_height": {},
  "references": {"inventory":"reference-inventory.json","evidence":"reference-evidence.json"},
  "review": {"ledger":"accept-reads.jsonl","results":"rule-review.json"}
}
```

Add `references` only for supplied Pen sources (see [Pen evidence](design-references.md)).

| Gate | Required scope and what it checks |
| --- | --- |
| `structure` | Current compose-stage reference coverage from `reads` (the ledger used by selection preflight), plus exact routes, reviewed directory names, navigation, bindings, required native identities, source roles/props/Slots and declared UI-copy decisions. Requires each Page's `name`, `pageType`, `pageHeader`, `wireframe`, `components`, `nodes`, `copy` and `bindings` (or empty bindings plus a reviewed `bindingsNotApplicable`). See [source inventory](requirement-alignment.md#structural-gate). |
| `page_layout` | Always runs: native device columns, one named overview referencing every Page exactly once, correct sizes and no overlap. Defaults to Desktop and overviewName 页面总览; set the reviewed name and requested `presets` in the suite. |
| `forms` | Every Page's native Form/field ownership, rules and Row/Col layout, including explicit `forms:[]` when there are none. See [Form inventory](libraries/antd_v6/components/form.md#project-inventory-and-acceptance). |
| `descriptions` / `overlays` | Every Page's required information groups and overlays, including explicit empty lists; identities, content/ownership and supported footer rules. See [Descriptions](libraries/antd_v6/components/descriptions.md) and [overlays](libraries/antd_v6/compositions/modal-drawer.md). |
| `slots` | Named component intent and every supplied direct Slot; see [granularity](#slot-intent-granularity). Inapplicable only without component instances. |
| `model` | Automatic: fresh native validate must return literal valid:true, no errors and exact scoped Page IDs. Retain warnings for review. |
| `rendering` | Automatic: each Page has a ready, complete full snapshot. Overflow, sticky-cell control overflow/excess width and unloaded images fail; supported horizontal Table scrolling itself is valid. See [rendered inspection](desktop-inspection.md#geometry-and-static-screenshots). |
| `references` | Required for supplied Pen references: actual MCP layout/image evidence and native-node mappings under [Pen evidence](design-references.md). |
| `review` | Final full run only: project and Page accept-card reads, one verdict per rule and per hard constraint, the actual `reviewMode`, current plan/rule digests, and `checkedState` equal to this run's captured projectId/branchId/sessionId/revision/changeCounter; a `fail` or missing verdict fails. The report's `acceptance.ruleReview` states whether the review was independent. See [rule review](review-mode.md#rule-review). |
| `shell_height` | Every routed supported shell Page's shell/Layout viewport width and shell/Layout/sidebar viewport height. AppShell owns sizing. See [geometry acceptance](design/layout.md#viewport-shell-height-acceptance). |

Full suites cover every route in the Form, Descriptions and overlay inventories, including empty lists; project-wide `notApplicable` cannot replace them. Model, rendering, structure, page_layout and review cannot be exempted. `shell_height` permits `{"notApplicable":"Reviewed reason and scope"}` only without supported shells. Unsupported libraries/layouts use focused checks and report coverage limits. Page selectors are an exact `path`, unique `name` or `componentUuid`; supplied selectors must agree, with no fuzzy matching or silent fallback.

Structure also runs [purpose-first selection](libraries/antd_v6/selection.md) on the same plan: every functional instance needs a reviewed role/rule and compatible native identity. It rejects Tables without native Columns or a data value/binding, Columns without dataIndex/render, Cards wrapping only SearchForm/Steps and undeclared raw interactive widgets, and checks [authored names/copy](design/content-review.md) in both directions. Required prop/event presence and `$state` references do not prove business effects; an explicit empty dataset is valid but its empty state needs Preview.

Retain two content reviews under [content before presentation](requirement-alignment.md#content-before-presentation): source versus the plan, then the plan versus the saved model. Declare each query field's native name/label and owner so missing targets and changed keys fail; a correct colSpan, item count or collapsed screenshot does not prove field completeness. Without the source review, coverage stays unverified and functional Preview does not start.

The same checks verify per-Page [template-source evidence](admin-templates.md#source-evidence-before-composition) (selected names/project, reference/import mode, adaptation, capture path/hash; no-fit reasons need source review) and [protected component defaults and source exceptions](design/component-policy.md): SearchForm four-column (6) or three-column (8), row/collapse defaults, Item spans, ActionGroup limits, Dropdown triggers, App context (`appSources:[]` cannot hide required context) and a native size changer for multiple page sizes. Hash every cited source file as a checked input.

Review [business outcomes](design/component-policy.md#business-outcome-cases) and [permissions](design/permissions.md) separately: case shape cannot prove a role matrix, identity setup or submission guards, and a Message alone cannot prove a data effect. Plan [runtime cases](design/component-policy.md#case-planning-order) for what the prototype implements, prepare the [runtime manifest](design/component-policy.md#native-runtime-evidence) with `prepare_plan.py runtime-manifest`, fill actual assertion trace lines after Preview, then run `verify_runtime.py`; it separates passes, failures, unexecuted cases and invalid evidence.

The structure gate requires the actual compose reading ledger even when an accept ledger exists. Missing, empty or stale required reads fail, and the ledger bytes are pinned in `checkedInputs`. A ledger records emitted reference content; it does not prove understanding or establish when editing began. Follow the pre-write execution stage before mutations.

Static passes report `acceptance.status:"unverified"`; failures report `"failed"`. Do not wait for a static "passed" status. Retain separate source, Preview and save/reopen outcomes.

For role/state navigation, declare `navigation.roleQuery` (reviewed `state`, `query` and `default`) beside the literal `items`; the structure gate proves only that recognized transform against the inventory, with literal hrefs that have no query or fragment. Other dynamic menus stay statically unverified: report the expression and verify rendered menus and links in Preview.

## Evidence integrity

These rules apply to every gate, preflight and review.

- Expectations come from source evidence or an explicit user decision. Never edit, regenerate, weaken or relabel expectations, roles, source quotes or overrides to match output or clear a failing check. Derived inventories follow the plan; change the plan and derive again.
- Only the bundled preparation and verification scripts produce gate results. Task-local scripts may prepare inputs; they never replace a gate, grade their own output or report a pass. Extending a checker is authorized platform work.
- A failed, missing, unconfigured or unexecuted check stays failed/unverified; never omit it to save context or time.
- Static passes, screenshots, tool receipts, read ledgers and declared cases prove neither behavior, visual quality nor persistence. Report source, static, visual, runtime and persistence results separately.

## Slot intent granularity

Intent records the components and **direct Slots you supply**, plus ownership; the derived intent lists every planned component, native node and text in its owner Slot, and the explicit empty `title`/`extra` of a headerless Card. It need not repeat CSS, IDs, data, expressions or every native text element. A nonempty actual Slot missing from the intent is an unprovided default (for example a sample Column title); add the node to the plan. Explicit empty Slots must stay empty in readback, including when their content is hidden by CSS. For example, the row-action owner is described like this; data, items and bindings are reviewed separately:

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

A name-only AppShell/Card/Table outline omits supplied Slot content and cannot establish acceptance. Native Form, Descriptions and overlay inventories independently verify fields and content; passing Slot ownership does not replace them.

## Collect and verify

Open the intended project in the signed-in Desktop, save in edit mode, then collect. `--profile` is the Desktop **user-data directory** containing `mcp-connection.json`; live collection uses authenticated local RPC on macOS/Linux and never copies its token into evidence.

```sh
python3 RESOURCE_ROOT/scripts/verify_all.py \
  --project-id PROJECT_ID \
  --profile "/absolute/path/to/Desktop user-data" \
  --expectations /absolute/path/to/suite.json \
  --output /absolute/path/to/new-verification-run
```

With `--page /exact-route`, collection reads only that Page and its layout and region/Slot checks select it, while global routes/device/overview checks still run. A scoped capture cannot pass final full-project acceptance or be reused across scopes. Run `--help` for invocation; do not read checker implementation to discover ordinary usage. Do not edit during collection; an unchanged revision alone does not prove saving.

Before Preview, read the actual `report.json`: `passed:true`, every applicable `checks[*].status` passed, reviewed reasons for not_applicable, correct `projectId`/`pagePath`, current `capture.after` model identity and unchanged `checkedInputs`. Any edit or input change requires rechecking. The output directory holds `overview.json`, `pages.json`, `layouts.json`, `capture.json`, `report.json` and `report.md`; existing directories are refused.

After each Page gate, open get_screenshot pixels; record headers/rows, hierarchy, duplicate titles/surfaces and clipping. Repair findings and recheck before advancing. Preview follows the [execution stages](workflows/prototype.md#execution-plan-and-completion-evidence) and [review rounds](workflows/prototype.md#final-preview-review) after all in-scope Pages are complete. After save/reopen, collect fresh evidence and run the full report. Then compare the last Preview round's capture with the reopened one: `python3 RESOURCE_ROOT/scripts/compare_models.py PRE/pages.json POST/pages.json --report /task/persistence.json`. Equal models carry the runtime report forward as the persistence result; any difference means the reopened model was not the one exercised, so repair or re-execute the affected cases against a fresh capture. Do not synthesize a runtime trace or infer execution order from a final model.

Each gate result names its owning `rule`, and every diagnostic carries the most specific `rule` from the library `rules.json` or [gate rule map](gate-rules.json). Repair through the [diagnostic loop](planning.md#diagnostics-and-repair). Keep full evidence and reports on disk; inspect failed gates and the relevant Page subtree instead of printing whole `pages.json`/`layouts.json` into the conversation.

## Reuse within the same live design state

When another gate or a corrected expectation needs the same capture, pass `--reuse-evidence /absolute/path/to/previous-run` with `--profile`. The runner reuses only overview and complete Page models when the live project, branch, session, revision, changeCounter, Desktop build and file hashes match; otherwise it collects again. Layout snapshots are always refreshed and every configured gate runs again. Never reuse the pre-save capture for post-reopen acceptance.

## Replay and interpretation

Replay captured evidence without Desktop, including on Windows, with `--evidence /absolute/path/to/previous-run` instead of `--profile`. Exit 0 means every configured automated gate passed or has a reviewed applicability reason; exit 1 means failure or incomplete configuration/evidence. Reports distinguish `passed`, `failed`, `not_applicable` and `unverified` and list excluded acceptance dimensions. A replay proves only the captured state; review source interpretation, Preview interactions/scrolling and saved/reopened models before claiming full acceptance.
