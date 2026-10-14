# Pre-Studio request parallelization

The bundle-version request starts alongside user, config and workspace/permission
requests. Raw data is fetched before AppCtx exists; configuration is applied and
AppCtx constructed only after the bundle version and data resolve. Initialization
reuses these responses. Bundle failures do not wait for application data; retrying application
initialization consumes fresh data without repeating a successful bundle lookup.
Reload operations fetch fresh data as before.

Desktop startup validates the saved project's access before navigating. It no
longer waits for recent-project list refresh (session check plus project lookups).
That refresh already runs when the File menu opens; opening stale recent items
retains its existing access check. Initial camera restoration and edit scheduling
are unchanged.

## Real project experiment

Project `iqBeCQWLFWvGwftodkcHbN`, 海外客群管理平台 P0 原型, revision 16;
REQ075 · Desktop, four artboards. Ten interleaved matched rounds: odd rounds
serial then parallel, even rounds parallel then serial. Each fresh isolated
Electron profile opens cold and then navigates to blank before reopening the
same saved project URL. CSS viewport 1512×887, DPR 2. OS and NAS caches were not
flushed. Timer starts after Electron readiness and cookie seeding, immediately
before Desktop startup; it excludes initial engine bootstrap.

Both renderer builds use a frozen copy of the same source tree, differing in
app-ctx.ts and root-view.tsx. Both Desktop runtime copies are frozen and differ
only in the startup recent-list wait. Renderer source hashes/build identities
and Desktop main-file hashes are recorded in every report. The original shared
workspace could not complete provenance verification while other source files
were changing; both fixed-source builds passed that verification. The fixed
snapshot initially omitted the ignored sub host runtime, producing host-loading
failures; it was completed and rebuilt before the valid series. Those diagnostic
runs are excluded and preserved in the temporary probe logs.

No local builds, typechecks or tests ran during the valid timing series. Project
writes were blocked in the isolated probe; none were attempted. Neither the
installed user app nor NAS services were updated.

## Measurements

Rounds 1 and 4 have API failures in the parallel variant, so matched timing
summaries use complete rounds 2, 3, 5, 6, 7, 8, 9, 10 for both variants. All raw
reports, including failures, remain included. There were 37 successful opens
and two failed opens; one additional planned reopen was skipped after cold
startup failed.

| Median, eight complete paired rounds | Serial (ms) | Parallel (ms) | Reduction |
| --- | ---: | ---: | ---: |
| Cold visible rendered canvas | 6661 | 5982 | 10.2% |
| Reopen visible rendered canvas | 4673 | 4286 | 8.3% |
| Cold before Studio module import | 3447 | 2738 | 20.6% |
| Reopen before Studio module import | 1820 | 1618 | 11.1% |

Cold visible canvas improves in all eight complete pairs. Reopen improves in
four pairs and regresses in four: median improvement does not establish stable
end-to-end reopen latency. Pre-Studio duration improves in seven of eight pairs
for each mode. Request timestamps verify config/user/workspace calls begin
within 3 ms of bundle-version lookup in every successful parallel open, rather
than waiting for its response. The removed desktop recent-list wave is absent
on successful cold opens.

After medians: project fetch 422/549 ms cold/reopen, model unbundle 121/113 ms,
initial route 841/696 ms, initial viewport 2386/2009 ms, component sync 45/59 ms.
Initial viewport overlaps route and target render; do not sum these durations.
Pre-Studio work and the viewport/render window remain material bottlenecks.

Round 1 reopen: `/api/v1/latest-bundle-version` returns 503 in 213 ms. Round 4
cold: `/api/v1/app-ctx` returns 503 in 218 ms. The error UI appears; these are
not successful delayed paints. Caddy error logs did not contain corresponding
errors and services remained healthy; the source of these 503s is unresolved.
Do not attribute them to the previously diagnosed 3-second NAS TCP dial timeout
or claim parallelism caused or fixed them. A subsequent alternating API-only
probe made five parallel waves and five serial waves (40 GETs), all status 200;
see api-wave.json. This does not rule out intermittent failures.

## Behavior and checks

Every successful series open restored the saved camera and revision 16. Every
parallel open also asserts other frame initialization starts after initial
viewport restoration. First/fourth-frame edit acceptance checks cover selection,
a registered AppShell productName change, actual rendered marker, undo removing
the marker, exact serialized model equality after undo, and restored camera.
The fourth frame q4gaQqly-YIz loads first with scale 0.3557330827067669 and
scroll (1653, 1050). No project save was attempted. This verifies tool-based
editing in the real editor, not every mouse/keyboard gesture.

15 relevant Vitest tests pass, including parallel start, response reuse,
bundle/application-data retry, viewport and progressive queue behavior. 33
Desktop workspace/session-recovery/forwarding tests pass. ESLint has no errors
(two existing empty-arrow warnings). Full TypeScript checking still fails only
in existing self-hosted-entitlements and page-metadata tests. git diff --check
passes.
