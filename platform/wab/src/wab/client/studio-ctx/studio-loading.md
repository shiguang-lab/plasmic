# Studio canvas startup

Project routes use the startup contract below. Other routes fetch bundle version
and application data concurrently. Application-data retries reuse a successful
bundle lookup. Desktop recent-project refresh runs when the File menu opens
rather than delaying navigation.

The target is the focused frame (including focus inside its content), or the
first frame of the current arena. Resolve it before its ViewCtx exists. Queue
that frame ahead of other frames in the current arena and background arenas.
Target iframe initialization starts without an idle wait; other iframe loads
remain serial and idle scheduled. Canvas evaluation retains its existing model
change and visibility scheduling.
Saved-view restoration waits for the target ViewCtx and resumes its queue even
if the saved target is initially offscreen. It restores the camera after the
inspector layout frames while target rendering proceeds. The viewport commit
frame and observable first render readiness both complete before releasing the
loading overlay. Editing tools continue to wait for the complete sync queue;
initial reveal does not wait on subsequent evaluations.
Other frames wait until the active target renders and the initial viewport is
restored. Navigation may interrupt this wait to initialize a new target; disposal
ends the wait. The first actual wait is recorded as `background-canvas-wait`.

Each ViewCtx exposes observable `initialRenderReady` after its first evaluation
and post-evaluation work produce a val system root. It stays true during later
edits, and a recreated ViewCtx starts false. Pending frames use their own loading
overlay. The global loading overlay and top-frame ready notification wait for
the target render and `initialViewportReady`, independently of other frames.
The inspector mounts when its ViewCtx exists so saved viewport restoration can
account for its padding before revealing the canvas. Loading does not select
frames, rewrite props or restore the viewport a second time.

## Timings

Read `window.studioCtx.loadTimings.snapshot()` in the Studio host frame's console.
`[Studio load]` logs snapshots when the canvas is revealed, all initial frame
contexts are created, and all initial frames render. Frames outside the viewport
retain the existing paused evaluation behavior, so the final render milestone
may occur only after they become visible.

`startMs` is relative to the host frame's Studio module import; `durationMs`
measures the completed stage. Milestones have zero duration. These timings do
not include top-frame navigation, permission lookup or host-frame bootstrapping
before the Studio module import. Overlapping stages must not be summed.

- Startup: `studio-module-import`, `startup-preferences`, `project-fetch`
  (including branch resolution), `model-unbundle`, `studio-context`,
  `code-component-sync`, `app-user-init`, `initializer-ready`.
- Route/viewport: `initial-route`, `initial-viewport` (including route waiting),
  `initial-target-wait`, `initial-viewport-layout`, `initial-viewport-commit`.
  `initial-target-wait` measures context availability; `initial-target-render-wait`
  measures any remaining first-render wait after camera commit.
- Per frame: `frame-load-start`, `frame-host-document` (fetch through document
  completion), `frame-host-ready`, `frame-runtime`, `frame-component-packages`,
  `frame-initialization`, `frame-context-created`, `frame-first-render`,
  `frame-rendered`.
- Milestones: `canvas-revealed`, `all-frame-contexts-created`,
  `all-frames-rendered`.

Only the first completion of each stage/frame is retained, scoped to the initial
arena. Later edits and arena visits do not accumulate timing entries. Snapshots
contain numeric timings and frame UUIDs, not page content or runtime props.

## Verification

From `platform/wab`:

```sh
pnpm exec vitest run src/wab/client/studio-ctx/progressive-canvas.test.ts src/wab/client/studio-ctx/studio-load-timings.test.ts src/wab/client/studio-ctx/initial-viewport.test.ts src/wab/client/components/studio/view-editor-loading.test.tsx src/wab/client/components/studio/studio-initializer.test.tsx
```

The controlled queue comparison uses four 100ms frame loads and 50ms idle waits.
The target is the last authored frame. The previous serial/all-frame gate would
release at 600ms; target-first progressive readiness releases at 100ms, while
all contexts finish at 550ms. This verifies scheduling and reveal independence;
it is not a measured business-project speedup. For real projects compare cold
and warm opens using `canvas-revealed.startMs` and
`all-frame-contexts-created.startMs`, preserving the same viewport and project
revision between runs.

## Top-frame startup contract

Project routes fetch `/api/v1/editor-bootstrap/:projectId`, which reuses the
existing user, configuration, app-context, project-permission, trusted-host and
branch readers. The response is private and `no-store`; it contains metadata,
not the project model. The full app-context collections retain their existing
contract for project navigation, membership and billing controls.

Startup metadata reads retry an IAM HTTP 503 at most twice, after 250ms and
500ms. Successful parallel reads are retained. Only an explicit HTTP 401 from
the identity endpoint denotes an anonymous user; service failures remain
retryable loading errors and must not redirect a signed-in user to login.

Desktop validates its saved route through the same endpoint. Its trusted main
frame may consume that response once for the same project within 30 seconds.
Later opens and retries fetch fresh data. No model response is persisted in this
startup cache.

Root starts the model request after resolving the project and branch, while the
editor chunk and host load. The top-frame bridge consumes that promise once for
an exact project/branch/latest-model match; other projects, revisions and
subsequent requests use the normal API. Host trust checks still precede editor
execution in the host. Transient startup metadata and promises are cleared when
consumed.

Loading chrome imports lightweight contexts and disabled controls. It does not
import `StudioCtx`, billing dialogs or dashboard screens. Context definitions and
hooks live in `contexts/StudioContexts.tsx`; the model classes are type-only
imports there. Form-registration metadata uses the `@plasmicpkgs/antd5/form-meta`
entry rather than the component-registration barrel.

The selected language pack loads before the first application render. Other
packs load on selection and concurrent requests share one download. Billing and
route-specific loading screens load on demand. The built-in host assigns its
onboarding illustration URL only for the standalone onboarding page, so hidden
editor/canvas/preview documents do not download it.

Dependency-update checks, imported-host warnings and release summaries wait for
the initial route, viewport and active target readiness. Ordinary comments wait
for the same gate; comment-thread deep links load immediately so route resolution
can consume them. Same-branch comment requests share an in-flight promise.
Disposal cancels pending readiness work. Local AI capability discovery waits for
Studio readiness. AI chat history, conversation directories and event subscriptions
start when the assistant or conversation picker opens, or before sending a request.
Closing these views releases the connection once running tasks, tool execution and
pending receipts have finished. Reopening refreshes the project snapshot and event
cursor before restoring conversations. Active-edit state and editing locks retain
their startup connections independently of AI chat.

Browser performance marks include `studio-entry`, `studio-shell`,
`studio-root-start`, `studio-bootstrap-ready` and `studio:<phase>:<frameUuid>`.
These supplement the host snapshot; navigation-to-visible/editable measurements
must still use a timer outside the application to include entry download,
parsing and initialization. The project endpoint adds `Server-Timing` stages
for revision, permission, dependency and owner reads alongside existing database
timings. Independent reads begin only after project authorization.
