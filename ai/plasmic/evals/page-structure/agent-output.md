# Independent offline evaluation of the updated Plasmic skill

Date: 2026-10-30. Repository: /Users/yanxianliang/shiguang/plasmic.

> **Current re-evaluation:** The three earlier findings are resolved in the current on-disk files. Scoped inventories was independently executed and verified; structure-only requests may explicitly stop at the draft before live contract reads. The original evaluation below records the earlier snapshot; the re-evaluation section at the end supersedes its three outstanding findings and case-6 inventory command guidance. No remaining actionable contradiction was found within the tested scope.


## Scope and evidence

I read the skill entrypoint and the complete local prototype workflow, planning, page-structure, page-types, admin-templates and admin catalog references. I also read requirement-alignment and the relevant form-layout rules, and inspected layout's scroll/header rules and prepare_plan.py's scaffold/inventories implementation. I did not open Desktop, call MCP, install a library, inspect live contracts, mutate the repository, generate a business prototype, or execute Preview. The skill entrypoint's published resource resolver was not run: this evaluation explicitly selected local repository sources and prohibited online preparation. These are local-source findings, not proof of a current published bundle.

All structures below are **structure drafts**. Names are proposed internal anchors, not observed node identities. The source is the numbered prompt supplied for this evaluation. No live template evidence path/hash, component registration UUID or measured geometry is asserted. Suggested widths are design targets; none is described as a measurement. Missing actual product fields/routes/APIs remain unknown.

## 1. Message configuration with immediate phone preview

Decision: `pageType: basic-form`. The task is editing one message configuration; the preview is a coupled region, not a catalog workspace or a separate result Page.

`pageStructure` draft:

- intent: Operations edits title, body and jump URL, sees the phone presentation immediately, and makes the change effective by saving.
- source: Prompt 1 explicitly requires those three fields, immediate preview while typing, save-to-apply and desktop. Spatial arrangement is unspecified.
- layout: Existing shell content → horizontal editor/phone-preview workspace. Editor on the left; preview on the right; both initially visible. No extra Page heading, artificial Steps or preview activation button.
- rationale: The user repeatedly compares input with output; simultaneous visibility avoids switching between them. The editable content needs more width than the simulated phone, so I choose an asymmetric split rather than 50/50.
- regions: `MessageForm` owns all three editable values and submission; `PhonePreview` owns the derived phone presentation. These are planned anchors to resolve later.
- sizing: Editor flexible with a usable form width; phone preview content-sized to the actual phone design chosen later. Do not fix the outer Page to a catalog artboard size. Check that both fit the target desktop before finalizing. Body and URL need long-value/full-row treatment under the form rules; do not change protected Form density merely because the outer Page has two columns.
- scrolling: One bounded shell-content Scrollbar initially owns vertical scrolling. Neither pane gets a new independent scroller by assumption. Verify long body/validation states keep preview useful and saving reachable; any necessary pane integration must be supported and checked later.
- actions: Save belongs below the editable fields inside the Form. Preview follows draft values; effective business configuration changes only on successful save. No unrequested cancel/publish/send controls.

Template decision: BasicFormPage is a candidate for its FormCard/form-fields structure only. No complete editor-preview template is listed. CatalogTabsSection is not a candidate merely because it has two columns. Read BasicFormPage's live model and target Form, input and preview-component contracts before finalizing. Do not insert its whole AppShell inside an existing shell.

Observable cases planned, not executed: changing each of the three values updates the preview before Save; typing does not change the effective configuration; successful Save makes the edited configuration effective. Persistence/API behavior is unresolved.

Coherence: This can be drafted offline without asking the user where to put the regions. Final sizing, runtime preview bindings and save implementation cannot be certified offline.

## 2. Rule test run with explicit vertical layout

Decision: closest `pageType: basic-form`, with an operation-output region. This is an input-and-run workspace, not a finished-operation `result` Page. The type label is imperfect because no record is being saved, but its form/action starting guidance is usable.

