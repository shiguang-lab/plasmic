# Optimized-build REQ075 regression — 2026-10-17

Latest result: [completed acceptance — PASS](completion-results.md). This initial report retains its original evidence and failures; the login blocker and acceptance gaps below are resolved in the final report.

Status at the initial run: **incomplete; not accepted**. Expectations are source-reviewed in scope.md. No failing gate has been waived. This is a prototype regression, not production API/IAM certification.

## Environment and evidence

Built the current Studio source successfully with the self-hosted production configuration and prepared Desktop assets. Tested local Desktop 0.1.14, source revision 716f2e5605f5b1234004f92396f9a40730ca0017 (dirty), source hash cb18ad489dbde49bdfa0605bd5c78c4a1fb725891f5a59c1149b987751d0112e, renderer hash 1f76a95ef13dc4358fd19de412b111b44e96fc3e565fdd7b70b7eb4a33db53b8. The installed older Desktop was not used as updated-build evidence. No release was published.

Project 6M9xV1Vz9kawVFdoXVQdSG has four REQ075 pages. Complete public models/layouts and receipts are in desktop/desktop-report/optimized-context-regression (local ignored evidence). Capture-first records revision 161, session mdL_a5H6zxTn, unchanged before/after identity and file hashes. Replay-slot-contract reruns every gate against that capture; it is offline replay, not a new live capture.

## Completed

- Added independent structure, 20-field Form, Descriptions, overlay and Slot inventories. Intent reconciliation retains the pre-generation component inventory and semantic naming map; Retention moved from its obsolete wrapper into native Form.Item. Field and component gates both remain required.
- Live batch changed two nodes: two ordered operation receipts shared one complete model resource. Exact readback and single undo restored the full original models; validation passed and explicit save succeeded.
- Removed both SQL preflight dialogs' sole dismiss-only footer controls; the existing X handler preserves cancellation behavior. Four atomic operations returned two model resources, validation passed, save receipt revision 161. Post-change runtime close/reopen still requires testing.
- First live capture and later replay pass evidence integrity, Forms, Descriptions, all four Slot pages and all four 1024px shell-height checks.
- Corrected the overlay gate's empty code-component Slot interpretation against Studio computeTplComponentArgs: empty RenderExpr means undefined/native default. Explicit null and hideFooter still suppress defaults. Added regression coverage. Code export has separate serialization behavior and is not certified by this prototype gate.

## Observed Preview cases before authentication expired

These are direct UI observations in the updated client, not a complete persisted screenshot suite:

- Read-only role offers row details only; one-time creation disabled; regular SQL inputs and validate/submit/save/launch disabled.
- Operations role restores validation access; cross-page navigation retains Operations role. Initialized row exposes edit/copy/launch/delete; cancelling delete preserves row 1002 and total 50.
- Invalid DELETE SQL against ods_users with wrong App predicate shows read-only SQL, table namespace, required output fields and App-filter errors; submit/save/launch remain disabled.
- 1440×720 list viewport applied and inspected; bottom scrolling and all-page short-height coverage remain unverified.

## Remaining blockers and cases

- Structure gate retains four dynamic-menu diagnostics. Verify both menu entries and destinations across all three roles on all pages; do not reinterpret unsupported static analysis as a pass.
- Overlay gate retains ApplicationModal dynamic native-button-props diagnostic. Exercise default/busy/success/failure and close/cancel behavior with state-specific evidence.
- Complete the scope.md list/filter/pagination/return-state, role/state transition, both SQL success/failure/invalidation, detail tab/record/member/application and all viewport/scroll cases.
- Explicit save and reopen in a new editor session, rerun every gate and required interaction, prove stale-session reuse rejection and fresh-layout reuse on this build.
- Updated test client authentication expired during Preview testing. Browser authorization completed, but the isolated source client remains waiting for its callback. Normal login must finish before continuing live acceptance; no credentials or auth bypass are included in the evidence.

No claim of full end-to-end completion is made.
