# Skill behavior evaluations

Fresh prototype regressions must first pass the resource's `verify_mcp_contract.py` against the actual running Desktop. Select optional `--require-capability` values from the actual reference task as described in [desktop-transports](../references/desktop-transports.md); Preview-only work must not require unrelated reference-browser/import tools. Pin resource release, buildId and editor session; use the same source checkout for the candidate build and resource bundle. This capability check catches stale candidates advertising tree/contract/context/full while resources require properties/propNames. Existing native unit passes do not establish that the tested candidate contains those sources.

Fresh full-project regressions use independently reviewed source/suite/reference inputs and locally retained tool/evidence records. The agent owns generation order and pending cases; MCP checks each operation's target, permissions and context. Actual native Preview click/fill/scroll/assert operations must satisfy the pinned cases. Source-derived forms/groups/overlays remain mandatory inventories; missing components do not justify exemptions. Pen coverage includes every required Page/state with a semantic native-component mapping and layout read plus source image. Recorded visual observations remain independently reviewed. REQ075 §6.8 does not prescribe a named application Form or fixed input schema; fixture names are reviewed design choices, not universal requirements.

Record both RPC and actual MCP transport sizes, provider input/output/cache usage and client compaction events. The MCP result cap does not bound cumulative history. Never load raw reasoning into a user-facing report; use public tool/evidence metadata.

For DeepSeek Harness 0.2.1-rc.2, add `--patch /absolute/ai/plasmic/evals/deepseek-flash-budget.patch.yml` after the task/provider patch. This changes client configuration, not the five-line user prompt. The installed DeepSeek adapter declares a 1,000,000-token window for deepseek-flash; its default 0.8 pressure ratio waits until roughly 800,000 input tokens. This evaluation policy uses the native compaction backend at 0.16 (roughly 160,000 with that catalog), retains 32,768 recent tokens and caps summary output at 16,384. It targets only the exact deepseek-official/deepseek-flash route; verify the live catalog before reusing it with another model/version. Automatic compaction happens between steps; `/compact` requires an idle command-capable client and cannot be assumed available inside an active headless turn. Confirm actual `compaction/*` session events and provider usage; a composed configuration is not evidence that a model run compacted successfully. After compaction resume from the local plan, progress and retained evidence, without rereading every Page or relaxing checks.

The [repair candidate report](gemini-flash-repair-results.md) records synchronized MCP/reference/verifier changes and native checks. Login is restored; real REQ075 Flash regression and independent acceptance are recorded separately from native test passes.

The template-driven Gemini 3.8 Flash run and independent runtime/persistence review are in [Flash chain results](gemini-flash-chain-results.md). MCP payload bounds hold in the captured calls; P0 business acceptance fails despite the model's success claim.

The recorded bounded evaluation and live acceptance are in [results](results.md).
The batch/reading/evidence optimization and its four-page regression limits are in [context results](context-results.md).
The latest dynamic-check, evidence-reuse and counterexample audit is in [REQ075 review](req075-regression/review5-results.md).

[Page-type regressions](page-types/README.md) give one neutral requirement per page type and grade the design-time decisions of the resulting plan, so specification changes are not tuned to a single real requirement.

[Codegen contract probes](codegen-contracts/README.md) check preservation of source component responsibilities, valid cross-library/host adaptations, and unknown target APIs. They use synthetic offline contracts and grade actual proposed code separately from unavailable runtime and visual evidence.

[Service and simulation probes](codegen-services/README.md) cover distributed/missing API sources, network mock reuse, local data fallback, stateful workflows and evidence-aware review.

[Feedback handling probes](feedback-handling/README.md) cover text-only and image-assisted feedback, narrow edits versus module optimization, read-only authority, source conflicts, shared consumers and stale repair evidence. They compare offline decisions against pinned inputs; they do not establish live visual or runtime acceptance.

[Rule delivery probes](rule-delivery/README.md) cover preparation before writes, scoped repairs, native heading ownership, shared plan/model errors and static-check coverage. Results distinguish paired offline Agent decisions from deterministic verifier counterexamples.

`evals.json` covers read-only template interpretation, a focused prototype edit, incremental React coding, an explicit official CLI request, a cross-project read with a saving side effect, and failed validation after a session change. Run each prompt in a fresh agent context with the designated skill and isolated inputs; use the original published skill as the baseline. Repeat the new skill cases to expose inconsistent decisions.

