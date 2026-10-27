# Codegen contract probe results

Date: 2026-10-27. Inputs and grading criteria: the first three cases in the [probe suite](README.md). This run covers the contract-rule revision before the post-implementation review extension; the pinned hashes below identify the tested references.

The baseline and final candidate each ran all three cases in a fresh agent context with the same raw fixtures and five pinned references. Executors did not receive the rubric or previous conclusions. The parent reviewed the actual JSX and reports against each criterion; these are bounded offline probes, not application tests. An intermediate candidate was also probed, then shortened to meet the existing reading budget; the final wording was tested in a new context.

| Case | Baseline | Final candidate | Observed evidence |
| --- | --- | --- | --- |
| source-capabilities | Pass | Pass | Both put Panel inside OrdersPanel, map heading/actions/children/contentStyle, restore Stack column/16, preserve createOrder, native ticket content and the unrelated help Panel. Both restrict style cleanup to verified unused consumers and leave runtime/visual checks unverified. |
| verified-adaptation | Pass | Pass | Both retain the current implementation, follow AccountTabs into TabSet, accept host ownership and the adjacent Action/Dialog conversion, and check controlled selection/close bindings. Neither adds a library or a second shell. |
| unknown-target-contract | Pass | Pass | Both retain native content, leave the member picker incomplete, identify unknown exports/props/events, and refuse invented APIs or an unsupported custom fallback. Both also identify that the service signature alone does not establish team scope. |

The final candidate explicitly distinguishes actual-region reuse from unrelated imports and reports structure, build, runtime and visual evidence separately. Both versions passed all three cases, so this run does **not** establish a success-rate improvement. It checks that the revised instructions handle the reproduced failure shape without rejecting legitimate transformations. No live MCP acquisition, generated application build, interaction or visual acceptance was exercised.

Pinned-reference SHA-256, computed in order over each relative path, NUL, file bytes, NUL (`model-reading.md`, `workflows/codegen.md`, `codegen/project-code.md`, `codegen/interactions.md`, `codegen/acceptance.md`):

- Baseline: `dd777b6519993855adaa2662e148ff0e63dc4ce5358f744559588d5508a50b3b`.
- Final candidate: `c73a5ddb983685325ac61609492b2bb8241ddc2639f2ed5a7003f0fd11eb9cc9`.
- Local run artifacts: `/var/folders/by/mz1s49k13p3d7xvfr357w1kw0000gn/T/plasmic-codegen-contracts-vw9mq9kr/`, in `old_skill/outputs` and `final_skill/outputs`. Temporary artifacts are not distributed resources; the committed fixtures and rubric support reruns.

Repository validation:

- Resource reference/link/anchor/reachability and component-reference validators passed for 196 resources. Codegen mustRead is 24,482 bytes, below the unchanged 24,576-byte limit.
- `node --test --test-name-pattern='built NAS artifacts install a working CLI binary and only the thin skill' packages/plasmic-cli/tests/resources.test.mjs`: passed. The test built two temporary resource bundles; each build ran 515 Python checks successfully, then checked reproducibility, installation, references and reading budgets. No publication occurred.
- `node --test packages/plasmic-cli/tests/skill.test.mjs`: 14 passed.
- Probe JSON and local documentation links validated; `git diff --check` passed.
- The generic system skill-creator `quick_validate.py` rejected the existing `compatibility` frontmatter key. The skill entrypoint is unchanged; this generic-validator incompatibility remains, and is not reported as a pass.

Only repository source references and evaluation material changed. Installed skill configuration and published resources were not changed.
