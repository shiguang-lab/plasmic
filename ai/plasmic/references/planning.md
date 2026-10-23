# Page planning and rule delivery

Applies to every prototype Page plan (`structure-expectation.json`). The plan records source decisions; scripts derive which rules each decision needs, and deliver them at the moment they apply. The scripts read the machine-readable rule owners in each library's `rules.json` and the shared [gate rule map](gate-rules.json). Do not read these JSON files in full.

## Stages

| Stage | What the agent does | Script support |
| --- | --- | --- |
| Scaffold | List each planned functional instance: `nodeName`, registration `component`, semantic `role`, source `purpose`/`source`, `owner`. | `scaffold` adds rule owners, baselines and `"__DECIDE__"` slots |
| Decide | Replace every `"__DECIDE__"` from the source, the rule owner and contracts. | Preflight rejects pending/missing decisions with the owning rule anchor |
| Compose card | Read the compose card for the current Page right before markup. | `rules --stage compose` lists reader commands; `--reads` verifies them |
| Accept card | Read the acceptance card before saved-output review. | `rules --stage accept` |
| Repair | Reread the `rule` of each failing diagnostic, then repair the whole batch. | Gate and preflight errors carry `rule` |

## Plan decisions

Component documents list required native props under **Plan decisions**; `rules.json` holds the same entries. Page-level inventories (templates, feedback, copy, bindings, app context, action contracts, runtime cases) are decisions too. Start a Page from the minimal declaration list:

```sh
python3 RESOURCE_ROOT/scripts/prepare_plan.py scaffold /task/minimal-plan.json --output /task/structure-expectation.json
```

The input is `{"pages":[{"path":"/route","name":"页面","recordPage":false,"routePattern":"/route","params":[],"modes":[],"components":[...]}]}` with the fields above. `scaffold` keeps the declarations, adds the registration's rule document when `rule` is absent, writes baselines (for example ActionGroup `max:3`) and writes `"__DECIDE__"` for every other required prop and Page inventory. It never infers business values. Replace a value with `null` only where the decision table allows it: `null` means deliberately unset, and the saved-model gate then requires the prop to be absent. Selection preflight reports each pending value or omitted decision with its JSON pointer and `rule`.

A baseline is the owning reference's required default, not a suggestion; change it only through a verified [source override](design/component-policy.md#protected-configuration).

## Rules card and read ledger

Compose each Page from a fresh rules card, not from earlier reading:

```sh
python3 RESOURCE_ROOT/scripts/prepare_plan.py rules /task/structure-expectation.json --page /route --stage compose --ledger /task/reference-reads.jsonl
python3 RESOURCE_ROOT/scripts/verify_selection.py /task/structure-expectation.json --page /route --reads /task/reference-reads.jsonl --report /task/page-selection.json
```

The card collects every declaration's `rule` and its registration's owner document. For stage-template documents the compose card reads the preamble (hard constraints), **Plan decisions** and **Generation rules**; the accept card reads the complete document. Documents without the template, and explicit `rule` anchors, are read as declared. Run every listed command; `--reads` fails when a required section was not emitted at its current hash. The ledger proves delivery, not understanding: apply the hard constraints and decision rows to the plan.

The card reports its byte total. When it is large, finish the Page through the per-Page handoff in the [prototype workflow](workflows/prototype.md#complete-one-page-at-a-time) rather than skipping sections.

## Format example and mechanical helpers

Use [prepare_plan.py](../scripts/prepare_plan.py) instead of assembling another plan schema or patching a task-specific builder. It reads/writes the existing structure inventory; it never generates a prototype, infers permissions or executes Preview. The [native field/key reference](design/component-policy.md#plan-fields-and-case-kinds) defines the input shape. Derive coverage from the current source; do not pad a plan to match an example.

When the native plan format is unfamiliar, generate the complete **input-format fixture**, then run the same full-Page preflight used for a real plan:

```sh
python3 RESOURCE_ROOT/scripts/prepare_plan.py example /task/plan-format-example
python3 RESOURCE_ROOT/scripts/verify_selection.py /task/plan-format-example/structure-expectation.json --report /task/plan-format-example/preflight.json
```

The directory contains an illustrative source and compact JSON with real paths/hashes/excerpts, native owners, decided Table widths, feedback, query/reset, first/second/return paging, page-size and action cases. Its [permission example](design/permissions.md) distinguishes viewing allowed to all three roles, administrator-only mutation and a separate unauthorized-market boundary. Preflight validates format, not source meaning or execution, and the command creates no saved model or runtime evidence. Its template non-applicability is **only for this local fixture**; business tasks still [select/read live templates](admin-templates.md#source-evidence-before-composition).

```sh
python3 RESOURCE_ROOT/scripts/prepare_plan.py evidence /absolute/requirements.md --quote 'Exact text from the actual source'
python3 RESOURCE_ROOT/scripts/prepare_plan.py ids /task/structure-expectation.json --output /task/plan-with-ids.json
python3 RESOURCE_ROOT/scripts/prepare_plan.py clone-actions /task/plan-with-ids.json --page /groups --from-owner AllRowActions --to-owner MyRowActions --output /task/plan-with-shared-actions.json
python3 RESOURCE_ROOT/scripts/prepare_plan.py show /task/page-selection.json --pointer /errors/0
```

`evidence` emits only a native path/hash/quote and rejects non-verbatim text; reread and review a decision after its requirement changes. `ids` fills missing/duplicate case IDs, preserving unique IDs, the first duplicate and all business fields. `clone-actions` copies reviewed contracts between two declared row-action owners with new IDs; it rejects duplicate keys, conflicting contracts and invalid owners, and different permission/state behavior still needs its own cases. Plan-edit commands refuse existing outputs and leave inputs untouched. After saved-output capture, `runtime-manifest` prepares the [runtime evidence index](design/component-policy.md#native-runtime-evidence) with every case unexecuted.

## Diagnostics and repair

With `--report`, preflight saves every error and prints counts by check, at most eight representative diagnostics and the report path. Diagnostics retain the Page route, native owner/action key, JSON `pointer`, allowed values and `rule`. Read the complete batch on disk, then use `show` for the needed fragment. A pointer to a missing field identifies where to add it; malformed JSON reports file, line and column.

For each diagnostic, read its `rule` section before changing the plan or model, and check the other rules of that section that the same change touches. Repair the whole batch, rerun plan-only preflight, then recapture. Do not regenerate screenshots or rerun live capture to guess enum values.

A diagnostic whose cheapest repair is a declaration — `layoutReason`, `controlWidthReason`, `nonStatusReason`, `bindingsNotApplicable`, an override `reason` — is an evidence gate, not a checkbox. These fields are checked against hashed source quotes or measured geometry. If you cannot cite a sentence or measure the deviation, change the model to the baseline; never author the justification yourself. A reason written to satisfy a gate is fabricated evidence, and `verify_forms.py` rejects prose, unverifiable quotes and the same reason reused by two Forms.
