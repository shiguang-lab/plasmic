# Rendered design inspection

Read when observing geometry, screenshots or real Preview behavior. Use live tool schemas; view changes must not become saved business state.

## Geometry and static screenshots

`snapshot_layout` provides rendered geometry and image sources, not editable model IDs. Default output is a summary with paginated problems; use `view:"elements"`/`"images"` for detail. It checks horizontal overflow, image loading and controls escaping sticky Table-cell content bounds. `cellContent` records actual cell padding, control bounds and required width; an operation group can overflow its cell while remaining inside the viewport. For acceptance request `view:"full"` with each Page's `componentUuid`: it pins a background canvas without changing the active arena/selection, so preceding it with `navigate` is unnecessary. Rendering acceptance requires a fresh capture declaring `table-cell-control-overflow` in `checked`; old captures cannot establish this check. Obtain node UUIDs separately through `read`. A metadata timeout alone does not establish that page unloading caused a renderer hang; retain Desktop version, operation/stage timing and project identity before diagnosing or retrying.

`get_screenshot` returns a compressed WebP preview without editor chrome/placeholders; use `fullResolution:true` for original-size lossless pixels. Prefer an explicit `frameUuid` for ambiguous canvases. Width/height set the temporary static rendering viewport; they are separate from output compression and do not resize the live Preview. Record source-frame dimensions, capture dimensions and any resizing. Workspace mode captures the visible editor and may support a crop rect; discover permitted target combinations. Identify the page using its title/breadcrumb and a unique business-body element from the readback, not width alone. Static screenshots do not execute interactions. Background geometry/screenshot reads show an inspection activity status in the App; it identifies acquisition, not acceptance. Open each returned image and reject visible omissions before generating the next Page. Record the required visible content and the actual observation, including failures.

## Native Preview

Use top-level `preview` for runtime acceptance: `{action:"open",componentUuid:"PAGE_UUID",width:1440,height:1024}`. It uses authenticated in-app Preview without saving or adding a device column. Width/height select a temporary Custom **runtime test viewport**; design columns retain Desktop. `state` reports actual committed iframe readiness and Page identity. Runtime operations use this entry point so actions/evidence are collected; execute/batch cannot route Preview. An external Preview popup must be closed first.

`preview {action:"snapshot"}` returns bounded, paginated DOM roles/names/values and text; follow nextOffset and text.nextOffset as needed. These refs identify runtime DOM, never editable model UUIDs. They expire after navigation or replacement. Use click/fill/press/scroll with current refs. Native select uses select; an Antd selector uses click → snapshot → click option. Interactions trigger actual DOM/input events and never change saved props to imitate a result. Use source-derived actions and assertions from the local plan; assert evaluates the supplied text/count/value/visibility checks (default wait 2 seconds, maximum timeoutMs 10000). Failed assertions remain failures, not completed cases.

`preview {action:"screenshot"}` captures the visible runtime iframe, returns compressed WebP, and records CSS viewport separately from presentation pixel size. It rejects clipped viewports; reveal the full Preview in the App. Use it for required overlay/processing states before terminal results. `get_screenshot` with componentUuid is the static canvas image, not a replacement for runtime behavior. Close through `preview {action:"close"}` before edits. Hidden Tabs/overlays require actual observations; do not persist open/active-key overrides to inspect them.

`preview.open` retains the original editing canvas/artboard, zoom and pan before the mode transition. `preview.close` exits native Preview or interactive canvas mode, restores that retained view and waits for the editor canvas; it does not require a functioning Preview iframe. It returns `view` plus actual project/session/Page/frame/mode in `context`, without saving or changing business state. Repeated close is safe. `navigate` locates an editor arena; it is not an exit-Preview command. Retain unfinished runtime cases in the local plan and rerun them after recovery.

`preview.state` returns `ready:false` when outside native Preview. Model readiness and the retained editor selection do not prove runtime readiness. For context errors follow the [execution-context recovery contract](desktop-context.md); do not silently switch modes through a model read/write or use save/reopen as a routine mode-recovery shortcut.

## Pen and external references

For Pen references, ordinary `design_reference.screenshot` uses public `TakeScreenshot`; inspect `sourceFrameSize` and pixel `scale`, since Pen may return a thumbnail. `fullResolution:true` uses public `Export` at scale 1 into a temporary directory, reads the source pixels and removes the exported file. It never modifies the Pen design or enlarges a thumbnail. The result records its capture method, actual image dimensions and scale; insufficient export resolution fails explicitly. Use full resolution when judging text, spacing and fine layout.

External reference tools require a ready, editable Studio project open in edit mode. Start `reference_browser` with `{action:"load_page",url:"https://external-reference.example/page"}`; it validates the source and editor context before showing the panel. `capture_browser` captures an external source, and `import_reference` explicitly imports a loaded external reference into a separate artboard. These tools isolate Studio authentication. `close` always hides the reference panel. Runtime acceptance belongs to `preview`: if it fails, keep the current Page incomplete and report the exact error. Reference tools and model-state changes cannot replace the missing runtime check.

## Other inspection entry points

Desktop's **Open preview in browser** saves the design before opening the external preview. Read-only tasks use the in-app Preview or an already open authorized preview; do not trigger that browser action to inspect unsaved work. If only the saving entry point is available, retain model/static evidence and report the missing runtime check. Prototype tasks may use it after the authorized save.

For offscreen rendered content use `execute` → `scrollElementIntoView` with component/element UUIDs from `read`; frame and repeated instance targeting follow the live schema. Navigate first and wait for rendering. Inspect returned visible/bounds plus a workspace screenshot; static snapshot rendering is separate. Hidden/unrendered targets fail; ancestor clipping can still make visible=false. Restore temporary editor mode/view changes after inspection.

## Evidence interpretation

Visual evidence records page identity, viewport, inspected region, concrete observations and pass/fail. Keep model, geometry, pixels, exercised behavior and persistence as separate results. A successful save or screenshot capture does not pass the other checks.

Static captures default to the selected source frame dimensions. Below-fold reachability and responsive interactions require actual Preview tests, independently of static capture sizing.
