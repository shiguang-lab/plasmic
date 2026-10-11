# Client canvas preview probe

This is an isolated browser experiment, not the production Dashboard thumbnail implementation. It does not save projects, upload previews, or start a server-side browser.

The coordinator queues one renderer at a time. Each job loads the existing client runtime into one temporary, same-origin iframe. Model unbundling, component registration, code generation and rendering all run inside that iframe. The coordinator receives only cloned metadata and PNG bytes; it must not retain iframe objects or generated-code caches.

The scope is the first nonempty saved free canvas. Its artboards retain their saved coordinates and dimensions. A project without a free canvas uses each page's widest saved artboard in a two-column overview. Duplicate page/component arenas are not added to a free canvas. The compositor calculates the union of all artboard bounds and fits it inside a 640×360 image with padding. Scrollable page interiors retain their artboard viewport; this does not expand hidden scroll content or reveal closed overlays.

Snapshots clone the rendered DOM, normal and adopted CSS stylesheets, inherited font metrics, SVG, form values and Canvas 2D pixels. Imported font CSS is flattened and used fonts/assets are embedded. The browser rasterizes the snapshot through SVG foreignObject. The final overview is cached as PNG ArrayBuffer data in IndexedDB; cards display Blob URLs without executing project code. Card cleanup revokes URLs, temporary ImageBitmaps are closed, encoding canvases are resized to zero, and the renderer iframe is removed even if generation fails.

The fixture cache key includes project ID, saved revision and renderer format. Revisions and library versions are fixed to these test fixtures. A production implementation must get the current saved revision from project metadata and include the selected canvas scope. Production scheduling should generate visible stale/missing covers first and cancel queued work when it is no longer needed. This probe eagerly queues its requested test cards and has no cache quota policy.

## Running

From `platform/wab`, using read-only fixtures already placed in `/tmp/plasmic-cover-probe`:

```sh
./node_modules/.bin/esbuild tools/dashboard-preview-probe/fidelity.tsx --bundle --minify --outfile=/tmp/plasmic-cover-probe/fidelity.js
NODE_ENV=production PLASMIC_SELF_HOSTED=1 STATIC_URL=http://127.0.0.1:3217/static pnpm exec rsbuild build --config tools/dashboard-preview-probe/rsbuild.config.ts
node tools/dashboard-preview-probe/serve.cjs
```

The server binds only `127.0.0.1:3217`. It serves the project's existing `desktop/renderer/static` runtime, the probe build and local fixtures. Real model fixtures and screenshots are deliberately outside the repository.

Required fixtures are the two project API responses, app configuration, and pinned canvas registration bundles for antd6, overseas, react-ui and antd-icons. The current fixtures are REQ075 revision 137 and Admin Templates revision 37. They exercise a four-artboard canvas and a ten-artboard canvas.

```sh
node tools/dashboard-preview-probe/benchmark.cjs
node tools/dashboard-preview-probe/browsers.cjs
node tools/dashboard-preview-probe/canvas-edge.cjs
```

`benchmark.cjs` compares browser screenshots with client-generated PNGs, checks every artboard fits, repeats generation three times, measures Chromium JS heap after forced collection and process RSS, and tests 100 cards against persistent cache after reload with project-model requests blocked. Those 100 cards repeat two projects; they are not 100 distinct cold projects. The measured generation time includes reference screenshots, collection and pixel comparisons.

`browsers.cjs` checks the same pipeline in Firefox and WebKit. `canvas-edge.cjs` checks cross-origin taint and WebGL buffers. Test artifacts are written to `/tmp/plasmic-cover-probe`.

## Limits

Cross-origin images and fonts must be fetchable with CORS. Tainted Canvas pixels cannot be read. Default WebGL drawing buffers can be cleared before capture; those components need a render-complete export or their own snapshot API. Cross-origin embedded frames, shadow DOM, video and arbitrary animated/data-query components are not covered by these fixtures. The two primary business pages have no backend data queries; the chart/Canvas sample is separate from the saved business projects. This experiment does not claim universal DOM capture fidelity.

The JS heap check verifies collection of renderer/model objects. Browser RSS, decoded images, GPU resources and font caches are separate measurements, and allocator pools need not return to the OS immediately. The renderer runs on the client's main thread; serial scheduling bounds concurrency but does not eliminate long tasks.

## Verification status

Chromium passes the strict fixture, cache, geometry and repeated-generation checks. The business snapshots have less than 0.32% of pixels with a channel difference greater than 20 against browser screenshots. The Recharts / Canvas 2D / CSS sample is also checked independently.

Firefox and WebKit complete multi-artboard generation and persistent cache reads. WebKit’s whole-image fidelity check currently fails the 1% threshold on the CSS sample; Firefox also showed a larger difference in one run. The failure is retained in the test instead of relaxing the threshold. Generated PNGs and browser screenshots are available for comparison. These engines are not declared fully equivalent.

Chromium's JS heap returns to approximately 2.5 MiB after renderer destruction across three regeneration rounds. Its process RSS remains above its initial level: native resource caches and allocator pools require separate evaluation. The benchmark's optional critical-memory-pressure diagnostic is a DevTools test operation, not something the production web app can invoke.

The production implementation lives in `src/wab/client/components/dashboard/preview`. `production.cjs` exercises its queue, visibility cancellation, persistent cache and final PNG transfer in Chromium, Firefox and WebKit. `production-memory.cjs` measures repeated rendering with that implementation, including live DOM documents/nodes and worker targets after cleanup. These tests use 100 cards repeating two fixture projects, not 100 distinct cold projects.

Build `rsbuild.preview.config.ts` with the local static origin `http://127.0.0.1:3218`, compile `client.tsx` with esbuild as an ESM browser entry, then run `production-serve.cjs`. It binds loopback and maps existing read-only model/component-library fixtures to the production API paths. Test outputs remain in `/tmp/plasmic-cover-probe`. Browser RSS is recorded separately from JS/DOM collection; it is not asserted to return to baseline.
