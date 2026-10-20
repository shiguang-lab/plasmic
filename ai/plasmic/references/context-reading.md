# Context reading and evidence

Preserve all applicable design and acceptance requirements, including source inventories, hidden branches, Preview, visual review and save/reopen. Reduce repeated and unrelated material, never coverage.

## Read by task and section

Read `mustRead` in full. Follow conditional references for the actual task/library/component; links do not require recursive full reading. Discover unknown scope before excluding it. Library indexes own shared rules; search catalogs for exact used registration keys, then read their component contracts. Read the complete admin-template catalog for selection and the selected live templates/nested definitions. Live metadata remains authoritative.

Use the resource's section reader for conditional documents:

```sh
python3 RESOURCE_ROOT/scripts/read_reference.py RESOURCE_ROOT/references/libraries/antd_v6/components/form.md --outline
python3 RESOURCE_ROOT/scripts/read_reference.py RESOURCE_ROOT/references/libraries/antd_v6/components/form.md --section values-and-validation --section events-and-ref-actions --section acceptance --log /absolute/task/reference-reads.jsonl
```

This is a partial Form example: also follow its reading route for fields, project/focused acceptance and present conditional features. Selectors retain complete sections/descendants, ancestor introductions and registration preamble, without overlapping duplicates. Unknown selectors fail. An outline is discovery, not a completed read. Read the full file when all sections apply.

Record the resource release/hash and read sections. Reuse understood unchanged rules across pages. After compaction retain the requirement inventory, project/session/revision, library versions, read ledger, evidence paths, decisions and unverified checks. The ledger cannot replace lost understanding: reread needed rules. Resolve resources for each new task; refresh affected contracts after source, library or session changes.

## Model reads and tool results

Use [controlled task references](prototype-tasks.md#read-original-pen-references) when .pen files are supplied: top-level summaries first, then current-Page scoped properties and screenshots, with explicit state coverage. Avoid whole-document visitors that print every nested frame. Unchanged source evidence is reused by identity; text extraction alone is not reference fidelity.

MCP JSON appears once in `content.text`. For `ResultReference`, use `read_result(resultId, path)`: follow `nextOffset`, append nested entry keys to inspect `reference`s, and concatenate string `text` pages. Read needed fields rather than unrelated data. Snapshots persist within this connection, up to 16 / 64 MiB; consume them before eviction/disconnection. Never replay a successful mutation to recover output. Save complete required evidence locally; inspect every error/receipt, relevant contracts and failures. Do not truncate required Props, Slots, states or interactions, or guess identities.

`get_app_state` returns compact status/buildId; view:tools lists names, toolNames selects contracts. executeBatch points to execute_batch: read constituent contracts instead of the union; schemaView:full retains complete schemas. Do not trim definitions/references. Reuse within the same buildId/session. get_build_info supplies provenance; get_image_service_status supplies configured/model status; get_editor_view supplies the restoreEditorView snapshot. Management tools return identities/parents only, without permissions or a full bypass.

Read relevant inventory per project change, then use structural `tree` or paginated `queryElements` to locate nodes. Read `properties` for instance values/styles/text, optionally `propNames`/`fields`; `contract` for registered Props/Slots, `context` for owning states/events/queries. Visit custom components and hidden Tabs/overlays; references/unrequested fields are not empty. Full canonical evidence still uses `view:"full", depth:"all"`; project inventory `fields` can exclude unrelated dependency directories. Inspect ordered mutation receipts, preserving every creation identity/message/failure, then read affected models explicitly. Batch completion is not acceptance.

For library discovery use `read {collection:"importedProjects"}`, then `read {fromProject:"DEPENDENCY_ID",collection:"components",nameContains:"ExactNeededName"}` and targeted `view:"contract"`. Do not request full project models merely to list imports; a full selected Page for acceptance is a separate need. The per-result byte limit does not bound accumulated context. After each completed Page retain a compact checkpoint (route/IDs, decisions, resource/build identity, report/image/Preview evidence paths, pending cross-page checks), keep full evidence on disk, and use the client's supported compaction when history grows. Never claim compaction happened without observing it, or load an entire requirement/model repeatedly after compaction.

## Acceptance evidence

Use [unified verification](verification.md): collect complete Pages/layouts once per design state, then rerun every applicable gate against those files. Inspect compact statuses and failed-check details; retain complete evidence and reports. Repeated component instructions do not require duplicate captures.

Live model reuse requires matching project/branch/session/revision/changeCounter/build and file hashes; always refresh layouts. Fresh save/reopen captures, actual Preview, screenshots, layout/scroll review and source-derived acceptance remain mandatory. Offline replay proves only the captured state. Missing or failed checks never become passes to save context.

For long external Markdown, use the same reader on `/absolute/requirements.md`: `--outline`, then `--section EXACT_ANCHOR --log /absolute/task/source-reads.jsonl`. Read relevant sections and latest decisions completely; freeze citations, coverage and scope before Pen/library discovery. A truncated file view is incomplete; do not mix character offsets with line ranges or assume omitted sections were read.

During controlled generation get_app_state.prototypeTask reports actual phase/pending cases and task-local RPC byte counts. For optional transport counters set PLASMIC_MCP_METRICS to a private local JSONL path in the MCP process environment; it records tool/operation, input/wire/text/image bytes and elapsed time without argument values or content. RPC bytes include local verifier traffic and are not retained model-context bytes. Provider input/output/cache usage must come from the actual client/provider; never estimate it from file size or claim automatic compaction.