The official CLI case resolves `codegen` resources but reads only the resolved `references/guide.md` and `references/official-cli.md`; it does not read native codegen's `mustRead`. Grade historical snapshots against their own pinned rubric, not a rewritten current score. Current scores must follow the current branch contract.

Generate isolated models and public operation schemas from the actual Studio tools:

```sh
node scripts/prepare-plasmic-evals.mjs --output /absolute/evaluation/input-directory
```

This requires the existing `platform/wab` development dependencies. Generated output contains placeholder design fixtures, not production template acceptance data. The catalog is a selection index; agents must notice differences between it and the supplied model.

For the React coding case, freeze the designated **original, unmodified** Orders application before creating any `iteration-*` directory or launching an executor. The source must be a separate input tree, never another run's output. Both baseline and candidate start from this one snapshot:

```sh
python3 ai/plasmic/evals/eval_evidence.py freeze-codegen /absolute/original-orders-app /absolute/evaluation-workspace
python3 ai/plasmic/evals/eval_evidence.py init-codegen-run /absolute/evaluation-workspace iteration-1/eval-3-incremental-coding/old_skill/run-1
python3 ai/plasmic/evals/eval_evidence.py init-codegen-run /absolute/evaluation-workspace iteration-1/eval-3-incremental-coding/with_skill/run-1
```

The initializer copies source files while excluding dependency/VCS/cache directories, records their hashes in `inputs/codegen-manifest.json`, checks copy stability and creates a `codegen-input.json` receipt per run. Missing/changed originals or receipts fail verification. It refuses freezing after an iteration exists and refuses reinitializing an executed run. Create each executor's `environment.json` and instrumented logs in the initialized run. Preserve the service, App, package.json and tsconfig.json against the frozen original, including when grading `old_skill`; no executor output is a control input.

Record actual CLI resolution, reference reads and public tool calls. Grade `expectations` using those traces and real artifacts, rather than executor self-assessments. Replay proposed edits through `COPILOT_TOOLS`, compare unaffected nodes, and exercise generated React controls with the actual target service contract. Do not score a plan or a successful fixture response as real Preview or persistence acceptance.

Fixture evaluations establish bounded instruction-following evidence. Real Desktop acceptance additionally needs a signed-in accessible project, the exact live schemas, and actual Preview/save/reopen checks. Record source/resource identities, artifacts, checks and missing evidence. A login failure is a blocker for that stage; do not infer that the skill or runtime passed.

Use the `skill-creator` benchmark/review format for results. Keep run outputs and generated model files in the evaluation workspace, outside the distributed reference bundle.

Run directories contain an `environment.json` with `skillPath`, `cliPath`, isolated `feed`/`cache`, `modelFixture` (the generated file), `projectId`/`projectName`/`canEdit`, and the target/output paths. Public fixture calls use the real Desktop envelope:

```sh
node ai/plasmic/evals/mcp-fixture.cjs /absolute/run-directory get_app_state '{}'
node ai/plasmic/evals/mcp-fixture.cjs /absolute/run-directory execute '{"name":"read","input":{}}'
node ai/plasmic/evals/context-cli.cjs /absolute/run-directory context resolve --mode inspect
node ai/plasmic/evals/read-reference.cjs /absolute/run-directory /absolute/reference.md
```

For the official-CLI case, `official-fixture.cjs` replaces only the official executable; it records help/version/info calls without sending production requests. Its metadata response is synthetic and cannot prove real authentication.

The failed-validation case sets `validationProjectSwitch` in its environment. Validation returns an error body over a successful process exit and changes the active project. Grade subsequent writes and identity reads explicitly; a zero exit code cannot establish operation success.

After the agents finish, independently exercise their artifacts:

```sh
node ai/plasmic/evals/verify-artifacts.mjs /absolute/evaluation-workspace
```

The verifier runs actual TypeScript and React DOM tests for the Orders fixture, then replays recorded prototype edits through real Studio tools. Each codegen record binds the original snapshot/receipt, current target tree, model/call inputs, checker sources and output files before/after execution. Grading requires two distinct successful commands (`behavior`, `typecheck`) and a structured Vitest result with all three expected tests executed and passed. Empty check arrays, copied log strings and stale target/checker hashes do not establish a pass.

After verification, generate a pending semantic-review template for the case and independently review the pinned response, sources and relevant evidence:

