# Context reading and evidence

Preserve source coverage, hidden states, Preview, visual review and save/reopen while reducing repeated material.

## Read by task and section

Read `mustRead` in full. Follow conditional references for the source purpose and selected library. Read the applicable decision route and competing component distinctions before selecting; then read chosen component contracts. Unrelated links do not require recursive full reading. Discover unknown scope before excluding it. Library indexes own shared rules; search catalogs for exact used registration keys, then read their component contracts. Read the complete admin-template catalog for selection and the selected live templates/nested definitions. Live metadata remains authoritative.

Keep discovery inside the resolved runtime resources and the current task's supplied sources. Local resources expose the same references/scripts scope as publication; repository evals and past task outputs are not requirement sources. Read current applicable source sections completely and retain their coverage ledger before markup; a first-N-lines excerpt does not cover later permissions, state rules or page decisions.

Use the resource's section reader for conditional documents:

```sh
python3 RESOURCE_ROOT/scripts/read_reference.py RESOURCE_ROOT/references/libraries/antd_v6/components/form.md --outline
python3 RESOURCE_ROOT/scripts/read_reference.py RESOURCE_ROOT/references/libraries/antd_v6/components/form.md --section values-and-validation --section events-and-ref-actions --section acceptance --log /absolute/task/reference-reads.jsonl
```

Library documents use a stage template: the preamble (registration and hard constraints, always included), **Plan decisions**, **Generation rules** and **Acceptance checks**. For a planned Page, the [rules card](planning.md#rules-card-and-read-ledger) lists the stage sections each declaration needs; `verify_selection.py --reads LEDGER` fails when one was not read at the current hash.

Select every applicable section: the reader includes descendants, ancestor introductions and registration preamble without duplicates. Unknown selectors fail. An outline is discovery, not a completed read. Read the full document when all sections apply. Retain release/hash, read ledger, requirement decisions and pending evidence across compaction; reread rules whose understanding was lost. Refresh changed library/session contracts.

## Model reads and tool results

Use [Pen evidence](design-references.md) when .pen files are supplied: top-level summaries first, then current-Page scoped properties and screenshots, with explicit state coverage. Avoid whole-document visitors that print every nested frame. Unchanged source evidence is reused by identity; text extraction alone is not reference fidelity.

MCP JSON appears once in `content.text`. For `ResultReference`, use `read_result(resultId, path)`: follow `nextOffset`, append nested entry keys to inspect `reference`s, and concatenate string `text` pages. Read needed fields rather than unrelated data. Snapshots persist within this connection, up to 16 / 64 MiB; consume them before eviction/disconnection. Never replay a successful mutation to recover output. Save complete required evidence locally; inspect every error/receipt, relevant contracts and failures. Do not truncate required Props, Slots, states or interactions, or guess identities.

Use [MCP read/target selection](desktop-mcp.md#read-and-target) for schema discovery, inventories and targeted model views; [examples](desktop-examples.md) provide exact envelopes. Reuse contracts only within the same build/session and refresh after library changes. Canonical acceptance uses complete `view:"full",depth:"all"` Pages, retained on disk; projections are for locating and understanding affected nodes.

At each Page boundary retain route/IDs, decisions, resource/build identity, evidence paths and pending cases. Use client-supported compaction when needed, preserving this checkpoint. Tool response limits do not bound accumulated model context; do not prepare every Page's detailed markup in advance.

## Acceptance evidence

Use [unified verification](verification.md): collect complete Pages/layouts once per design state, then rerun every applicable gate against those files. Inspect compact statuses and failed-check details; retain complete evidence and reports. Repeated component instructions do not require duplicate captures.

Live model reuse requires matching project/branch/session/revision/changeCounter/build and file hashes; always refresh layouts. Fresh save/reopen captures, actual Preview, screenshots, layout/scroll review and source-derived acceptance remain mandatory. Offline replay proves only the captured state.

For long external Markdown, use the same reader on `/absolute/requirements.md`: `--outline`, then `--section EXACT_ANCHOR --log /absolute/task/source-reads.jsonl`. Read relevant sections and latest decisions completely; record provisional citations, coverage and scope before Pen/library discovery, then reconcile them with actual design evidence/contracts before freezing the plan. A truncated file view is incomplete; do not mix character offsets with line ranges or assume omitted sections were read.

For an instrumented run, use [local execution audit](desktop-context.md#local-execution-audit) for payloads, timings, provider usage and context analysis. Missing metrics remain unknown; ordinary design work does not require enabling full-content logs.