`pageStructure` draft:

- intent: Enter an expression, explicitly run it and inspect that run's output.
- source: Prompt 2 explicitly says input above/output below, button-triggered execution and no input-triggered refresh.
- layout: Vertical content: `ExpressionForm` → `RunOutput`. The output is always represented in that lower region, with an initial empty state before a run. Do not move it to a Drawer or right-hand pane.
- rationale: Vertical order is a user constraint, not my inference. Keeping output adjacent to its trigger makes the run/result relationship clear.
- regions: `ExpressionForm` and `RunOutput`.
- sizing: Both use available content width. Expression editor is a long-input/full-row field. Output height follows actual result content, with long-output behavior checked later; no arbitrary fixed split.
- scrolling: Existing bounded content Scrollbar owns the vertical flow; Run remains above output and reachable. Do not invent a nested native code-output scroller before inspecting the relevant integration.
- actions: “试运行” is the form-owned primary action. It snapshots the submitted expression and updates output only when that run completes. Editing afterward does not run again; preserve the last completed run's output until another explicit run replaces it. No Save or Publish action is inferred.

Template decision: Inspect BasicFormPage's field/action structure as a regional candidate; the complete template does not supply a test runner. Choose output rendering from actual output shape and registered capabilities later. Do not promise Descriptions/Table/Result without knowing whether the output is attributes, rows or free-form text.

Planned cases: typing leaves output unchanged; clicking Run produces output below the input; a subsequent edit does not replace that output. Actual expression semantics, output shape and error contract remain unresolved for implementation.

Finding: page-types has no operational-input/workbench type, and `basic-form` is described specifically as record create/edit. The new “closest type” and “regions inside any type” guidance allows a coherent decision, but this classification deserves an explicit example. Choosing `result` would conflict with its “No Table, Form or second Card” rule.

## 3. Existing AppShell, category tree, filterable products, short editing Drawer

Decision: `pageType: catalog-workspace`; preserve the existing AppShell and replace only its relevant business content.

`pageStructure` draft:

- intent: Select a category, find products in that category and edit a product without losing that context.
- source: Prompt 3 explicitly sets left category tree/right filterable table and Drawer editing. It does not request Tabs or a category-search control.
- layout: `CategoryTree` left, `ProductWorkspace` right; workspace contains filters above product table. `ProductEditor` is a Page-owned Drawer, initially closed, not a routed Page.
- rationale: Selected category establishes the right workspace's data context. A single table suffices; catalog template sample Tabs do not introduce a business requirement.
- regions: `CategoryTree`, `ProductFilters`, `ProductsTable`, `ProductEditor`.
- sizing: Start with the type's 248px category column and flexible right column with min-width:0. This is a draft baseline, subject to live source and realistic content checks. Choose table columns from actual fields so the workspace remains usable; verify supported horizontal scrolling if needed.
- scrolling: Existing shell-content Scrollbar remains the Page vertical owner. Preserve supported Table horizontal behavior. Drawer body uses the verified existing Scrollbar integration and bounded native overlay structure. Do not introduce independent category/table vertical scrolling by default.
- actions: Row edit opens the Drawer for that row. Native Drawer form actions save/cancel; close/cancel returns to the same category/filter context. Selection/filter changes must establish the current table query and reset paging appropriately.

Catalog source: Admin Templates, catalog projectId `145nN6S5QQBwgjtNUwuiQZ`, catalog version 1.0.0. These are index values, not verified live identities or installed versions. Candidates: CatalogTabsSection (left navigation/right workspace), SearchTableSection (right query/table region), DrawerFormSection (short editing). Inspect all relevant source definitions; retain the catalog hierarchy but remove unneeded sample Tabs/search/demo fields after reconciliation. Do not choose SplitTabsPage or StandardListPage insertion because a shell already exists.

