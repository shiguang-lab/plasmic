# Post-implementation review probes

Date: 2026-10-27. Scope: the four [contract cases](cases.json). This run predates direction-based delegation: one independent reviewer covered all applicable dimensions, alongside a fallback replay. The current [review rubric](README.md) requires separate direction assignments. These are synthetic offline review inputs, not a running application.

An independent agent first reviewed the workflow/reference changes against the user request and reported no actionable defects, while explicitly limiting its conclusion to the documents. Two separate fixture runs then read the same pinned references and raw cases without the rubric or prior conclusions:

- **Independent reviewer:** a fresh-context child reviewed the assigned code and sources, wrote reports, did not repair inputs or delegate further.
- **Same-conversation fallback replay:** an isolated executor was explicitly prohibited from further delegation. It performed the review in its own context, recorded that restriction as the fallback reason, and did not claim tools were absent or an independent child had approved it. This tests fallback execution/reporting; it does not measure self-review bias after a long implementation history.

The parent checked actual findings against source requirements and code, rather than accepting the reviewers' completion messages.

| Case | Independent and fallback observations |
| --- | --- |
| source-capabilities | Both found the actual OrdersPanel surface and page layout rewritten with native elements despite verified target capabilities. Neither accepted the unrelated help Panel/import as evidence or demanded that native ticket artwork become a library component. Both limited claims about unseen CSS/pixels. |
| verified-adaptation | Both accepted host ownership, pane-to-items conversion, and the adjacent trigger with correct controlled close binding. Neither manufactured a required rewrite or claimed runtime/visual acceptance. |
| unknown-target-contract | Both identified the missing member-selection functionality while keeping target exports/props/events unknown. Neither invented APIs nor treated unread contracts as proof of absent capability. |
| interaction-and-evidence | Both traced the old-key callback and dismiss-to-true callback to two definite state defects. Both distinguished the implementation report's unverified build claim from evidence and rejected using it to establish interaction correctness. |

## Repair and re-review

The parent verified the findings and created a separate repaired snapshot for the two affected cases, leaving original inputs, source requirements and target contracts unchanged. OrdersPanel now uses Panel's actual heading/actions/contentStyle/children and the page uses Stack; the account callbacks forward the new key and close with false. The unsupported validation claim was replaced with the actual unverified status.

The same independent reviewer examined the new code, checked unchanged sources/contracts, and reported those findings resolved with no new static defect. It only re-reviewed the two affected cases and retained missing type/build/runtime/visual evidence. The fallback run did not perform this repair loop. Neither reviewer modified inputs, accessed live applications or treated hypothetical execution as a test result.

## Reproducibility and resource validation

- Local evidence workspace: `/var/folders/by/mz1s49k13p3d7xvfr357w1kw0000gn/T/plasmic-codegen-review-15gtyw4z/`; original reports are in `independent/` and `fallback/`, with `independent/recheck.md` for the repaired snapshot. Temporary evidence is not distributed.
- Original cases SHA-256: `e6120dfbc43451780a3749035fd2db56533ca6fcbc3eb43484ba97a17b29c3ce`.
- Repaired cases SHA-256: `70675445e507f6c729f51a6f5d73d865a860da83757de441a31ce03b77666385`.
- Pinned references SHA-256: `cdaf0b3add34717bc53c3f0195540db376ffaed37d021f6be86fe8d127d49b86`, using the ordered path/NUL/bytes/NUL method from [the earlier run](results.md), with `codegen/review.md` appended.
- Resource/link/anchor/reachability and component-reference validation passed for 197 resources. Codegen mustRead remains 24,464 bytes under the unchanged 24,576-byte limit; directed codegen reading is 46,530 bytes under the existing limit.
- A local `buildResources` run passed all 515 Python checks and produced a verified bundle containing `references/codegen/review.md`. Local release ID: `36d4b9e0ba3ee6f430b72c4bfc3d6bc1dea9350d5bd6482f50ae52a653fb4b72`. No publication or installed-skill configuration change occurred.
- `git diff --check` and evaluation JSON/local-link checks passed. No semantic gate or new validation script was added.

These runs demonstrate bounded review decisions and one static repair/review cycle. They do not establish a production success rate, actual UI behavior, visual fidelity or a live shared-browser handoff.

## Direction-based delegation

Date: 2026-10-27. After changing the default to separate applicable review directions, the parent assigned three fresh-context agents to design fidelity, behavior correctness and engineering quality. Each read the same stable raw cases and the updated review rules plus its relevant references, without the rubric, prior conclusions or other reviewers' outputs. Agents only wrote separate reports; they did not repair inputs or delegate again.

| Case | Parent assessment of the directional reports |
| --- | --- |
| source-capabilities | Design identified the actual surface/layout replacements; engineering independently confirmed duplicated public capabilities and assigned design ownership. Behavior confirmed the available action binding and forwarded the structural issue. The parent retained one mapping finding with engineering impact, without requiring a rewrite of native ticket content. |
| verified-adaptation | Design accepted slot/API and host conversions; behavior traced the correct selection/open/close state chains; engineering found no required dependency/host rewrite. All retained runtime and visual limits. |
| unknown-target-contract | Design identified the missing picker and unknown target API; behavior identified the absent selection/search workflow; engineering withheld integration approval without inventing exports or a capability gap. The parent treated these as one incomplete feature requiring contract evidence, with behavior still unverified. |
| interaction-and-evidence | Behavior traced both incorrect callbacks to their effects. Design reported the contract mismatch and engineering forwarded the same behavioral evidence. The parent assigned the two defects to behavior and retained the unsupported acceptance claim separately; absent logs did not establish command failure. |

The parent checked findings against the original source contracts and target code. Overlapping findings had consistent evidence and were deduplicated; no conflicting conclusion needed resolution. Each report states its scope, snapshot, code locations and missing evidence. No whole-project defect was inferred from omitted fixture files.

- Local evidence workspace: `/var/folders/by/mz1s49k13p3d7xvfr357w1kw0000gn/T/plasmic-codegen-direction-review-oyvr3aq7/`; reports: `design/review.md`, `behavior/review.md`, `engineering/review.md`.
- Original cases SHA-256 remains `e6120dfbc43451780a3749035fd2db56533ca6fcbc3eb43484ba97a17b29c3ce`. Updated references SHA-256: `fe86462f098e55d38046f5f0e665f7a8ee0b37de4c37bf0ebae3df9f80047f07`, using the same ordered path/NUL/bytes/NUL method.
- Resource/link/anchor/reachability and component-reference validation passed for 197 resources; codegen mustRead is 24,399 bytes under the unchanged 24,576-byte limit. Evaluation JSON/local links and `git diff --check` also passed.

This run checks the output of three explicitly assigned directions and parent reconciliation. It does not test autonomous direction selection, limited-concurrency scheduling, justified merging, conflict resolution, unavailable delegation, or repair/re-review under the new grouping. The earlier fallback and repair runs remain evidence for their pinned rules only. No live application, runtime/visual verification, publication or installed-skill update occurred.
