# Startup critical window verification

Project: `iqBeCQWLFWvGwftodkcHbN`, 海外客群管理平台 P0 原型, revision 16,
custom arena `REQ075 · Desktop` with four frames. Before uses the preceding
compiled target-first renderer; after uses the renderer with the background
initialization barrier and parallel branch/view-preference reads. Both use the
same current Desktop source and the same saved camera. Installed user app and
NAS services were not changed.

## 502 diagnosis

Seoul Caddy reports `dial tcp 100.87.115.78:3600: i/o timeout`, status 502,
duration approximately 3 seconds. The sanitized logs include the failing
`/api/v1/hosts` and `/api/v1/latest-bundle-version` requests from the preceding
acceptance runs. This occurs while establishing a TCP connection to the NAS
access gateway, before requests reach the Studio Nginx/API. The Studio server
has zero restarts and no OOM kill. Do not treat this as model unbundling or
component rendering latency.

Current probes: 24 public bundle-version GETs split between environment proxy
and direct requests all returned 200 (0.40–3.77 seconds). Seoul's Tailscale ping
to NAS subsequently used a direct path in 68 ms. Tailscaled logs show DERP/direct
path changes; these correlate with intermittent reachability but do not prove
the ultimate cause of packet loss. This investigation locates the failing
network hop; it does not claim that the intermittent connectivity is fixed.
Caddy's Studio transport currently disables keepalive, forcing fresh upstream
TCP connections. Evaluate a short keepalive and connection/error counters on
this hop before changing timeouts or adding application retries. A longer dial
timeout alone would hide slow failures rather than remove them.

## Interleaved measurements

Six isolated Electron processes, ordered before1, after1, after2, before2,
before3, after3. Each process opens cold, navigates to blank, then reopens the
same URL. The fresh profile has empty Chromium caches; OS/NAS caches are not
flushed. Timer begins at Desktop startup after Electron readiness, excludes
engine bootstrap and authentication seeding. CSS viewport 1512×887, DPR 2.
No local build/typecheck/test runs occurred during this series.

| Visible rendered canvas | Before (ms) | After (ms) |
| --- | --- | --- |
| Cold samples | 5633, 5717, 6014 | 5920, 5299, 5368 |
| Cold median | 5717 | 5368 |
| Reopen samples | 3726, 4374, 3814 | 4198, 3625, 4136 |
| Reopen median | 3814 | 4136 |

Cold median is 6.1% lower; reopen median is 8.4% higher. This small networked
sample does not establish a consistent end-to-end improvement. Cold project
fetch median changes from 887 to 579 ms; reopen from 716 to 979 ms, so network
variation materially affects the totals. Target-load-start to canvas reveal
median changes from 1146 to 1110 ms cold and 940 to 884 ms reopen.

After medians: pre-Studio startup 2882/1509 ms cold/reopen; project fetch
579/979 ms; initial route 569/500 ms; initial viewport 1690/1451 ms (overlapping
render/route, do not sum). The pre-Studio request chain remains the largest
cold-start stage. This main-branch project does not measure the branch-query
parallelization; the component test verifies it starts before project metadata
resolves.

## Behavioral checks

All 12 series opens restore the same camera, revision 16, with no 502 and no
attempted project writes. All six after opens assert other frame load starts
occur after `initial-viewport` completes. The `background-canvas-wait` phase
records the deferred work; all frame contexts still initialize afterward.

Separate first/fourth-frame acceptance runs verify selection, a registered
AppShell `productName` edit, actual canvas text, undo removing the rendered
marker, exact full serialized model equality after undo, and camera restoration.
Fourth frame `q4gaQqly-YIz` starts before authored frames 1–3; restored scale
0.3557330827067669, scroll (1653, 1050). Autosaving is disabled in the isolated
probe, project mutation HTTP requests are blocked and none were attempted.
This covers the real editor operations via its tools, not every mouse drag or
keyboard gesture.

Frontend build succeeded. Relevant tests: 12 passed across four files, followed
by 8 passing queue/StudioFrame tests after adding the parallel-query assertion.
ESLint: zero errors, one existing empty-arrow warning. Whole-project typecheck
still fails in unchanged self-hosted-entitlements and page-metadata tests.
