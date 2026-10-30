# Feedback workflow evaluation

Date: 2026-10-30. Scope: instruction changes and offline decision probes in this repository, not a live prototype task.

## Implementation and engineering review

The scenario is routed from inspect and prototype without another top-level mode or changing the thin skill. It separates authority, inspection/edit/regression scope and expected results; supports feedback with or without images; reuses source alignment, native contracts, review checkpoints, runtime cases and persistence evidence. Diagnostic Preview is explicitly allowed before repair gates, while post-repair acceptance retains its prerequisites.

An independent reviewer checked the complete new reference and its workflow/verification dependencies, then re-reviewed the final source-grounded-outcome clarification. No actionable instruction contradiction remained in that review. See [engineering review](engineering-review.md) for exact scope, hashes and limitations.

## Offline behavior probes

Two fresh agents independently read immutable old/candidate snapshots and answered the same ten synthetic cases. Each variant processed its ten cases in one context. A separate grader read all twenty responses and judged thirty prewritten decision assertions per variant, with response-specific evidence and SHA-256 binding.

Both variants scored **30/30** on those assertions. This does **not** demonstrate an improvement in measured behavior. The supplied facts expose most root causes; these probes test decisions, not discovery from real tools. The agents did not claim live execution.

The grader also found a material issue outside the scored assertions: the initial candidate's business-conflict response proposed checking that cancellation leaves data unchanged, although the supplied sources did not define that outcome. This was retained as a finding despite the perfect assertion score. The reference was tightened to derive business outcomes from sources/contracts rather than familiar control labels, and to keep proposed semantics separate from acceptance expectations.

A fresh agent then evaluated two targeted cases using the revised snapshot: the original conflict with unspecified cancellation semantics, and a new source-defined cancellation that changes an order from pending to cancelled while preserving list queries and a separate close action. Independent grading passed **3/3** and **4/4**, respectively, and found no new material unsupported assertion. The conflict response derives cancellation from its source instead of assuming unchanged data. The explicit-transition response preserves the required mutation, query context and independent close behavior, and requires actual record-state checks instead of treating a disappearing row as proof. The original additional finding is resolved in these offline responses; this is not live execution acceptance.

The retained case suite now has eleven cases. Only the two affected cases were rerun against the final wording; the original ten-case comparison belongs to the earlier candidate snapshot. No final-version 30/30 result or repeated-run reliability is claimed.

## Validation

- Resource reference validation passed for all 203 resources, including links, anchors, reachability, size safeguards, rule targets and component coverage.
- Final `node scripts/build-plasmic-resources.mjs --output <workspace>/final-build` succeeded. Its full verifier suite ran **527 tests in 68.342 seconds**, all passing.
- Decompressed the final resource bundle and verified its feedback reference exactly equals the final source. The local bundle release ID is recorded in [evidence-index.json](evidence-index.json).
- `git diff --check` passed. No skill/CLI publication, deployment or live prototype mutation was performed.

## Evidence and limits

The [evidence index](evidence-index.json) records the baseline commit, final source hashes, case hashes and all 22 response hashes. Task-local snapshots, source-read logs, individual grading records, build logs and the generated HTML review viewer are retained under the workspace path in that index. The initial grading summary retains the additional cancellation finding; the targeted summary records its repair review. Evaluation outputs are outside the distributed skill resources.

No real image pixels, live project model, mutation trace, Preview action or save/reopen flow was exercised. These checks do not establish actual UI quality, runtime correctness, tool permission enforcement or universal Agent reliability. The fixtures use image descriptions; actual image interpretation remains untested. Per-variant batches are not isolated repeated trials per case, and timing/token metrics were unavailable. No measurements were inferred from output length, and no comparison claims an improvement that the scores did not show.
