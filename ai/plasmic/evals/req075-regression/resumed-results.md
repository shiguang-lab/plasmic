# Resumed optimized-build regression — 2026-10-17

Final follow-up: [completed acceptance](completion-results.md). The diagnostics and short-screen gaps recorded in this intermediate run are resolved there.

The isolated optimized Desktop login was restored through its normal application callback. Testing used local Desktop 0.1.14 / renderer 1f76a95ef13dc4358fd19de412b111b44e96fc3e565fdd7b70b7eb4a33db53b8, not the installed 0.1.13 client. **The automated suite is still not all green:** four dynamic-menu diagnostics and one dynamic native-button-props diagnostic remain. They were not waived, suppressed or rewritten as static passes.

## Fixes found by requirement regression

- Both preflight dialogs retain usable native X dismissal and no sole dismiss-only footer.
- Detail selection records now offer retry for regular groups in both selection-failed and reenable-selection-failed states, for administrator/operations only. Read-only and one-time restrictions remain.
- Reenable retry adds an in-progress attempt, retains success/failure history and shows reenable-selecting consistently in the header and overview. SQL remains frozen for previously enabled groups.
- Before the retry fix, independent model checks failed for administrator and operations reenable-failed cases. These pass after the fix. Live Preview confirmed the new retry confirmation, reenable-selecting header and all three historical/current record states.

Final explicit save receipt: revision **164**. New editor session changed from Ne1qPgrR5Xpo to HxYB8psCs5Hl. Full four-page readbacks before/after reopen are deeply equal. Old-session evidence was not reused. Every gate was rerun against freshly collected layouts. Earlier same-session reuse also refreshed all four layouts while reusing complete models.

## Evidence layers

| Layer | Result | Actual coverage |
| --- | --- | --- |
| Saved model integrity | Pass | New session, revision 164, exact complete models, capture hashes |
| Automated structural gates | Partial | Forms (20 fields), Descriptions, four Slot inventories and four shell heights pass; dynamic structure/overlay diagnostics retained |
| Public-model behavior evaluation | 182 pass | 12 page/role menus; role × seven statuses × two types; confirmation inventories; protected transitions; market/applied filters; SQL negatives; preflight running/success/failure; native busy props; reenable retry history/status |
| Native Preview | Observed cases below | Actual optimized client interactions and screenshots in this task's tool trace; not a browser automation fixture |
| Production services | Outside prototype scope | No claim of actual SQL execution, scheduler, IAM, export file storage or audit backend integration |

Native Preview observations after login:

- Regular: valid SQL → preflight success; total 12,340 and masked full five-field Top100; page 5 ends at sample 1099 and disables next. X closes; save reports initialized. Editing SQL resets validate/preflight/save and disables submit/save/launch. missing_partition produces recoverable failure; corrected SQL succeeds. Launch returns to list with selecting row. Submitting and immediately pressing Escape dismisses preflight; after the old timer has elapsed the modal remains closed and Save remains disabled. Resubmitting then completes successfully and enables Save.
- One-time: required empty name and non-Chinese name rejected; Chinese name passes and carries through to the summary. Type locked, entrance App TACO, no duplicated name input, default expiry 14 and input 366 clamps to 365. SQL variables rejected. Valid preflight, X, save and launch work; new detail has five tabs, no Refresh, zero members/no snapshot while first selecting, and disabled application action.
- Application: required target validation; busy target/OK/Cancel and new-application controls disabled; successful submission adds RegressionCampaign record. Existing failed notification record opens drawer with parameters, response and failure reason. Read-only ACTIVE group cannot apply; non-ACTIVE cannot apply. Creating a failed application request against a real service was not tested.
- Details: default Overview; regular six tabs; two-column basic information and storage fields; read-only SQL opens, closes and reopens. Members reach page 617 and final member 13339 (12,340 members), distinct from Top100.
- List: draft keyword leaves 50 results; query gives empty state; reset restores 50. 20/50/100 page sizes exercised. A bottom-row detail return retains pageSize=100 and scrollTop=2639; screenshots confirm return to bottom. Read-only row actions are details-only, and role persists through detail and SQL navigation. Operations navigation was verified before login expiry on the same optimized build.
- Management/export: enabled-group management edit accepts deadline 19:15:30, and detail immediately shows the new value. Administrator overflow exposes copy/disable/export. Export modal displays GROUP/CSV and mandatory masking/audit notice; submission closes it. No real downloadable file or backend audit was certified.
- Viewports: all four pages inspected at actual 1440×1024 and 1440×720. SQL page bottom actions and long-table bottom pagination are reachable; header/sidebar remain stationary. Detail members, initial creation modal and preflight dialogs were exercised at short height. This does not claim every hidden overlay/state combination was visually inspected at both sizes.

## Remaining acceptance limits

- The static suite still exits nonzero for dynamic navigation and ApplicationModal button props. Public model evaluation verifies the exact role-specific destinations and busy props; Preview verifies representative role navigation and application busy behavior. The static report is unchanged by this supplemental evidence.
- No exhaustive rendered permutation of every role × state × page × viewport was performed. The complete role/state matrix is a model-expression check, supplemented by the listed Preview cases. Short-height coverage of every hidden overlay permutation still lacks direct visual evidence; regular preflight immediate dismissal and subsequent rerun were directly exercised.
- Production-backed application failure, export artifact and audit persistence remain unverified and outside this simulated prototype's service integration scope.

Consequently this report does **not** claim unconditional full end-to-end acceptance or a fully green automated run. It records completed regression, fixed defects and exact remaining evidence limits without lowering requirements.

## Reproduce supplemental behavior checks

From the repository root, use a fresh complete verify_all capture:

```sh
python3 ai/plasmic/evals/req075-regression/run-behavior.py CAPTURE_DIRECTORY NEW_OUTPUT_DIRECTORY
```

The runner checks the capture's Page-model hash, requires four complete pages, rejects duplicate node names and evaluates the public expressions with isolated role/state/form fixtures. It does not invoke private editor APIs or substitute these fixtures for browser/service testing.

Local evidence: desktop/desktop-report/optimized-context-regression/revision164-reopened, behavior-final/report.json, persistence-final.json, retry-text-saved.json and preceding mutation/read/validation receipts. Unit/build results remain recorded in ../context-results.md; they are not represented as rerun by this interaction-only follow-up.
