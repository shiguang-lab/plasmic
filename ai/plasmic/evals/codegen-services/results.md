# Service and simulation probe results

Date: 2026-10-27. Scope: six synthetic offline cases in [cases.json](cases.json), assessed against the [rubric](README.md). A fresh-context evaluator read the raw cases and the six specified codegen references without the rubric or previous results. It produced implementation snippets for cases 1/2 and decisions or source reviews for the other cases. It did not modify repository inputs, delegate again, contact services, compile snippets or run a browser.

The parent inspected the actual output against the raw artifacts. This is bounded decision evidence, not a production pass rate or live codegen acceptance.

| Case | Observed result and parent assessment |
| --- | --- |
| distributed-contract-network | Combined the PRD, technical note and review comment; proposed all six service actions through the supplied request signature and shared mutable mock handlers returning raw envelopes. Included reviewer permissions, write/read consistency and real-route/network evidence requirements. Initial pagination/creation defaults needed tighter treatment as pending demonstration behavior; see recheck below. |
| no-docs-local-data | Did not ask again. Produced inferred field/types/state definitions, seed data, a shared Map, stable IDs, query/save/submit/review behavior, deterministic pre-write failure, reset and development permission scenarios. Service selects the local module under DEV plus an explicit switch; otherwise rejects without sending invented requests. Distinguished local error feedback and HTTP/authentication limits. Snippets remain uncompiled. |
| missing-docs-unanswered | Asked once for documents or confirmation to infer, kept the answer pending and continued source inventory/independent planning. Did not equate silence with permission or claim empty placeholders were complete. |
| partial-conflicting-inaccessible | Preserved known list facts, identified conflicting approval paths/payloads and treated 403 as inaccessible documentation. Requested only missing details/correction and withheld dependent implementation claims. |
| review-network-bypass | Identified ineffective mock switch, direct fixture bypass, duplicate IDs/nonpersistent writes, missing review permission/actions and unsupported full-flow/real-API claims. Did not invent defects in unseen UI. |
| review-valid-local-boundary | Accepted local simulation without installing a network platform. Kept page runtime and production isolation unverified, and did not use data-layer unit evidence as network or full-page acceptance. |

## Clarifications and recheck

The evaluator raised two actionable ambiguities: how partial contracts relate to inferred defaults, and who reports local failures when normal request handling owns toast messages. The parent verified both and amended `services.md`: missing details require confirmation or existing inference authorization, conflicts require resolution, demonstration defaults do not establish business acceptance; local errors need one caller-side feedback path with no duplicate feedback on returning to real requests. The parent also shortened the project-code entrypoint to meet the existing reading budget.

The same evaluator re-read the changed references and rechecked cases 1/2/4. It explicitly corrected case 1's pagination base and creation initial state to pending demonstration behavior, retaining the documented submit/review rules; cases 2/4 remained valid. No further required rule changes were reported. The parent checked these corrections against the fixtures. This was a focused rule repair and decision recheck, not a rerun of a complete generated application.

## Evidence and validation

- Local reports: `/tmp/plasmic-codegen-services-ROIIKD/responses.md` and `recheck.md`. These temporary artifacts are not distributed resources.
- Fixture SHA-256: `6f7886dcf0d958dc600059be531a96f5f66147e9d41bb6742a689deb6d626c8c`.
- Final reference SHA-256: `768788b955a3182a787ace7272046272ee8029d7dd0ae79560b42c776b7c105d`, computed as path/NUL/bytes/NUL in this order: `references/workflows/codegen.md`, then `references/codegen/services.md`, `project-code.md`, `interactions.md`, `acceptance.md`, `review.md`. The first run preceded the two clarifications; the recheck covers their effect.
- Resource link/anchor/reachability and component-reference checks passed for 198 resources. Final codegen mustRead is 24,494 bytes, below the unchanged 24,576 limit; directed reading is 60,700 bytes. The initial budget failure was fixed by shortening duplicate wording, not raising limits.
- Existing resource Python tests passed: 517 tests. Fixture JSON parsing and `git diff --check` passed.
- Final local `buildResources` passed, including its 517-test run, manifest/hash validation and verified bundle containing `references/codegen/services.md`. Local release ID: `de1700ebb59949cae5927ec8162d7fafe0a108a0d597ff56779fb8f600774c21`; no publication occurred.
- The generic skill-creator `quick_validate.py` rejected the unchanged skill entrypoint's existing `compatibility` frontmatter key; that validator does not support this field. The entrypoint was not changed to satisfy an unrelated validator.

No business repository, installed skill configuration or published resource was changed. Network/HTTP, real backend permissions, UI runtime, visuals and production behavior were not exercised by these probes.
