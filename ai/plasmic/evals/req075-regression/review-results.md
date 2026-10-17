# Strictness, evidence and non-regression review — 2026-10-17

The review found reproducible false-acceptance paths in the verifier and closed them. The actual REQ075 models did not use these invalid forms. The corrected verifier still passes the saved design, and no design/runtime code or acceptance inventory was changed by this review.

## Findings and corrections

| Finding | Correction and verification |
| --- | --- |
| Token comparison ignored semantically significant whitespace. `return` followed by a newline, split `=>`, `||` and `?.` all passed. | Operators are compared as complete JavaScript lexemes. Return/arrow line-terminator restrictions remain significant. Invalid whitespace is rejected; harmless formatting still passes. Previously failing negative subcases now pass. |
| Native Button object parsing accepted `__proto__` and treated numeric/string `hidden` as visible. | Prototype keys and unsupported values/reads fail. Hidden must be a literal boolean; conditional hidden/style remain unresolved and fail. Menu object literals reject prototype keys too. Both native action inventories and exact required disabled bindings remain checked. |
| Offline replay could pass without hashes/version/build/session metadata. A hashed Page missing states/props/interactions could be treated as complete. | Replay and reuse share full evidence checks: stable typed identity, Desktop version/build/time, all file hashes and every full Page field. Missing/changed data fails; raw data recollection remains available. Gates still rerun independently. |
| Supplemental behavior input validation used Python assertions and could overwrite a duplicate route while retaining four dictionary keys. | Explicit exceptions remain active under `python -O`. Full evidence is validated before evaluation; duplicate Page paths fail. CLI tests prove failure before producing output for tampered and extra-Page captures. |
| Screenshot hashes were recorded but not automatically checked against the full expected hidden-state coverage. | Added `verify_evidence.py`: checks all 8 Modal/Drawer instances, 5 confirmation surfaces, 25 distinct required-state files, hashes, requirement hash, model equality, build, branch and revision. Missing busy/error states, duplicate files, changed source/model/build and incomplete review results fail. |
| Reports did not identify the exact verifier and expectation sources used. | Static, behavior and visual evidence reports now record checked input hashes. A changed inventory is still rerun and can fail; previous outcome files are never reused as acceptance. |

The screenshot verifier checks historical artifact integrity and applicability. It does **not** simulate a new Preview run or replace current layout/runtime acceptance. The 25 screenshots and their concrete manual observations remain the completed short-screen run, with exact model/source/build linkage.

## Actual rerun results

- Python verifier tests: **113 passed**.
- Evidence/behavior-input tests: **6 passed**, including `python -O`, duplicate Page routes, missing states/screenshots, tampering, changed source/model/build/branch and a failed manual review flag.
- Resource packaging and component coverage: **16 passed**; the packaged bundle also runs the verifier tests.
- Optimized local Desktop **0.1.14**: fresh complete four-Page collection without reuse, then same-session model reuse with **new layouts for every Page**. Evidence integrity and **all six gates pass** on both paths.
- Supplemental requirement behavior: **185 passed** from the final hash-verified capture.
- Visual evidence: **13 surfaces / 25 files pass** integrity/applicability checks.
- Current four complete models are deeply equal to the previous accepted revision **164**, including node identities, props, bindings, styles, states, variants and interactions. Change counter remains **0**. No save/mutation, release or deployment was performed.
- `git diff --check` passes.

Desktop/Studio runtime source did not change in this review. Their previously completed 220/71 tests and full Preview observations remain recorded in [completed requirement regression](completion-results.md); they are not represented as rerun here.

## Reproduce

```sh
python3 -m unittest discover -s ai/plasmic/scripts -p 'test_*.py'
python3 -m unittest discover -s ai/plasmic/evals/req075-regression -p 'test_*.py'
python3 ai/plasmic/evals/req075-regression/run-behavior.py CAPTURE_DIRECTORY NEW_OUTPUT_DIRECTORY
python3 ai/plasmic/evals/req075-regression/verify_evidence.py CAPTURE_DIRECTORY --report NEW_REPORT_JSON
```

Use a complete `verify_all.py` capture. Run every gate again against current expectations; collect fresh layouts for live reuse. After save/reopen, collect fresh models. The separate Preview, image and persistence requirements in scope.md remain unchanged.

Local evidence: `desktop/desktop-report/optimized-context-regression/review-fresh`, `review-final`, `review-behavior-final/report.json`, `review-visual-integrity-final.json`, and `review-model-integrity.json`. Test logs are `/tmp/plasmic-context-regression-20261017/review-*.log`. Before-fix failures are retained in `review-evidence-before.log` and this task's tool trace.
