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

Where orchestration permits, save full raw results locally. Inspect every error/receipt, exposing relevant contracts, changed models and failures to reasoning. Never truncate required Props, Slots, states or interactions, or guess returned identities.

When the advertised `get_app_state` input supports `toolNames`, use `toolNames: []` for status and `availableEditorTools`, then request needed names before invoking them. Omission returns all schemas. Each selected schema is complete; do not trim its definitions or references. Reuse schemas only within the identified build/session; an unavailable name is not a usable operation.

Read an overview per relevant project change, then target UUIDs/subtrees. Visit custom components once, including hidden Tabs, overlays, states and queries. Read the full owning component whenever its context is needed. Resolve ordered batch receipts against shared resources, preserving every message, identity, model and failure. Batch completion is not acceptance.

## Acceptance evidence

Use [unified verification](verification.md): collect complete Pages/layouts once per design state, then rerun every applicable gate against those files. Inspect compact statuses and failed-check details; retain complete evidence and reports. Repeated component instructions do not require duplicate captures.

Live model reuse requires matching project/branch/session/revision/changeCounter/build and file hashes; always refresh layouts. Fresh save/reopen captures, actual Preview, screenshots, layout/scroll review and source-derived acceptance remain mandatory. Offline replay proves only the captured state. Missing or failed checks never become passes to save context.