Next live read/acquisition: inspect destination identity/edit access/importedProjects and contracts first. If Admin Templates is already imported, use the actual dependency ID in fromProject. Otherwise prefer read-only source inspection; check navigation/save side effects before opening the catalog source and returning. Capture/interpret the complete selected models using verify_templates.py only after source is open/imported. Do not install solely to pass a reading check. Installation is a distinct option only for compatible, authorized actual reuse. Read target Tree, SearchForm, Table, Drawer, Form and action registrations, then resolve anchors and state ownership. A picker is not known available: directoryConfiguration.applied is false in the catalog and current UI is uninspected.

Coherence: No offline blocker to this draft. Missing live access would be blocked acquisition, not a template mismatch or justification for custom HTML widgets.

## 4. Only change Save to Publish on an existing two-column page

Exact authorized change: find the existing target button in the current configuration Page and change its visible text from “保存” to “发布”. Preserve its node identity, location, styling, behavior, handlers, conditions, submission target, existing two-column structure, all other nodes and all other Pages. Do not infer a new publishing lifecycle from the label. If the caption is an instance Slot/prop or shared localization entry, inspect ownership so only the requested instance changes; a global string replacement is not authorized.

Offline result: execution scope and check plan only. I cannot identify the actual button without the current model and have not edited anything.

Next step: read only the affected Page/button and its current text ownership, confirm edit permission, make that one scoped text change using the documented operation, save/read back and visually verify caption/position. Compare the target's behavior binding and unchanged regions against their prior readback; exercise the affected existing action only if necessary and supported. No template replacement, new pageStructure/schema, library installation or full-project redesign is warranted.

Finding: page-structure explicitly exempts a label edit from a new whole-project plan, and prototype workflow allows focused checks for local edits. However the later unconditional “Persistence/delivery: full-project suite” / “Final acceptance” language can make an agent overrun this scope. I interpret the explicit local-edit exception as controlling; a sentence scoping final acceptance to affected Pages would remove the tension. This is a usability inconsistency, not a reason to alter unrelated pages.

## 5. Monitoring metrics, large live topology and node details

Decision: `pageType: overview`. “Monitor indicators, then drill into lists” is only a starting description; no list/filter is required here.

`pageStructure` draft:

- intent: Monitor runtime metrics and topology, then inspect a selected node while retaining topology context.
- source: Prompt 5 explicitly puts metrics above a large live topology and node details on the right; explicitly excludes a filterable list. No full-page catalog match exists.
- layout: `RuntimeMetrics` first; below it a dominant `Topology` region with a conditional right-side `NodeDetails` region on node selection. The details region is an in-page sibling, not automatically a Drawer. No table, filters or generic header.
- rationale: Topology is the main work surface. Right-side details keep the selected node in context; metric strip remains concise rather than taking half the viewport.
- regions: `RuntimeMetrics`, `Topology`, `NodeDetails` (conditional).
- sizing: Metrics content-sized according to actual metric count, not an invented four. Topology takes most available height and flexible width; selected-node details get a readable content-driven width while preserving useful topology width. Exact dimensions remain draft until viewport and node-content information exist.
- scrolling: Use the existing bounded shell Scrollbar. Topology pan/zoom is domain interaction, not a substitute for page scrolling. Any overflow in node details uses a supported shared Scrollbar integration; no unsupported nested pane scrollers are promised.
- actions: Node selection reveals/replaces its right-side details. No extra refresh/export/edit controls are inferred. The contract for live updates and selection consistency remains to be read.

Template decision: No full-page template fits. This is not a blanket templatesNotApplicable exemption: inspect DetailSection's information-region candidate if details are structured attributes; exclude its sample related table. Metrics and topology have no matching catalog section; record those specific scenario mismatches. Discover target registered Statistic/Descriptions and existing business topology compositions by role, then read their real contracts. A topology registration gap is currently unknown, not verified. A custom widget can be considered only after documenting an actual contract gap and exact target; offline uncertainty does not authorize drawing a fake topology with arbitrary HTML.

