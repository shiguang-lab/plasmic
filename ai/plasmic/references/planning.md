# Page planning and rule delivery

Applies to every prototype Page plan (`structure-expectation.json`). The plan records source decisions; scripts derive which rules each decision needs, and deliver them at the moment they apply. The scripts read the machine-readable rule owners in each library's `rules.json` and the shared [gate rule map](gate-rules.json). Do not read these JSON files in full.

Use the stages below for new Pages and structural changes. Start from the current Page's draft declarations; the project card includes the library indexes and selection rules, and the Page card resolves component documents by registration key. Do not replace these cards with remembered scale defaults or manually navigating only part of the library indexes. Before content writes, finish the workflow's [preparation checkpoint](workflows/prototype.md#before-content-writes). Local repairs reuse existing decisions and read/check only the affected scope; they do not require inventing a complete Page plan.

## Stages

| Stage | What the agent does | Script support |
| --- | --- | --- |
| Project card | Once per task, read the shared design rules (Page structure, layout, naming, content review, accessibility, plus record context and permissions when Pages need them). | `rules PLAN --project --stage compose`; every `--reads` check requires them |
| Structure draft | Sketch every in-scope Page in `pageStructure`; choose `pageType` for starting guidance. Reconcile the current Page with live templates/contracts before detailed planning. | [Page structure design](design/page-structure.md); no new generator or approval step |
| Scaffold | Retain the current Page's structure decision, then list each planned functional instance: `nodeName`, registration `component`, semantic `role`, source `purpose`/`source`, `owner`. | `scaffold` adds rule owners, baselines and `"__DECIDE__"` slots |
| Compose card | Run the compose card on the scaffold and read every listed section before deciding. | `rules --page ROUTE --stage compose` lists reader commands; `--reads` verifies them |
| Decide | Resolve `pageStructure.regions` to declared component/node names and finalize its layout, sizing, scrolling and actions. Replace every `"__DECIDE__"` from the source, the delivered Plan decisions rows and contracts. | `label-width` gives Form labelCol estimates; preflight rejects pending/missing decisions with the owning rule anchor |
| Design review | After current-Page preflight, review sources and structure before markup under the shared [checkpoint policy](review-mode.md#review-checkpoints). | Record mode, input versions, findings and evidence in the task checkpoint |
| Accept card | Read the project and Page acceptance cards before Saved-Page review. | `rules --stage accept`; `review-skeleton` |
| Repair | Reread the `rule` of each failing diagnostic, then repair the whole batch. | Gate and preflight errors carry `rule` |

## Plan decisions

Component documents list required native props under **Plan decisions**; `rules.json` holds the same entries, and every documented row must be declared there. A decision with `"target": "spec"` (such as Card `header`) is a plan field beside `props`, never a native prop. Page-level inventories (page structure, page type, wireframe, templates, feedback, copy, bindings, app context, action contracts, runtime cases) are decisions too. Draft `pageStructure` under [Page structure design](design/page-structure.md) before detailed declarations. Include it and `pageType` in the minimal list; the type routes starting composition guidance, while the structure records the requirement-specific arrangement. The source inventory determines required content; page types do not enforce component counts. Early sibling Pages may retain draft decisions; use `--page ROUTE` for current-Page preflight. The full-project suite requires every scoped Page to be complete. Start a Page from the minimal declaration list:

```sh
python3 RESOURCE_ROOT/scripts/prepare_plan.py scaffold /task/minimal-plan.json --page /route --output /task/structure-expectation.json
```

The input is `{"pages":[{"path":"/route","name":"页面","pageType":"list","pageStructure":{...},"recordPage":false,"components":[...]}]}` with the fields above; a record Page adds `routePattern`, `params` and `recordSource` under [record context](design/record-context.md). `scaffold --page /route` prepares only the current Page and retains sibling drafts unchanged; omit `--page` when every Page already has component declarations. `scaffold` keeps the declarations, adds the registration's rule document when `rule` is absent, writes baselines (for example ActionGroup `max:3`) and writes `"__DECIDE__"` for every other required prop and Page inventory. It never infers business values. Replace a value with `null` only where the decision table allows it: `null` means deliberately unset, and the saved-model gate then requires the prop to be absent. Selection preflight reports each pending value or omitted decision with its JSON pointer and `rule`.

A baseline is the owning reference's required default, not a suggestion; change it only through a verified [source override](design/component-policy.md#protected-configuration).

## Rules card and read ledger

Read the project card once per task, then compose each Page from a fresh rules card, not from earlier reading:

```sh
python3 RESOURCE_ROOT/scripts/prepare_plan.py rules /task/structure-expectation.json --project --stage compose --ledger /task/reference-reads.jsonl
python3 RESOURCE_ROOT/scripts/prepare_plan.py rules /task/structure-expectation.json --page /route --stage compose --ledger /task/reference-reads.jsonl
python3 RESOURCE_ROOT/scripts/verify_selection.py /task/structure-expectation.json --page /route --reads /task/reference-reads.jsonl --report /task/page-selection.json
```

The card collects every declaration's `rule`, its registration's owner document and the composition documents that the decided page type and the Page's overlays, feedback, record context and action contracts require ([gate rule map](gate-rules.json) `pageRules`). For stage-template documents the compose card reads the preamble (hard constraints), **Plan decisions** and **Generation rules**; the accept card reads the complete document. Documents without the template, and explicit `rule` anchors, are read as declared. Run every listed command; `--reads` fails when a required section was not emitted at its current hash. The ledger proves delivery, not understanding. The project card delivers Page structure design before detailed planning; the Page accept card delivers it again for per-Page review.

Every compose card also delivers the [admin design scale](design/scale.md) and the chosen page type's section. Run it on the scaffold, before deciding: the digest shows `__DECIDE__` until each value is decided from its rows. The card leads with the current `pageStructure` and a digest: `hardConstraints` of every listed document and `decisions` with the Page's current plan values (`MISSING` when absent). Check each constraint against those values before reading the long sections; a constraint the plan cannot satisfy is a plan defect to fix before markup. `readingBudgetExceeded` (over 96 KiB of sections) signals context pressure; it does not establish host capabilities or the model's token capacity. Follow [per-Page context handling](workflows/prototype.md#complete-one-page-at-a-time), using verified delegation or client-supported compaction when available and sequential section reads with disk checkpoints otherwise. Never skip sections to fit or claim a fresh context without one.

Keep the actual compose ledger as `structure.reads` in `suite.json`; the final structure gate rechecks its current rule coverage. `verify_selection.py --plan-only` is only a declaration check and does not complete the prepare-inputs stage.

For Saved-Page review, read project and current Page accept cards; record static/visual findings and pending runtime/persistence checks in the task checkpoint. After execution, use `review-skeleton --page ROUTE` and `verify_review.py --page ROUTE --capture RUN/capture.json` for final single-Page acceptance. Follow [rule review](review-mode.md#rule-review) for modes, evidence and full-scope reconciliation; an automatic Page pass alone does not complete the checkpoint.

## Format example and mechanical helpers

Use [prepare_plan.py](../scripts/prepare_plan.py) instead of assembling another plan schema or patching a task-specific builder. It reads/writes the existing structure inventory; it never generates a prototype, infers permissions or executes Preview. The [native field/key reference](design/component-policy.md#plan-fields-and-case-kinds) defines the input shape. Derive coverage from the current source; do not pad a plan to match an example.

When the native plan format is unfamiliar, generate the complete **input-format fixture**, then check its declarations with `--plan-only`; this does not complete a real Page's required rule reading or prepare-inputs stage:

```sh
python3 RESOURCE_ROOT/scripts/prepare_plan.py example /task/plan-format-example
python3 RESOURCE_ROOT/scripts/verify_selection.py /task/plan-format-example/structure-expectation.json --plan-only --report /task/plan-format-example/preflight.json
```

The directory contains an illustrative source and compact JSON with real paths/hashes/excerpts: a `list` Page (PageBody Flex, SearchForm, a headerless list Card with `16px 20px 0`, the Table), native owners, decided Table widths, feedback, query/reset and action cases. Its native Table paging needs no paging case. Its [permission example](design/permissions.md) distinguishes viewing allowed to all three roles, administrator-only mutation and a separate unauthorized-market boundary. Preflight validates format, not source meaning or execution, and the command creates no saved model or runtime evidence. Its template non-applicability is **only for this local fixture**; business tasks still [select/read live templates](admin-templates.md#source-evidence-before-composition).

```sh
python3 RESOURCE_ROOT/scripts/prepare_plan.py evidence /absolute/requirements.md --quote 'Exact text from the actual source'
python3 RESOURCE_ROOT/scripts/prepare_plan.py ids /task/structure-expectation.json --output /task/plan-with-ids.json
python3 RESOURCE_ROOT/scripts/prepare_plan.py clone-actions /task/plan-with-ids.json --page /groups --from-owner AllRowActions --to-owner MyRowActions --output /task/plan-with-shared-actions.json
python3 RESOURCE_ROOT/scripts/prepare_plan.py show /task/page-selection.json --pointer /errors/0
```

`prepare_plan.py inventories /task/structure-expectation.json --page /route --reads /task/compose-reads.jsonl --output-dir /task/inventories` derives the current Page's Form, Descriptions and overlay inventories, Slot intent and `suite.json` from the decided plan. Omit `--page` to derive the complete suite after all Pages are ready. The suite still references the full source plan; use `verify_all.py --page /route` with scoped inventories. Outputs include each horizontal Page Form's planning `labelWidth.estimatedPx`. It preserves Form `layoutReason`, `columnsReason`, `labelAlignReason`, `labelWidth`, `sourceCopyUnits`, `copyTriage` and `excludedCopy`, plus Item `controlWidthReason`; record these beside native `props` on the owning declaration. Field `tooltip`/`description` copy entries retain their evidence when deriving copy triage. Overlay Form layout records Modal `modalWidth` from `width`, or Drawer `drawerSize` from `size`. Missing source evidence, required rendered measurements, standalone-control reasons and footer effects stay `"__DECIDE__"` until supplied. Correct the plan and regenerate derived files; measured geometry remains acceptance evidence.

For each Page Form, `prepare_plan.py form-skeleton /task/structure-expectation.json --inventory /task/forms.json --page ROUTE --form FORM --output /task/form.html` writes insertHtml markup in the [Page Form structure](libraries/antd_v6/compositions/form-layout.md#page-form-structure) from the decided plan and field inventory; it refuses undecided props, a missing `layout` or a `labelCol` that disagrees with `labelWidth` (the measurement when recorded, otherwise the estimate). `prepare_plan.py label-width PLAN --page ROUTE` prints that estimate for the plan's `labelCol` decision. Insert it, then add bindings, events and help. Change the plan or inventory, not the markup, when the structure must change.

`evidence` emits only a native path/hash/quote and rejects non-verbatim text; reread and review a decision after its requirement changes. `ids` fills missing/duplicate case IDs, preserving unique IDs, the first duplicate and all business fields. `clone-actions` copies reviewed contracts between two declared row-action owners with new IDs; it rejects duplicate keys, conflicting contracts and invalid owners, and different permission/state behavior still needs its own cases. Plan-edit commands refuse existing outputs and leave inputs untouched. After saved-output capture, `runtime-manifest` prepares the [runtime evidence index](design/component-policy.md#native-runtime-evidence) with every case unexecuted.

## Diagnostics and repair

With `--report`, preflight saves every error and prints counts by check, at most eight representative diagnostics and the report path. Diagnostics retain the Page route, native owner/action key, JSON `pointer`, allowed values and `rule`. Read the complete batch on disk, then use `show` for the needed fragment. A pointer to a missing field identifies where to add it; malformed JSON reports file, line and column.

For each diagnostic, read its `rule` section before changing the plan or model, and check the other rules of that section that the same change touches. Repair the whole batch and rerun affected checks. For planned Page changes, refresh affected card reads and rerun selection preflight with `--reads` before dependent writes, then recapture. `--plan-only` may diagnose declarations but cannot replace that preflight. Do not regenerate screenshots or rerun live capture to guess enum values.

A diagnostic whose cheapest repair is a declaration — `layoutReason`, `controlWidthReason`, `nonStatusReason`, `bindingsNotApplicable`, an override `reason` — is an evidence gate, not a checkbox. These fields are checked against hashed source quotes or measured geometry. If you cannot cite a sentence or measure the deviation, change the model to the baseline; never author the justification yourself. A reason written to satisfy a gate is fabricated evidence, and `verify_forms.py` rejects prose, unverifiable quotes and the same reason reused by two Forms.
