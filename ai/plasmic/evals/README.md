# Skill behavior evaluations

The recorded bounded evaluation and live acceptance are in [results](results.md).

`evals.json` covers read-only template interpretation, a focused prototype edit, incremental React coding, an explicit official CLI request, a cross-project read with a saving side effect, and failed validation after a session change. Run each prompt in a fresh agent context with the designated skill and isolated inputs; use the original published skill as the baseline. Repeat the new skill cases to expose inconsistent decisions.

Generate isolated models and public operation schemas from the actual Studio tools:

```sh
node scripts/prepare-plasmic-evals.mjs --output /absolute/evaluation/input-directory
```

This requires the existing `platform/wab` development dependencies. Generated output contains placeholder design fixtures, not production template acceptance data. The catalog is a selection index; agents must notice differences between it and the supplied model.

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
python3 ai/plasmic/evals/grade.py /absolute/evaluation-workspace
```

The verifier runs actual TypeScript and React DOM tests for the Orders fixture, then replays the recorded prototype edits through real Studio tools. Semantic grading additionally requires a `semantic-review.json` per run, containing the current response's SHA-256 and reviewed expectation indices/evidence; missing or stale review remains unproven. This prevents reusing a previous favorable review for changed output.

These helpers record only observed calls/bytes. Timing and model-token metrics must come from the execution provider when available; never substitute output character counts or zero for missing measurements. Grade routing separately from business correctness: the original skill does not have `inspect`, so its route score does not by itself imply an incorrect task result.