Coherence: Continue independent structure planning, then compose from verified registered components. The rules do not require forcing a StandardListPage onto this monitor or inventing an unpublished template.

## 6. Three Pages; detail only message list

Global draft decisions:

| Page | pageType | Draft regions and relationships | Proposed flow |
|---|---|---|---|
| 消息列表 | list | Main message Table; list/row actions only where source or current project establishes them. No filter controls or columns invented from the page name. | Existing/proposed edit entry carries selected message to 消息编辑; navigation to 发送记录 depends on actual navigation requirements. |
| 消息编辑 | basic-form | Flexible editor left, phone preview right; current editing values drive the visible preview. Save semantics are not specified in this independent prompt. | Submission/return flow is unconfirmed; retain existing route behavior when read. |
| 发送记录 | list | Send-record table; any query fields, row details and actions pending source. | Its position in the navigation tree is unconfirmed. |

The Page names and live-preview editing are explicit; all route paths and inferred transitions must be marked proposals until actual project/source reads. Sibling drafts each retain the eight pageStructure fields in the real task plan, with sizing/scrolling/actions prose at region level; no sibling component arrays, native props, event names or registrations are fabricated. Message list is the only Page to receive detailed component declarations after requirements and live template/contract reads. Candidate list structure: StandardListPage if standalone or SearchTableSection for an existing shell, adapting away unrequested filters. The shell condition is unknown in this prompt.

Current script handoff (commands shown as future stages, not run for these business Pages):

1. Keep all three Page structures in minimal-plan.json using proposed/current exact routes; only current message-list Page receives real components after live reconciliation. Run prepare_plan.py rules PLAN --project --stage compose once and execute its emitted reader commands into the actual ledger.
2. Run `prepare_plan.py scaffold minimal-plan.json --page CURRENT_LIST_ROUTE --output structure-expectation.json`. It retains sibling drafts; it does not generate the prototypes or infer business values.
3. Run `prepare_plan.py rules structure-expectation.json --page CURRENT_LIST_ROUTE --stage compose --ledger reference-reads.jsonl`, execute all emitted reads, resolve current Page decisions and region anchors from the source/contracts, record actual template evidence and cases.
4. Run `verify_selection.py structure-expectation.json --page CURRENT_LIST_ROUTE --reads reference-reads.jsonl --report list-selection.json`. Draft siblings are not required to pass current-Page readiness. A plan-only run cannot replace this.
5. Derive inventories from the current combined plan using the existing inventories command. It currently has no --page option and emits entries/Slot intents for every Page; do not fill sibling parameters merely to appease these outputs. Use scoped saved-output checks for the completed current Page. Regenerate into a new directory when siblings become detailed; do not claim the provisional all-Page suite is final.
6. Compose/save/verify the current Page before detailing siblings. Cross-Page navigation remains unexecuted while destinations are incomplete; do not open a “final Preview” over placeholders. When resuming the next Page, preserve completed declarations, add only its real components, scaffold it with --page into a new output, then repeat. Final full-project gates require all scoped Pages complete.

Executed mechanical check (fixture only): `prepare_plan.py example` generated its documented format fixture; I appended two sibling structure drafts with no components, scoped scaffold to the fixture's /records Page, and compared siblings before/after. Scaffold exited 0 and sibling drafts were byte-equivalent as parsed JSON. `verify_selection.py ... --page /records --plan-only` exited 0. This demonstrates scoped scaffold/preflight mechanics, not readiness of a real message list. The actual output explicitly excludes read coverage, source meaning, insertion/detachment, JS execution, visual/runtime acceptance. Captures are referenced below.

## Cross-cutting findings

