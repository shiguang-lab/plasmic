# Plasmic skill verification — 2026-10-09

Verification used local skill/CLI/resources **0.0.59** before publication, with the installed bootstrap and public release unchanged during acceptance.

## Behavior evaluation

| Scope | Runs | Passed expectations |
| --- | ---: | ---: |
| Revised skill: template inspection, focused prototype edit, incremental coding, official CLI, cross-project saving side effect | 10 (2 per scenario) | 50/50 |
| Published 0.0.58 baseline: same five scenarios | 5 | 21/25 |
| Supplemental regression: failed validation over successful transport, followed by an unexpected project change | 2 fresh contexts | 10/10 |

Business outputs were correct in both baseline and revised runs. Baseline differences were missing inspect/official routing and one omitted official version check. The supplemental regression confirms that both fresh executors inspected the error body, reread the changed identity and stopped dependent writes. These finite cases support consistency within their scope; they do not establish arbitrary-task reliability.

The original five scenarios used revised resource release `18719e47a7819d06e8d772ff3bcb1c99809a1e0fd765ae6cbead56d389fe410c`. Supplemental and final live acceptance used `ab129b988cffbdf627d60d46640a9c4da76115b2cfa27238003d2d2282e81bad`, which adds the browser-preview save boundary and explicit failure/session recovery checks.

Actual first-run reference reads, including SKILL.md, decreased from 51,130 to 33,884 bytes for template interpretation, 32,631 to 19,868 for a focused prototype edit, 34,433 to 32,864 for coding, and 34,433 to 14,593 for official CLI metadata. These are UTF-8 bytes, not tokens. Timing and model-token measurements were unavailable.

The official CLI executable and design models in these isolated cases were fixtures. Official metadata tests prove command selection/arguments, not production authentication. Initial fixture-envelope and relative TypeScript-shim defects were corrected and excluded from skill failure counts.

## Independent checks

- CLI/Desktop: 24 + 3 Node tests passed.
- Component exporter and public Studio tools: 55 Vitest tests passed.
- Slot/structure verifiers: 57 Python tests passed, including during the final resource build.
- Three generated coding artifacts: 9 real React DOM behavior tests and three actual TypeScript 7 checks passed. Numeric zero, omitted All status, keywords, pagination reset and existing service/route preservation were checked.
- Three edit plans replayed through actual `COPILOT_TOOLS`; all four EditCard padding values were 24px and unaffected node identities/names/styles remained equal.
- New evaluation helpers and resource validator passed ESLint; skill metadata validation and `git diff --check` passed.
- Full repository typecheck still reports seven diagnostics in unchanged files. A clean HEAD baseline with the same generated inputs/dependencies produced the same diagnostics; this is not a full-repository typecheck pass.

Final packed mustRead sizes: inspect 13,286 bytes; prototype 10,961; codegen 24,418. The build checks links, anchors, reachability and file/aggregate reading budgets, including generated SearchForm guidance. Conditional scene reading remains an agent responsibility.

## Real Desktop acceptance

Desktop 0.0.30, revision `60f074ced19e12ec3dbad7b2c48f6637136b2e8f`.

The actual Admin Templates project `145nN6S5QQBwgjtNUwuiQZ` was read without saves, mutations or library changes. Five necessary local compositions and 19 referenced code components were inspected. StandardListPage `cDYZYokFR4sw` is a plain composition with one AppShell and SearchTableSection `ZcMtIZI9J_IS`; its four section Slots match the catalog. The table uses 45 inline sample records. The independent DetailDrawer and the Preview's hidden detail instance are initially closed.

The running Desktop provides Props/Slots/defaults but lacks complete event arguments/ref actions and registered import metadata. Catalog release 0.0.1 could not be independently confirmed from a live version field; prepared directory configuration has `applied=false`, and actual template menus were not checked. Model reads do not prove real APIs, permissions, Preview behavior or wrapper source availability. Updated exporter fields were verified in source tests; this Desktop release is not a deployment of those changes.

An authorized independent [test project](https://studio.plasmic.shiguanglab.com/projects/jV86PBzoWjsfXAYiEpXPto) contains native Page `EeXKsh6BRHFU`, route `/skill-acceptance`. EditCard has four 24px padding values; SummaryCard retains 16px. Public state/interaction bindings open and close a Details region whose initial value is false. Model validation passed and save returned revision 7. Actual in-app Preview at 1512 × 791 showed default hidden → open → closed behavior. The title's inherited spacing was corrected and visually checked. The project was reopened from Desktop's project list; its complete model exactly matched the saved readback. Preview interactions were repeated, and the subsequent complete model remained identical with the initial state false. This checks the native test page, not the full admin Form/Table/overlay suite or production business APIs.

During initial live acceptance, a shared Desktop session changed projects. The executor incorrectly saved the unrelated REQ075 project after a failed validation. It performed no successful node mutation there; the current business page's complete model matched the pre-test readback. The failure was retained, the core contract was strengthened, and the two fresh fault-injection runs above passed. An initial project-list output also contained credential fields; local raw responses were removed and subsequent logging redacted credential keys. These incidents are not counted as successful acceptance.

Review artifacts are retained in `/tmp/plasmic-skill-optimization/evaluation`: `review.html`, `iteration-1/benchmark.json`, per-run traces/grades/outputs, `artifact-verification.json`, `live-template/report.zh.md` and `live-prototype/acceptance-readback.json`. Reproduction instructions and cases are in [README](README.md) and [evals.json](evals.json).
