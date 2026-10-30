# Plasmic feedback workflow engineering review

Result: **No actionable findings** in the reviewed changes.

This is an independent, offline review of instruction behavior. It does not certify live agent behavior, Desktop integration, prototype rendering, business behavior, persistence, or acceptance execution.

## Scope

Reviewed the working-tree diff for:

- `ai/plasmic/references/workflows/inspect.md`
- `ai/plasmic/references/workflows/prototype.md`
- `ai/plasmic/references/desktop-inspection.md`

Read the complete new `ai/plasmic/references/feedback-handling.md`, root `CLAUDE.md`, the complete relevant workflow, review-mode, requirement-alignment, verification, desktop-inspection, context-reading and guide documents, and `packages/plasmic-cli/skill/plasmic/SKILL.md`. Assessed authority/scope separation, diagnostic versus acceptance ordering, scoped regression, implementation boundaries, missing inputs, and unnecessary workflow overhead against the supplied user requirements.

## Evidence for the assessment

- Text-only reports and images are both supported, including historical/reference/annotation images, unavailable pixels and hidden content (`feedback-handling.md:3`, `:31-43`). Images do not independently authorize a redesign (`:12`, `:21`).
- Authority, scope and expectations are independent; narrow edits and whole-module optimization follow intent rather than image size or vague wording (`feedback-handling.md:9-25`). Optimization authorizes in-scope reasoned improvements without routine approval, while new business semantics and scope-expanding shared changes remain bounded (`:25`, `:64-66`).
- Requirements, layout, native component contracts, visual/accessibility concerns, business behavior and persistence are explicitly considered with scope-dependent depth (`feedback-handling.md:47-60`). Unknown platform contracts preserve evidence and remain subject to the thin skill's client implementation boundary (`:58`; `SKILL.md:57-61`).
- Diagnostic Preview can precede repair/generation gates, and cannot serve as post-repair acceptance (`feedback-handling.md:43`; `desktop-inspection.md:15`; `workflows/inspect.md:5`; `workflows/prototype.md:11`). This avoids requiring a broken artifact to pass acceptance before diagnosing it. External/irreversible effects remain bounded by authorization/test context (`feedback-handling.md:43`).
- Local corrections reuse existing stages and evidence rather than restarting full-Page planning or unrelated business tests (`feedback-handling.md:66-76`; `workflows/prototype.md:11`). The scoped regression table includes shared consumers and distinct behavior, rather than assuming one instance proves all consumers (`feedback-handling.md:68-74`).
- Static review precedes acceptance Preview, while final runtime/persistence verdicts remain pending until executed (`feedback-handling.md:76`; `review-mode.md`, Rule review; `verification.md`, Collect and verify). This does not introduce a final-verdict prerequisite cycle.
- Existing repair-round limits and checkpoint/fallback policy are reused; lack of progress requires obtaining evidence rather than speculative repeated changes (`feedback-handling.md:78`). Completion distinguishes unverified, unreproduced, out-of-scope and repaired issues (`:82-84`).
- Both existing modes link to the new scenario; the thin entry already routes by artifact/intent and requires conditional references, so an additional mode or duplicate thin-entry procedure is unnecessary (`workflows/inspect.md:5`; `workflows/prototype.md:11`; `SKILL.md:13-19`, `:33`).

## Checks and limits

- `git diff --check` ran successfully with no diagnostics.
- No repository file was modified by this review. Only this report was written under `/tmp`.
- No Desktop/MCP, browser, external service, resolver, build, test suite, resource validator, or behavioral evaluation was run. No live tool contracts, generated artifacts, runtime traces or saved/reopened models were inspected.
- No delegated review was used. Conclusions apply to the instruction text below, not later edits or unpublished/installed resource versions.

## Reviewed SHA-256 identities

| File | SHA-256 |
| --- | --- |
| feedback-handling.md | `1b1161a019e2ee2a4caf412c8534d8393d54329df7dbeda25a1dc674bc5fbd9b` |
| workflows/inspect.md | `780d20a10b69d376fed976d56b21513010092ce54b7f69572e1def47b894cde4` |
| workflows/prototype.md | `db8b630a3c9b2a4624c7951880571b7d2664deebcb4b637a321ae42573050090` |
| desktop-inspection.md | `d645641e480aa647d99a0f9b42bf3a9bf988d6d7ab409186a2e3d349c68fcb29` |
| packages/plasmic-cli/skill/plasmic/SKILL.md | `b05f7dd9454ee4a3a79fe71633135cad90cd2e333a5a826898d4210fb6cbab3d` |

## Final paragraph re-review

Result: **No new actionable findings.**

Reread the final complete `feedback-handling.md`, the current workflow/desktop-inspection routing diff, and verified routing/thin-entry hashes remain identical to the first review. The added rule at `feedback-handling.md:66` correctly requires source/contract evidence for business outcomes, explicitly rejects inferring effects from familiar control names, and separates proposed semantics from acceptance expectations. In particular, a control labelled cancel no longer supports asserting that data remains unchanged without evidence; cancellation can represent a record transition.

The change does not impose routine approval. `feedback-handling.md:64` still directs authorized work to proceed without routine approval; `:23` requires reading available evidence before asking and limits questions to material target/authority/business ambiguity; `:66` blocks only the unresolved material outcome while independent checks continue. Preserving verified existing behavior does not authorize retaining a confirmed defect: source precedence and explicit authorized changes remain controlling (`:29`, `:58`, `:66`). No new diagnostic/acceptance cycle or implementation-boundary expansion was found.

`git diff --check` was rerun successfully without diagnostics. This re-review remains offline instruction analysis, with no Desktop/MCP calls, repository modifications, behavioral evaluation rerun, or certification of live behavior. The evaluator's execution and claims were not independently inspected during this re-review.

Final `ai/plasmic/references/feedback-handling.md` SHA-256: `c04b4fad6002b06ce568c79a08f5227bdc1a72412452a02ac1465b58ab13d338`.