1. Source adherence: Clear improvement. pageStructure.source/rationale and source precedence prevent both invented location constraints and template sample behavior from becoming requirements. Cases 1/2/3/5 all produce different task-based arrangements without changing the protected component model.
2. Design discretion: Sufficient for useful structure drafts. It explicitly permits asymmetric simultaneous editing/preview, action-result flow, and dashboard composition while preserving explicit vertical/right-side constraints. No routine approval step is needed. Geometry-dependent Form deviations remain pending until real measurements, which limits finalization rather than draft reasoning.
3. Template discovery/acquisition: Operationally specific. Catalog source, imported dependency lookup, source opening/save side effects, intended reuse vs read-only inspection, evidence capture and no-fit vs access failure are separated. Regional template reuse prevents an unjustified all-or-nothing exemption. Case 3 can adapt away sample Tabs; case 5 can reuse only the info region.
4. Bounded scope: Strong explicit local edit and sibling draft rules; remaining full-project-final-acceptance wording should be scoped to avoid contradiction (case 4).
5. Executable workflow: Actual scoped scaffold/preflight works with sibling drafts. Inventories still emits all Pages and has no --page flag; this is a minor stage-handoff rough edge worth documenting or filtering later, not proof of a blocker. A draft does not require fabricating a runnable complete selection file.
6. Taxonomy friction: A rule test runner is not literally one-record creation/editing or a finished-result Page. The nearest-type guidance makes basic-form workable, but choosing-the-type lacks an operational-input example. “Overview then drill into lists” is also narrower than case 5; the explicit omit-unrequired-regions rule resolves it.
7. Evidence honesty: Offline structure draft is achievable; finalized-current-Page/prepare-inputs/composition acceptance is not. The instructions should not be read as forbidding delivery of a requested draft merely because the later live-read gate cannot pass. The execution table already distinguishes these states correctly.

No instruction prevents coherent completion of the six requested offline artifacts. There are three concrete ambiguities/rough edges: local-edit versus unconditional final-suite wording, operation-workbench pageType routing, and unscoped inventory generation after scoped scaffolding. None warrants fabricated live reads, forced user confirmation or extra UI content.

## Mechanical evidence paths

- Fixture/scaffold/preflight outputs: /var/folders/by/mz1s49k13p3d7xvfr357w1kw0000gn/T/plasmic-structure-offline-eval-gblxtv0b
- Scoped report: /var/folders/by/mz1s49k13p3d7xvfr357w1kw0000gn/T/plasmic-structure-offline-eval-gblxtv0b/scoped-preflight.json
- Scaffold result: /var/folders/by/mz1s49k13p3d7xvfr357w1kw0000gn/T/plasmic-structure-offline-eval-gblxtv0b/scaffold-result.txt
- Draft input/output: /var/folders/by/mz1s49k13p3d7xvfr357w1kw0000gn/T/plasmic-structure-offline-eval-gblxtv0b/multi-page.json and /var/folders/by/mz1s49k13p3d7xvfr357w1kw0000gn/T/plasmic-structure-offline-eval-gblxtv0b/scaffolded.json

### Case 6 concrete sibling structure drafts

These are the actual region-level decisions I would retain, without native component parameters. Routes remain absent here because the project is unavailable; the runnable plan needs current/proposed exact routes explicitly identified before scripting.

