# Service and simulation probes

Use [cases.json](cases.json) with the current `references/workflows/codegen.md` and `references/codegen/{services,project-code,interactions,acceptance,review}.md`. These are offline decisions, proposed implementation snippets and source-review probes, not a live application. Give a fresh evaluator only the cases and references, not this rubric or previous results. Keep inputs stable; restrict outputs to a temporary directory and prohibit live access, business repository changes and further delegation.

Grade the actual decisions and code against source facts, including these cases; do not count matching words or the evaluator's own pass verdict. No probe may claim observed runtime/visual/network/production acceptance from these inputs.

| Case | Expected observable decision |
| --- | --- |
| distributed-contract-network | Combine PRD, technical note and review comment without asking again for already supplied APIs. Use the existing request contract and raw mock envelope, shared mutable data and both permission branches. Require real-route flow and handler/request evidence despite complete API docs. |
| no-docs-local-data | Do not ask again or invent backend facts. Produce explicit inferred fields/types/rules and minimal development-only service/local data code with stable IDs, updates, legal workflow transitions and approval permissions confined to simulation. Data survives route changes, supports reset and deterministic failure. No fabricated endpoints may reach real servers. Explain local versus network coverage; no mock-platform installation. |
| missing-docs-unanswered | Ask once for documents or confirmation to infer, preserving pending status. Continue independent work. Neither assume silence means no documents nor leave the final data path permanently empty. |
| partial-conflicting-inaccessible | Preserve the confirmed list contract, identify conflicting approval definitions and inaccessible rules, ask a focused question. A 403 is not evidence of absent documentation; do not silently choose or blend APIs. |
| review-network-bypass | Identify ineffective switch, service bypass, nonpersistent writes/duplicate ID, missing review permissions/actions and unsupported acceptance claims. Require repair in the existing network mechanism and real-route checks, not new local fallback. |
| review-valid-local-boundary | Accept the permitted local service boundary without installing network infrastructure. Keep page runtime and production isolation unverified; local unit tests do not establish those results. No unsupported rewrite or invented defect. |

Record the reference and fixture hashes, actual evaluation reports, parent assessment and limits in the result record. Separate static decisions from executable integration and UI evidence. Rerun affected probes after material rule repairs; a single successful offline run does not establish production codegen reliability.
