# Visual scenario coverage and repair evidence

Use during prototype planning, saved-model review and final acceptance. Keep source scenarios in the existing Page plan and observations in the existing rule review. Final review checks coverage against the saved Page model so an omitted hidden branch cannot disappear merely by omitting its test case.

## Discover the scenes

Before composition, inspect the source for distinct visual outcomes. Include initial/loading/empty/error/result states, role and record conditions, direct and conditional entry points, nested panels, Tabs, expanded rows and supported design variants. Record additional source-derived cases under the Page's `visualScenarios` array. Each entry has `id`, `kind`, `nodeName`, `state`, `source`, `given`, `steps` and `expected`. Use concrete fixture setup and entry steps. Reference the actual source section in `source`. Reuse a runtime case ID when the visual scene belongs to that case.

At saved-model review, `prepare_plan.py review-skeleton` merges those declarations with scenes discovered from the full public Page model. The default Page view, discoverable variants, Tab panels, overlays, expanded row content and visibility/control conditions receive their own scene identities. Retain the generated IDs and target/state descriptors. Follow nested branches through their real parent entry sequence.

Supply the matching project `overview.json` alongside `pages.json`. Its captured local global variant groups and active screen breakpoints supply the project-level variant inventory. Read imported dependencies through their public `fromProject` inventories when their global contexts affect the scoped Page, and declare those applicable scenes in the plan. Exercise each required variant at its actual target and viewport. Public single-variant exports do not establish combined-state coverage, so record meaningful interacting combinations explicitly from the sources and component inspection. Under a permanently hidden ancestor, inspect the hidden owner and surrounding layout. Descendants that cannot be reached in that context use that owner's hidden-state evidence.

Reconcile the resulting inventory with the original sources and component contracts. Expressions can contain multiple business outcomes, and imported component implementations can own hidden surfaces or global variant contexts that a public Page tree does not enumerate. Add those scenes explicitly to the Page plan before regenerating the review. Record that reconciliation in each Page review's `sourceCoverage` with `reviewed:true`, nonempty `sources` citations and concrete `notes` describing the checked state/entry inventory. Missing or inaccessible required fixtures remain pending.

Use one case per distinct required visual outcome. Exercise interacting variant combinations when the requirement or actual variant settings establish that interaction. Static permanently hidden content has its actual hidden state checked. A conditional entry needs observations of its applicable available/unavailable states and the destination it opens. Keep requirement scope and test setup outside the business UI.

## Enter, capture and analyze

Use native Preview to follow each scene's `given` setup and `steps`. Preserve the real route, selected record, role, viewport and parent panel context in the setup. Use supported design variant controls when a scene belongs to a design variant. Wait for the required state, capture it, and open the image for visual analysis. A transient loading or feedback state needs capture while it is visible. Closed/hidden outcomes need a screenshot of the owning region showing the expected surrounding layout and entry control.

Retain the original PNG, JPEG or WebP file returned by the capture tool and its SHA-256 digest. Capture files must exist at absolute paths. Use a distinct capture for each scene and each repair verification. For long panels, inspect the necessary scroll positions and content bounds, including footer actions. Add separate source scenes for additional views needed to establish complete coverage.

Each Page review contains `visualScenarios`, with one entry per discovered or declared scene. Every entry retains `id`, `kind`, `nodeName`, `state`, `given`, `steps` and `expected`, followed by an ordered `attempts` array. Each attempt records the following fields.

| Field | Required content |
| --- | --- |
| `checkedState` | Actual captured `projectId`, `branchId`, `sessionId`, `revision` and `changeCounter` |
| `screenshot` | `{path, sha256}` for the observed image |
| `analysis.layout` | Concrete observations about alignment, spacing, dimensions, clipping, overlap and scroll reachability |
| `analysis.content` | Visible fields, labels, values, status, empty/error content and completeness for this scene |
| `analysis.controls` | Entry/action visibility, enablement, focus and accessible interaction surfaces relevant to the scene |
| `issues` | Explicit array of observed defects, each `{id, description}`. Use `[]` when analysis finds none |
| `repairs` | Explicit array of fixes performed after this observation, each `{issueId, change}`. Use `[]` when no fixes were needed |

Analysis must explain what was observed. A filename, tool receipt or generic “pass” cannot explain whether a panel's content fits or whether a conditional entry is correct. Check against the requirement and component rules. The reviewer retains responsibility for interpreting the pixels and verifying that the setup actually reached the intended state.

For each affected Tab panel, check heading ownership against its actual content scope. A label identifying one business block needs no repeated section/component title; inspect synonyms as well as exact text under [Tabs panel heading ownership](libraries/antd_v6/components/tabs.md#panel-heading-ownership). In `analysis.content`, distinguish record labels and multiple-region headings from redundant titles, and assess accompanying notes under [copy economy](design/content-review.md#copy-economy), including information already conveyed by fields/status. In `analysis.layout`, check for empty header/note rows, dividers and reserved spacing after repair; record the tab-bar-to-first-content measurement at every affected nested Tabs level under [panel entry spacing](libraries/antd_v6/components/tabs.md#panel-entry-spacing). Check 0px by default, or the explicitly required nonzero value with its source; retained theme spacing is not an exception. Screenshot evidence completeness alone does not establish that these semantic checks passed.

## Repair and verify

Preserve failing attempts. Identify each issue, close Preview, repair the authorized model, save and capture the same scene again. Record the concrete change against its issue ID, then append the new screenshot and analysis. A repair record needs a later observation. The final observation must have an empty issue list and match the final review's captured model identity. Reopening or changing the model requires current evidence for the affected final review.

If a defect remains, retain its issue ID in the next attempt and continue the existing repair loop. Keep required failures and pending scenes visible in the report. Regenerating a skeleton provides pending entries only. Merge prior attempts by scene ID and retain issue history when updating the review. Never erase an earlier defect to make the final scene appear clean.

## Run the existing acceptance gate

Use the same saved capture and complete Page readback for preparation and verification.

```sh
python3 RESOURCE_ROOT/scripts/prepare_plan.py review-skeleton PLAN --page ROUTE \
  --capture RUN/capture.json --pages RUN/pages.json --overview RUN/overview.json --mode independent --output REVIEW
python3 RESOURCE_ROOT/scripts/verify_review.py PLAN --page ROUTE \
  --capture RUN/capture.json --pages RUN/pages.json --overview RUN/overview.json --ledger ACCEPT_READS --review REVIEW
```

The unified full-project runner supplies its collected Page models to this check. Final review requires source reconciliation, exact scene coverage, existing intact screenshot files, concrete analysis, issue/repair/retest history and a current final state. Missing, duplicate, unknown, relabeled, unexecuted or stale scenes fail. Each observation needs its own capture artifact. Matching image bytes across separately captured states are valid when their visible pixels agree. The digest verifies file integrity. Actual capture execution and state setup are reviewed against the retained tool evidence.

The gate checks the public model structures it can identify and the source scenarios declared in the plan. Source completeness, actual fixture setup and the correctness of visual judgement remain review obligations. Report those separately from the mechanical result. Local repairs review their affected scope and retain explicit limits instead of claiming whole-Page acceptance from a partial capture.