```json
[
  {
    "name": "消息列表",
    "pageType": "list",
    "pageStructure": {
      "intent": "浏览消息并进入对应消息的编辑流程",
      "source": "Prompt 6 names 消息列表 and 消息编辑; the edit entry is a proposed shared flow, and fields/filters are not specified",
      "layout": "单一消息列表主区域；已有筛选和动作待读取后保留，不从模板样例新增",
      "rationale": "列表是当前任务入口，保留连续阅读与进入单条编辑的空间；导航关系需与现有项目核对",
      "regions": [{"nodeName": "MessagesTable", "purpose": "消息记录的主列表，列集合待需求读取"}],
      "sizing": "主列表占用可用内容宽度，真实列宽和分页能力待契约读取",
      "scrolling": "沿用现有壳的共享 Scrollbar；表格横向滚动按实际契约验证",
      "actions": "仅细化需求或现有项目已确认的列表/行操作；暂不添加发送、删除、导出等动作"
    }
  },
  {
    "name": "消息编辑",
    "pageType": "basic-form",
    "pageStructure": {
      "intent": "编辑消息并观察实时手机预览",
      "source": "Prompt 6 explicitly requires 消息编辑（实时手机预览）; field list, save semantics and region positions are unspecified here",
      "layout": "左侧编辑，右侧手机预览，同屏可见",
      "rationale": "实时关联的输入和输出需要同时观察；这是设计推断，不把 Prompt 1 的具体字段或保存规则移植到独立 Prompt 6",
      "regions": [{"nodeName": "MessageEditor", "purpose": "消息编辑区域"}, {"nodeName": "PhonePreview", "purpose": "当前编辑内容的即时手机呈现"}],
      "sizing": "编辑区弹性占宽；手机预览按真实展示内容约束宽度，目标桌面适配待核对",
      "scrolling": "沿用现有壳共享 Scrollbar；暂不增加独立分栏滚动",
      "actions": "提交动作、保存后行为及返回路径待当前需求和现有项目读取；不提前生成事件参数"
    }
  },
  {
    "name": "发送记录",
    "pageType": "list",
    "pageStructure": {
      "intent": "查阅消息发送记录",
      "source": "Prompt 6 only names 发送记录; no filters, columns or row operations are specified",
      "layout": "发送记录表格为主内容；不提前添加筛选、Tabs 或详情抽屉",
      "rationale": "用最少区域表达已知记录查阅职责，避免借模板示例扩充业务范围",
      "regions": [{"nodeName": "SendRecordsTable", "purpose": "发送记录主列表"}],
      "sizing": "列表使用可用内容宽度；列和记录量明确后决定细节",
      "scrolling": "沿用现有壳共享 Scrollbar；不预设表体独立纵向滚动",
      "actions": "当前未要求独立业务动作；导航归属待读取项目与需求"
    }
  }
]
```

The independent prompts do not share unspecified requirements: case 6 does not inherit case 1's three fields or save-to-apply behavior.

## Re-evaluation against current on-disk files

I reread the complete current workflows/prototype.md and design/page-types.md, the changed planning.md inventory guidance and prepare_plan.py implementation/CLI dispatch. I inspected page-structure.md and SKILL.md around live-read/finalization boundaries. The conclusions below come from actual file contents and CLI output, not the change description provided by the parent agent. Offline/read-only-repository constraints remained in force.

### 1. Local-edit acceptance scope: resolved

The workflow now says “For local edits or other libraries, use scoped library checks; preserve unrelated Pages and report coverage gaps.” Its persistence/delivery row uses “scoped suite (full project for complete generation)”; Final acceptance explicitly says “Keep local-edit acceptance scoped to affected regions and flows.” These instructions consistently support case 4's single-button text edit. No whole-project redesign or library preparation is required solely for that edit. The original contradiction is withdrawn.

### 2. Input-and-run page type: resolved

The choosing-the-type row now assigns basic-form to “Enter a short field set to save a record or run an operation.” The immediately following instruction explicitly says an input-and-run tool uses the closest form type plus its output region and must retain the real Run action without inventing Save or persistence. Case 2 can now select basic-form directly, preserving explicit vertical layout and click-only output updates. The overview row also includes a “visual workspace,” so case 5's topology monitor is directly covered. The earlier result restriction has been softened to retain source-required result details. The original classification concern is withdrawn.

### 3. Scoped inventory generation: resolved by execution

The current CLI exposes inventories --page. write_inventories filters its in-memory pages for deriving Form/Descriptions/overlay inventories and Slot intents, while suite.structure.inventory still points to the original plan_path. planning.md documents both this complete-source reference and the requirement to run verify_all.py --page with the scoped outputs.

I used the existing multi-Page scaffolded fixture from the first evaluation, containing /records plus two component-free sibling drafts. I generated project and current-Page compose cards, executed all 26 emitted local reference-reader commands into a real JSONL ledger (zero reader failures), retained their output on disk, and ran:

