# Rendered design inspection

Read when observing geometry, screenshots or real Preview behavior. Use live tool schemas; view changes must not become saved business state.

`snapshot_layout` provides rendered geometry and image sources, not editable model IDs. Its observations are bounded (currently 2,000 elements); it checks horizontal overflow and image loading. Pin a component when supported without changing the active arena/selection. Obtain node UUIDs separately through `read`.

`get_screenshot` normally produces clean static artboard pixels without editor chrome/placeholders. Prefer an explicit `frameUuid` for ambiguous canvases. Width resizes the selected static snapshot, not a live responsive viewport; record source viewport and resizing. Workspace mode captures the visible editor and may support a crop rect; discover permitted target combinations. Identify the page using its title/breadcrumb and a unique business-body element from the readback, not width alone. Static screenshots do not execute interactions.

In Preview, exercise actual required interactions and capture visible overlays/processing before terminal states. Desktop Preview follows the App window; for fixed-size comparisons choose Custom at the requested CSS viewport. Record presentation scale separately. Hidden Tabs and overlays require both model reads and actual Preview observations; do not persist `open=true` or active-key overrides to make them inspectable.

Desktop's **Open preview in browser** saves the design before opening the external preview. Read-only tasks use the in-app Preview or an already open authorized preview; do not trigger that browser action to inspect unsaved work. If only the saving entry point is available, retain model/static evidence and report the missing runtime check. Prototype tasks may use it after the authorized save.

For offscreen rendered content use `execute` → `scrollElementIntoView` with component/element UUIDs from `read`; frame and repeated instance targeting follow the live schema. Navigate first and wait for rendering. Inspect returned visible/bounds plus a workspace screenshot; static snapshot rendering is separate. Hidden/unrendered targets fail; ancestor clipping can still make visible=false. Restore temporary editor mode/view changes after inspection.

Visual evidence records page identity, viewport, inspected region, concrete observations and pass/fail. Keep model, geometry, pixels, exercised behavior and persistence as separate results. A successful save or screenshot capture does not pass the other checks.
