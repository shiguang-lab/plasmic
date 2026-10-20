# Controlled native Page generation

Use for new full-project generation of standalone fixed-viewport Pages supported by the Overseas/Antd-v6 verification suite. Focused edits, read-only inspection, host-owned/content-growing layouts and other libraries keep their existing scoped workflows; this task does not impose a new Studio model. Read live tool schemas. Run the MCP capability preflight after resolving the editable project and installing needed libraries, before business content writes.

## Prepare source expectations

Create the reviewed suite, routes/fields/actions, current-Page Slot intent and runtime cases before content generation. Every Page in the structure inventory has `runtimeCases`. A case records a source citation, ordered Preview `steps`, and exact DOM `assertions`. Choose field labels/actions during design planning; runtime refs are discovered later, never stored in expectations. Every Page also declares `pageHeader:null` by default, `components` for required native widgets and `copy:{source,excluded,help}` from the [source review](requirement-alignment.md#presentation-copy-and-native-components). Apply [component selection](libraries/index.md#native-component-selection) before markup, including actions, navigation and feedback. A styled imitation cannot satisfy a native identity. Any `elementFallbacks` must describe exact named targets, verified contract gaps and sources in the pinned plan before writing. A header exception needs an explicit current user request. Excluded process sentences and genuine field help are reviewed separately. Empty arrays mean reviewed source inapplicability, not discovered output omissions. These declarations are checked at start and in the structural report. For example:

```json
{
  "path":"/records",
  "name":"记录列表",
  "source":"requirement.md §List",
  "pageHeader":null,
  "components":[{"nodeName":"RecordsTable","component":"plasmic-antd6-table","source":"requirement.md §List"}],
  "copy":{"source":"requirement.md §UI copy review","excluded":[],"help":[]},
  "runtimeCases":[{
    "id":"unmatched-query",
    "source":"requirement.md §List: query changes displayed results",
    "steps":[
      {"action":"fill","role":"textbox","name":"Keyword","value":"NO_MATCH_TEST"},
      {"action":"click","role":"button","name":"Search"}
    ],
    "assertions":[{"kind":"text","text":"No matching records","present":true}]
  }]
}
```

These labels/messages are illustrative design choices, not library defaults. Use the actual planned native component contracts and the business language. Cover query/reset, editable fields, validation failure/recovery, two distinct records, required overlays/processing and short viewport scrolling where required. A read-only Page may have a snapshot step and content assertions. Steps can use open/close/click/hover/fill/select/press/scroll/snapshot; the final assert is separate. `fill`/`select` values, key presses and scroll deltas are pinned. `role` and optional exact `name` constrain interaction targets. Assertions support text presence, visible role/name, role/name count, and one role/name control's value. Runtime-case coverage still needs independent source review; the controller cannot derive omitted requirements from prose.

For navigation requiring an unfinished sibling, mark only that case `deferred:true` and declare its `targetPath`. Every Page needs nondeferred checks. Deferred cases run after all Pages complete and remain mandatory before finish. Do not defer failed local behavior or backend boundaries.

## Read original Pen references

When the prompt supplies .pen files, add `references:{"inventory":"reference-inventory.json"}` to the suite and inventory every Page. Use the original absolute file paths. First call `design_reference` with action index and follow pagination; it returns top-level frame summaries. For the current Page select its real main/state frames, then read each frame's native layout/style/child IDs with action read, normally depth 1. Reads resolve native variables and component instances. Follow nextOffset; target relevant child subtrees for detail instead of requesting the whole document. Acquire each planned frame with action screenshot. The tool calls the installed Pen MCP; it does not parse raw .pen JSON or edit the source. It returns inline compressed images, which must be inspected.

Example reference inventory:

```json
{"pages":[{
  "path":"/records",
  "name":"记录列表",
  "references":[{"id":"list-default","filePath":"/absolute/reference.pen","nodeId":"ACTUAL_FRAME_ID"}],
  "regions":[{
    "referenceId":"list-default",
    "nodeNames":["SearchForm","RecordsTable"],
    "decision":"Keep the filter/table hierarchy and density; use native SearchForm and Table/Column with real behavior."
  }]
}]}
```

Include actual detail Tabs, overlays and distinct states; several Pen frames may correspond to one native Page with Tabs/Modals, not separate routed Pages. Region nodeNames refer to planned native model names; this mapping contains no alternate props or persisted designer schema. Read container layout, padding/gap/alignment and relevant type styles, not text alone. One pair of source screenshots cannot cover unrelated pages/states. Cache unchanged reference reads across equivalent regions; explain genuine equivalence instead of silently omitting coverage.

Business scope follows the user's current requirement; visual hierarchy follows the applicable reference. Record conflicts and responsive adaptations with source citations. Native Desktop remains the design device even when a Pen frame is narrower. Do not turn rendered reference rectangles into static SQL/input imitations or add a Card to every region. Use installed component Props/Slots as the implementation contract.

Confirm the actual model client delivers image blocks to an image-capable reviewer. A returned image, a file path or image byte count does not prove that the model saw pixels. If the client/model cannot inspect images, use an image-capable or human reviewer and retain the Page as visually unverified until that review; never infer a matched result from extracted text/layout alone. The task records image provenance and observations, not proof of a model's perception or an independent fidelity verdict.

On macOS the Desktop discovers the installed Pen MCP. Other installations set `command` (absolute executable) and `args` in Desktop user-data/design-reference.json. This is a local MCP connection configuration, not another model provider. If Pen is unavailable, resolve that capability before reference-dependent generation; do not claim a file read based on its name.

## Start and advance

After preparing reviewed inventories, call:

```json
{"action":"start","projectId":"PROJECT_ID","suitePath":"/absolute/task/suite.json","resourceRelease":"RELEASE_ID_FROM_CONTEXT_RESOLVE","sourceFiles":["/absolute/requirement.md"],"referenceFiles":["/absolute/reference.pen"]}
```

Use `prototype_task`, not execute, for this command. `sourceFiles` pins original local requirements or retained URL source copies; record original URLs in citations. A task without supplied Pen files uses `referenceFiles:[]` and no reference gate. The task pins source/configuration hashes and current project/branch/build, creates only private local evidence files, and starts no model or design mutation. It returns evidenceDirectory and compact progress. Create all planned empty native Pages with the reviewed names first. Directory names default to Chinese; internal node names stay English PascalCase. Set page_layout.overviewName (default 页面总览); inspect/rename the native automatic overview through updateCanvas before content, preserving its Page references. Empty destinations are allowed; business content is constrained to the active Page.

For each Page:

1. Read its selected Pen frame properties/screenshots if applicable. `prototype_task {action:"begin_page",pagePath:"/records"}` checks these reads and pins its Slot intent before business writes.
2. Generate current-Page structure and behavior. The controller rejects business writes to another Page, including batches. Shared/global changes invalidate affected acceptance; ordinary native mutation/batch contracts remain unchanged.
3. Explicitly save the current edits, then run `verify_all.py --profile ... --page /records ...`. A successful live run automatically registers structural_check with matching actual model/layout/validate calls, task/session/build identity and reviewed input hashes. An unbound passed-status file or stale capture cannot register a checkpoint. Inspect failures; fixes require renewed evidence. A persistence revision advancing with unchanged native changeCounter does not invalidate other Pages; actual untracked model changes do.
4. Acquire current-Page `get_screenshot` with explicit componentUuid after the structural check and inspect it beside the reference. Collect state-specific images with native Preview screenshot while exercising Tabs, overlays and processing states in step 5. Every distinct source reference state requires its own generatedEvidenceId from an actual screenshot call; one default screenshot cannot cover unrelated Tabs/modals. Consolidate genuinely equivalent source frames explicitly in the reviewed inventory.
5. Open native `preview` and call `prototype_task {action:"begin_case",pagePath:"/records",caseId:"unmatched-query"}`. Discover current controls through snapshot, use their runtime refs for the pinned steps, then call preview assert with the exact case assertions. Unplanned snapshot/state/screenshot reads may inspect controls; pinned interactions run in order. Only actual successful DOM assertions complete the case. Use separate cases/evidence for processing, success/failure and distinct records. A failed/unfinished case remains pending: cancel_case releases it so Preview can close and the Page can be corrected, then rerun the invalidated checks. Backend simulation does not excuse absent frontend behavior. Record review_visual after inspecting all required images: observations contain referenceId, generatedEvidenceId, result matched/adapted/failed, and a concrete observation. An adapted result also needs reason and source citation. A task with no visual reference uses referenceId page. Failed or stale comparisons block advancement. These are recorded judgments, not an automated visual-quality verdict. Cases can collect state images before this final review; both are required for Page completion.
6. Close Preview, then `prototype_task {action:"complete_page",pagePath:"/records"}`. Missing structure, image comparisons or local runtime cases block completion. Begin the next Page only after completion. Run deferred cases after all Pages are complete.

Editing a Page invalidates its checkpoints; global/shared changes invalidate all affected Pages. Unexpected manual edits or a new editor session invalidate acceptance. Task state is independent of business props and does not change the saved design. `state`/get_app_state.prototypeTask report actual phase, active case/step, pending local and deferred case IDs; acquisition is not acceptance. Cancel records an incomplete task without deleting the design.

## Persistence and evidence

Save explicitly, leave/reopen in a new editor session, and rerun each Page's structural/image/runtime checkpoints without reusing pre-reopen captures. Finish with the full-project verifier, then `prototype_task {action:"finish",reportPath:"/absolute/final/report.json"}`. It requires all Pages, deferred cases, save/reopen and the final live evidence. Its recorded_checks_complete result does not certify the fidelity of source interpretation or independently judge pixels.

The Desktop writes actual ordered events, read signatures, source image proofs, generated screenshots and runtime outcomes under evidenceDirectory. Do not synthesize a timeline or success JSON after generation. Audit the actual recording with:

```sh
python3 RESOURCE_ROOT/scripts/verify_page_sequence.py /absolute/Desktop/prototype-runs/RUN_ID --report /absolute/task/page-sequence.json
```

The audit checks recorded sequence/files, not a new UI execution. Retain independent visual/business review alongside it. Keep full evidence on disk; carry only the active route/IDs, source decisions, proof paths and pending checks across compaction. Do not reread whole references or full project dependencies for every Page.
