# Target render and saved-camera pipeline

Initial saved-view restoration waits for the active target's ViewCtx, resumes
its sync queue even if the frame is initially offscreen, and lets rendering
proceed while the inspector establishes its viewport padding. The saved scale
and scroll are restored after the existing two layout frames, followed by the
existing viewport commit frame. The global loading overlay remains until the
first rendered val tree and its post-evaluation work are ready. Later evaluation
passes retain their existing scheduling. Editing tools still wait for the active
frame's complete sync queue through awaitStudioReady(). Camera restoration does
not wait for those later passes, and no longer uses readiness polling.

Timings separate initial-target-wait (context availability),
initial-viewport-layout, initial-viewport-commit, and
initial-target-render-wait (remaining first-render wait after camera commit).
Initial-viewport includes overlapping route, camera and rendering work; durations
must not be summed. The restored viewport is not reapplied after reveal.

## Real project experiment

Project iqBeCQWLFWvGwftodkcHbN, 海外客群管理平台 P0 原型, revision 16;
custom arena REQ075 · Desktop with four artboards. Ten matched rounds, alternating
before→after and after→before. Each isolated Electron process opens cold and
then reopens the same URL after navigating to blank. Fresh Chromium profiles;
OS/NAS caches are not flushed. Viewport 1512×887 CSS pixels, DPR 2. Timer begins
before Desktop startup after Electron readiness and authentication seeding.
Both use the same saved overview camera and frozen Desktop runtime.

The renderer builds derive from one fixed source snapshot; only the target/
viewport scheduling differs. The prior startup-request parallelization is
present in both. Build identities and Desktop main hashes are in each report.
No local build, test or typecheck ran during the final series. Installed user
app and NAS services were not updated. All 40 opens passed without API errors;
all restored revision 16 and the exact saved camera. Raw reports are included.
Earlier diagnostic iterations are excluded from these final measurements and
remain in the temporary probe directory.

| Median (ms), 10 complete pairs | Before | After | Paired improvements |
| --- | ---: | ---: | ---: |
| Cold: target load start to canvas reveal | 1074.5 | 781.6 | 10/10 |
| Reopen: target load start to canvas reveal | 801.6 | 548.9 | 10/10 |
| Cold: first render to viewport readiness | 278.0 | 2.1 | 10/10 |
| Reopen: first render to viewport readiness | 267.6 | 2.0 | 10/10 |
| Cold: end-to-end visible canvas | 4675 | 4365 | 9/10 |
| Reopen: end-to-end visible canvas | 3466 | 3407.5 | 6/10 |

Target load-to-reveal median improves 27.3% cold and 31.5% reopen, consistently
in all pairs. Camera work overlaps rendering; the ~2 ms is the remaining wait
AFTER first render, not the total cost of restoring a viewport. First evaluation
itself is similar (389.7→369.7 ms cold, 352.1→350.4 ms reopen).

End-to-end cold median improves 6.6%; reopen improves only 1.7%. This demonstrates
stable improvement of the requested target/viewport stage within this sample,
not a guarantee that each complete reopen is faster. Earlier work and network
variance still limit whole-page gains. Do not compare these totals directly to
reports from different source snapshots or different test windows.

## Behavior and verification

Every final after sample asserts viewport readiness is after first target
render, and other frames start initialization after viewport readiness. No
project write requests were attempted; autosaving is disabled only in the
isolated probes and mutations are blocked.

The separate fourth-target run restores q4gaQqly-YIz first, at scale
0.3557330827067669 and scroll (1653,1050). It verifies selection, an AppShell
productName edit, the actual rendered marker, undo removing it, exact full-model
serialization after undo, and camera restoration. The final after-10 run also
verifies editing/undo on the first frame. This tests real editor operations via
the editor tools, not every mouse or keyboard gesture.

12 relevant tests across progressive-canvas, initial-viewport and
view-editor-loading pass. Tests explicitly prove camera restoration can finish
while the first render is pending without revealing blank content, the target
queue is resumed, and editing tools still wait for subsequent sync completion.
ESLint: zero errors, one existing empty-arrow warning. Whole-project typecheck
still reports errors in unchanged self-hosted-entitlements and page-metadata
tests. Fixed-source frontend build and git diff --check pass.
