# Client canvas preview probe

This is an isolated browser experiment, not the production Dashboard thumbnail implementation. It does not save projects, upload previews, or start a server-side browser.

The coordinator queues one renderer at a time. Each job loads the existing client runtime into one temporary, same-origin iframe. Model unbundling, component registration, code generation and rendering all run inside that iframe. The coordinator receives only cloned metadata and PNG bytes; it must not retain iframe objects or generated-code caches.

The scope is the first nonempty saved free canvas. Its artboards retain their saved coordinates and dimensions. A project without a free canvas uses each page's widest saved artboard in a two-column overview. Duplicate page/component arenas are not added to a free canvas. The compositor calculates the union of all artboard bounds and fits it inside a 640×360 image with padding. Scrollable page interiors retain their artboard viewport; this does not expand hidden scroll content or reveal closed overlays.

Snapshots clone the rendered DOM, normal and adopted CSS stylesheets, inherited font metrics, SVG, form values and Canvas 2D pixels. Imported font CSS is flattened and used fonts/assets are embedded. The browser rasterizes the snapshot through SVG foreignObject. The final overview is cached as PNG ArrayBuffer data in IndexedDB; cards display Blob URLs without executing project code. Card cleanup revokes URLs, temporary ImageBitmaps are closed, encoding canvases are resized to zero, and the renderer iframe is removed even if generation fails.

The fixture cache key includes project ID, saved revision and renderer format. Revisions and library versions are fixed to these test fixtures. A production implementation must get the current saved revision from project metadata and include the selected canvas scope. Production scheduling should generate visible stale/missing covers first and cancel queued work when it is no longer needed. This probe eagerly queues its requested test cards and has no cache quota policy.

## Running

The experiment imports the same `renderer.ts` used by the production Dashboard. Both paths use `buildPreviewModules`, `waitForLiveHost` and `syncPreview`; the experiment has no separate compiler or module loader. Its iframe also uses the production `canvas-preview.html` Host template, without the standalone Host onboarding UI. Artboards render by UUID, retaining their saved Props, local/global variants, global providers and tokens. Both callers await the new runtime’s React commit and reject render errors before settling assets and capturing pixels. Readiness waits for imported stylesheets (including nested imports) before layout and font completion; failed or stalled stylesheets reject capture.

Use a frozen source checkout with matching Studio and prepared Desktop assets. Build Studio through `scripts/build-studio.mjs`, then run `desktop/scripts/prepare-assets.mjs`.

Place read-only fixtures in `/tmp/plasmic-cover-probe`: project API responses named `6M9xV1Vz9kawVFdoXVQdSG.json` and `145nN6S5QQBwgjtNUwuiQZ.json`, `config.json`, and pinned versioned registrations such as `antd6@1.18.0.js` matching every imported library version in those projects. Missing versions fail; the server never substitutes latest or another version. `/fixture/manifest.json` reads actual project identities and revisions; cache keys include revision and renderer build. These are two projects even when a test mounts 100 cards.

From `platform/wab` run `pnpm test:preview-probe`. The unified runner checks Studio/Desktop build identity, builds both probe entries with the accepted source hash, starts loopback-only servers, runs `benchmark.cjs`, `browsers.cjs`, `canvas-edge.cjs`, `shadow-fidelity.cjs`, `production.cjs`, `production-memory.cjs` and `../published-hydration/regression.cjs`, and records each exit code. It fails if any check fails, runs all seven tools even after an earlier assertion failure and stops its servers in all cases. It does not overwrite production build artifacts. Port 3218 belongs to the Canvas edge server before the production server starts. Outputs remain in `/tmp/plasmic-cover-probe`; `PLASMIC_PROBE_RENDERER` can select an isolated prepared Desktop asset directory.

`pnpm test` discovers the probe engine, server and migration contract tests. They reject stale runtime hashes, incorrect fixture identity, rendering by component instead of artboard identity, swallowed renderer errors, lost capture assets and old module-loader contracts.

The browser benchmark retains the pixel difference threshold (less than 1% of pixels differing by more than 20 per channel), requires no lost assets, tests every artboard's geometry, repeats rendering and verifies 100 cache hits after reload with model requests blocked. Production tools cover visibility scheduling, cache reuse, cancellation, PNG transfer and destroyed iframe/worker ownership in Chromium, Firefox and WebKit. Memory measurements record Chromium JS heap, DOM and process RSS separately; RSS is not asserted to return to baseline.

## Limits

Cross-origin images and fonts must be fetchable with CORS. Tainted Canvas pixels cannot be read. Default WebGL drawing buffers can be cleared before capture; those components need a render-complete export or their own snapshot API. Cross-origin embedded frames, shadow DOM, video and arbitrary animated/data-query components are not covered by these fixtures. The two primary business pages have no backend data queries; the chart/Canvas sample is separate from the saved business projects. This experiment does not claim universal DOM capture fidelity.

The JS heap check verifies collection of renderer/model objects. Browser RSS, decoded images, GPU resources and font caches are separate measurements, and allocator pools need not return to the OS immediately. The renderer runs on the client's main thread; serial scheduling bounds concurrency but does not eliminate long tasks.

## Verification evidence

A tool source or old screenshot is not a passing result. Use `regression.json`, the seven tool logs, per-browser metrics and actual live/static PNG pairs from the current build. Each benchmark capture has a unique sequence number, so repeated renders cannot overwrite a failed live/static/diff pair. Raw metrics are saved before assertions. A browser fidelity failure remains a failure; no threshold is relaxed and no engine is silently skipped.

`shadow-fidelity.cjs` independently compares positive/negative, fractional, inset, multiple and filtered shadows against native browser pixels in all three engines, using the same 1% threshold per 100×100 case. Rasterization detects the actual SVG graphics-context direction and, where needed, paints SVG into a flipped intermediate canvas before restoring orientation from raster pixels; source styles and filter effects remain intact. An inconclusive probe fails.

The three-engine shadow tool also delays an imported stylesheet by 600 ms and independently requires its load event and final font family before readiness completes. This catches fallback-font captures even when the separate pixel cases happen to pass.

The publishing regression also requires the pinned historical hydration input described in `../published-hydration/README.md`. It verifies that the current sibling hydration build, Studio and Desktop contain identical script bytes and no extra hydration versions.
