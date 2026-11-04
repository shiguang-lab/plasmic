# Historical evidence availability

Checked 2026-11-04 against the original paths recorded in this checkout. This is an availability audit, not a rerun of the historical agents or a reversal of their reported outcomes. No missing output was reconstructed.

| Record | Current availability | Consequence |
| --- | --- | --- |
| `results.md` → `/tmp/plasmic-skill-optimization/evaluation` | Workspace absent | Original benchmark, per-run responses/traces and live artifacts at that location cannot be rechecked. |
| `context-results.md` → `/tmp/plasmic-context-regression-20261017` | Workspace absent | Original byte measurements, capture logs and linked review artifacts at that location cannot be rechecked. |
| `codegen-contracts/results.md` → recorded `plasmic-codegen-contracts-vw9mq9kr` temporary workspace | Workspace absent | Original baseline/final output grading cannot be independently repeated from retained outputs. Committed fixtures/rubric still support a new experiment. |
| `codegen-services/results.md` → `/tmp/plasmic-codegen-services-ROIIKD` | Workspace absent | Original responses/recheck cannot be regraded. |
| `feedback-handling/evidence-index.json` | Workspace directories remain; all 22 indexed response files absent | Recorded hashes identify intended evidence but cannot replace the missing files. |
| `rule-delivery/evidence-index.json` | Workspace directories remain; all 5 indexed output files and 3 snapshot manifests absent | Baseline/candidate/final responses, static comparison and benchmark cannot currently be rechecked from these paths. |

The existing dated results remain historical reports. Their scores do not establish results for current references; for example, the current prototype workflow differs from the final source hash in the feedback index. A new run must pin its current inputs and retain its own outputs. Other artifact locations not listed here were not exhaustively checked.

Use the [durable evidence procedure](README.md#durable-evidence) for new runs. Retention and integrity checks are separate from grading business correctness and real runtime acceptance.
