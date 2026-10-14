# Studio canvas startup

Before the Studio module loads, Root fetches bundle version and application
data concurrently. It reuses the raw responses after version resolution and
applies configuration only when constructing AppCtx. Application-data retries
fetch fresh responses without repeating a successful bundle lookup. Desktop
startup checks access to the saved project; recent-project refresh runs when
the File menu opens rather than delaying navigation.

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