```sh
python3 /Users/yanxianliang/shiguang/plasmic/ai/plasmic/scripts/prepare_plan.py inventories /var/folders/by/mz1s49k13p3d7xvfr357w1kw0000gn/T/plasmic-structure-offline-eval-gblxtv0b/scaffolded.json --page /records --reads /var/folders/by/mz1s49k13p3d7xvfr357w1kw0000gn/T/plasmic-structure-offline-eval-gblxtv0b/reread-compose.jsonl --output-dir /var/folders/by/mz1s49k13p3d7xvfr357w1kw0000gn/T/plasmic-structure-offline-eval-gblxtv0b/scoped-inventories-rereview
```

Observed results:

- Exit code: 0.
- Exactly one intent file: intents/%2Frecords.html.
- suite.slots.pages contains only /records.
- forms-inventory.json, description-inventory.json and overlay-inventory.json each contain exactly one Page entry, /records. These inventories have empty region arrays because the selected fixture Page has no Forms, Descriptions or overlays; this check verifies Page scoping, not field derivation.
- No sibling routes occur anywhere in the generated output content.
- Resolving suite.structure.inventory leads to the original complete scaffolded.json, which still contains /records, /draft-message-edit and /draft-send-history.
- The complete source plan's SHA-256 before and after is identical.

Updated case-6 handoff: use `prepare_plan.py inventories PLAN --page CURRENT_LIST_ROUTE --reads LEDGER --output-dir NEW_DIRECTORY` after current-Page readiness, then scoped verification. Keep sibling drafts in the complete source plan. Omit --page and regenerate a complete suite only once all in-scope Pages are ready. The previous lack-of---page finding is withdrawn.

This fixture run does not establish real business source coverage, live template contracts, Preview behavior or final readiness. No live validation command was executed.

### 4. Structure-only stopping boundary

The workflow's Working set now explicitly says “Structure-only requests stop at the draft; live access is required before finalization/composition.” page-structure.md separately requires live templates/contracts before finalizing and markup, not before making a draft. The draft completion row requires Page tasks, regions, relationships and shared flows; siblings can remain unplanned at component level. Together these provide a coherent stopping point for cases 1, 2, 3, 5 and 6: deliver useful region-level decisions and pending reads without claiming finalized composition readiness. Case 4 remains only an execution-scope description offline.

The numbered workflow still starts with project identity resolution, but the explicit structure-only exception makes it clear that missing live identity/contract access does not block a requested draft. I do not regard this as an actionable contradiction. Actual destination inspection remains required before edits.

### Current result

All three original concrete findings are resolved. No remaining actionable contradiction was observed for the six scenarios and the tested stage handoff. The original scenario structures remain valid, with case 2 now directly supported by basic-form and case 6 using scoped inventories. Missing business details and live evidence remain deliberately pending rather than being invented.

Re-evaluation evidence:

- /var/folders/by/mz1s49k13p3d7xvfr357w1kw0000gn/T/plasmic-structure-offline-eval-gblxtv0b/scoped-inventories-cli.txt
- /var/folders/by/mz1s49k13p3d7xvfr357w1kw0000gn/T/plasmic-structure-offline-eval-gblxtv0b/scoped-inventories-observations.json
- /var/folders/by/mz1s49k13p3d7xvfr357w1kw0000gn/T/plasmic-structure-offline-eval-gblxtv0b/scoped-inventories-rereview/suite.json
- /var/folders/by/mz1s49k13p3d7xvfr357w1kw0000gn/T/plasmic-structure-offline-eval-gblxtv0b/reread-project-card.json
- /var/folders/by/mz1s49k13p3d7xvfr357w1kw0000gn/T/plasmic-structure-offline-eval-gblxtv0b/reread-page-card.json
- /var/folders/by/mz1s49k13p3d7xvfr357w1kw0000gn/T/plasmic-structure-offline-eval-gblxtv0b/reread-compose.jsonl