```sh
python3 ai/plasmic/evals/eval_evidence.py review-template /absolute/evaluation-workspace iteration-1/eval-3-incremental-coding/with_skill/run-1 3 > /absolute/evaluation-workspace/iteration-1/eval-3-incremental-coding/with_skill/run-1/semantic-review.json
```

`semantic-review.json` has exactly `schemaVersion: 1`, `binding` and `expectations`. The generated binding contains `caseSha256` (the entire current prompt/rubric case), `outputSha256`, run/model/target/verification input hashes and hashes of the actually read reference/skill sources. Keep those source snapshots available at their recorded paths. The reviewer fills each required unique integer `index`, a JSON boolean `passed`, and nonempty `evidence`. Templates use `passed: null`, so generation alone never approves a response. Strings such as `"false"`, duplicate/missing indices, changed criteria, changed source/trace/code/output or missing sources invalidate the review. Do not refresh the binding to recycle old verdicts; re-review changed inputs. Old text-only review records are unproven under this contract.

Once all required reviews are complete, grade the runs, generate the benchmark/viewer, and seal the finished workspace using the retention procedure below:

```sh
python3 ai/plasmic/evals/grade.py /absolute/evaluation-workspace
```

Each edit run now has its own replay command/result. `artifact-verification.json` binds its run ID to the exact call trace, fixture, checker sources, replay input and log hashes; changed or missing evidence requires a new verifier run. A failing run does not give passing runs a failed replay grade, and a previous aggregate pass cannot validate a new run. Re-execution replaces that run's generated verification files; finish verification and grading before sealing an immutable run directory.

These helpers record only observed calls/bytes. Timing and model-token metrics must come from the execution provider when available; never substitute output character counts or zero for missing measurements. Grade routing separately from business correctness: the original skill does not have `inspect`, so its route score does not by itself imply an incorrect task result.

## Natural triggering and held-out behavior

[`trigger-evals.json`](trigger-evals.json) contains 10 positive and 10 near-miss negative queries. It is an **unexecuted evaluation set**, not a measured trigger score. Review the intended labels before use. Feed each query to a fresh context that has the normal installed-skill catalog, without explicitly telling it to use Plasmic. Record whether it actually reads the Plasmic skill, the client/model/version, the exact description and catalog snapshot, and provider metrics when available. A routing answer written after receiving the skill is not a trigger observation. Embedded prior-context queries must be supplied with the stated prior context when constructing a multi-turn trial.

Run positive and negative cases separately from the six workflow cases, repeat isolated trials, and report false positives/negatives plus precision/recall. When tuning the description, partition by scenario family into training and untouched held-out cases before optimization; do not tune on the held-out outcomes. For business behavior, pair the same raw inputs against immutable current/baseline snapshots and include natural requests that omit root-cause hints. Keep offline decisions, actual discovery/execution, visual quality, runtime correctness and cost separate. No improvement or reliability claim follows from an all-pass paired batch alone.

## Durable evidence

Run new evaluations directly in a chosen persistent absolute directory, for example `<artifact-root>/plasmic/<run-id>/`, outside the distributed resource bundle. Do not use `/tmp` or OS temporary folders as the only retained copy. Keep immutable skill/resource/rubric snapshots, original inputs, per-run responses/tool traces, semantic reviews, test logs, grades, benchmark/viewer and provider metrics there. Record the exact model/client/build/release identities and missing metrics in `run-metadata.json`; secrets must be redacted before archiving. Separate iterations instead of rewriting prior evidence.

After the review and final grading, seal the directory, then verify it before reporting or re-grading archived results:

```sh
python3 ai/plasmic/evals/artifact_manifest.py seal /absolute/artifact-root/plasmic/run-id
python3 ai/plasmic/evals/artifact_manifest.py check /absolute/artifact-root/plasmic/run-id
```

The manifest hashes every retained file except dependency/VCS/cache directories and itself. Evidence symlinks are rejected; dependency symlinks are excluded. Sealing an existing manifest fails rather than replacing the original inventory. Missing, changed or added files make checking fail. This detects artifact loss/drift; it does not establish that a response or acceptance claim was correct. Regrading an archive uses a new output workspace and retains its original manifest.

The [historical evidence status](historical-evidence-status.md) records known unavailable originals. Keep historical reports as dated records; missing originals mean their output grades cannot currently be independently rechecked, not that the original experiment failed or that evidence has been recovered.

Evaluation-helper regressions (no model/API or live design calls):

```sh
python3 -B -m unittest discover -s ai/plasmic/evals -p 'test_*.py'
```
