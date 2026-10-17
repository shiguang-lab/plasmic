# REQ075 optimized-version full prototype regression — PASS

Latest [strictness and evidence review](review-results.md): false-acceptance boundaries fixed; stricter checks and unchanged design pass.

The remaining acceptance gaps in the declared [P0 prototype scope](scope.md) are closed. All six automated gates, evidence integrity, 185 public-model behavior cases and the required rendered short-screen overlay cases pass. No gate was removed, waived or changed to not-applicable. Production service integration remains the existing scope boundary in scope.md.

## Static checker corrections

- Navigation retains the independent source-reviewed literal menu inventory. `navigation.roleQuery` declares state/query/default role input. The checker compares the complete recursive role-preserving transform against this inventory without executing JavaScript. Targets, labels, order, hidden descendants, encoding, fallback precedence and recursion remain checked on every page. Unknown programs fail. This proves the supported transformation for its role inputs rather than accepting an arbitrary expression string from the model.
- Native Button props accept flat object literals containing literal values or simple state/query reads. Disabled/loading bindings do not change action visibility. ApplicationModal requires the exact independently reviewed `$state.applicationBusy` disabled binding for both actions. Hidden/style bindings, spreads, computed keys, duplicate keys, side effects and unsupported expressions still fail.
- Negative tests preserve rejection of wrong destinations, role fallback changes, missing recursion, hidden actions and wrong disabled bindings. The checkers never execute model expressions.

The new cases do not alter the saved page design, component props, interactions or visual styling. The earlier preflight/retry fixes remain in revision 164.

## Current verification

| Check | Result | Evidence |
| --- | --- | --- |
| Evidence integrity | PASS | Stable project/session/revision/changeCounter, complete Page models and hashes |
| Structure | PASS | Four routes; full literal hierarchy plus role propagation on every page |
| Forms | PASS | Six native Forms, 20 fields |
| Descriptions | PASS | Independently inventoried information groups and bindings |
| Overlays | PASS | All 8 instances, native ownership, visible actions and required busy bindings |
| Slots | PASS | All four pages and retained semantic intent |
| Shell height | PASS | Fresh targeted layouts for all four pages |
| Public-model behavior | PASS, 185 cases | Role/state/type actions, SQL negatives/lifecycle, protected transitions, filters/date boundaries, retention choices, retry history, busy props |
| Rendered short screens | PASS | [8 Modal/Drawer + 5 confirmation surfaces, 25 reviewed PNGs](short-screen-results.md); actual CSS viewport 1440×720 |
| Full-page Preview | PASS | Four pages at 1440×1024 and 1440×720, main SQL creation/save/launch paths, role restrictions, list pagination/return state, detail/member/record/application behavior in [resumed run](resumed-results.md) plus the short-screen follow-up |
| Save/reopen | PASS | Explicit saved=true, revision 164; new editor session; exact complete model equality; initial overlays closed; fresh layouts; successful post-reopen SQL flow and record Query/Reset |
| Desktop tests | PASS, 220 | completion-desktop.log |
| Studio prototype/batch/canvas/activity tests | PASS, 71 | completion-studio.log |
| Python verification tests | PASS, 109 | Includes malformed/unsupported expressions and all existing gates |
| Resource packaging and component coverage | PASS, 16 | completion-resources.log; built bundle executes all 109 Python tests |
| Diff whitespace | PASS | git diff --check |

Rendered and public-model checks remain distinct. The model suite uses isolated fixtures and is not represented as browser or backend execution. The automated report retains its `notChecked` field for Preview, source interpretation and persistence; the separate reviewed source inventory, actual Preview observations and persistence receipts supply those parts of the final acceptance.

## Runtime and persistence identity

Optimized local Desktop **0.1.14**, renderer `1f76a95ef13dc4358fd19de412b111b44e96fc3e565fdd7b70b7eb4a33db53b8`, build timestamp 2026-10-17T13:05:20.354Z. Project **6M9xV1Vz9kawVFdoXVQdSG**, saved revision **164**. The installed older client was not used for this optimized-build regression.

Final reopen changed session **HxYB8psCs5Hl → y-puD1BlwMnE**. The collector rejected old-session model reuse, collected all four complete models again and found exact equality. After the final post-reopen interactions, a same-session run reused only those complete models, refreshed every layout and reran every gate. Preview interaction state did not change the saved model; changeCounter remained 0. Auto viewport and the saved editor were restored.

Local complete evidence under `desktop/desktop-report/optimized-context-regression/`:

- `completion-reopened/`: new-session capture, complete models/layouts and passing report.
- `completion-final/`: final same-session reuse capture with fresh layouts and all passing gates.
- `completion-final-behavior/report.json`: 185 passing cases from the final hash-verified capture.
- `completion-persistence.json`, `completion-saved.json`: exact model equality, distinct sessions and explicit save receipt.
- `short-overlays/`: live Preview workspace PNGs; [short-screen-evidence.json](short-screen-evidence.json) records identities, concrete observations and SHA256 values.

Test logs are in `/tmp/plasmic-context-regression-20261017/completion-*.log`. Earlier reports retain historical failures and limitations with links to this final result. This acceptance covers the requirement prototype and context optimization; real SQL execution, scheduling, IAM, export storage and audit backend integration were outside the source-reviewed prototype scope throughout. No release, installation replacement or deployment was performed.
