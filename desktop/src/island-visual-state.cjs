/** Cheap document-local invalidation; the bitmap renderer runs only after changes. */
function inspectVisualState({ captureCanvasPixels = false } = {}) {
  let state = globalThis.__plasmicIslandVisualState;
  if (!state) {
    const ignored = "[data-plasmic-editor-only], [data-plasmic-slot-placeholder], script";
    const ignoredAttributes = new Set(["data-plasmic-render-ready", "data-plasmic-frame-uuid", "data-plasmic-component-uuid", "data-plasmic-table-column-selected"]);
    const relevant = node => !(node.nodeType === 1 ? node : node.parentElement)?.closest(ignored);
    state = { id: crypto.randomUUID(), revision: 0, changedAt: 0, canvasPixels: new WeakMap() };
    const changed = () => { state.revision++; state.changedAt = Date.now(); };
    const mutations = records => {
      if (records.some(record => relevant(record.target) &&
        (record.type === "attributes" ? !ignoredAttributes.has(record.attributeName)
          : record.type !== "childList" || [...record.addedNodes, ...record.removedNodes].some(relevant)))) changed();
    };
    state.observer = new MutationObserver(mutations);
    state.observer.observe(document, {subtree:true,childList:true,attributes:true,characterData:true});
    state.flush = () => mutations(state.observer.takeRecords());
    for (const event of ["input", "change", "scroll", "load", "error", "focusin", "focusout", "pointerover", "pointerout"]) {
      document.addEventListener(event, event => { if (relevant(event.target)) changed(); }, true);
    }
    window.addEventListener("resize", changed);
    document.fonts?.addEventListener("loadingdone", changed);
    globalThis.__plasmicIslandVisualState = state;
  }
  state.flush();
  // Editing mirrors already export canvas pixels. Compare and reuse that exact
  // export once per tick; preview capture keeps its compositor-only path.
  const canvases = [...document.querySelectorAll("canvas")];
  let dynamic = !!document.querySelector("video");
  if (!captureCanvasPixels) dynamic ||= canvases.length > 0;
  else {
    for (const canvas of canvases) {
      try {
        const pixels = canvas.toDataURL();
        if (state.canvasPixels.get(canvas) !== pixels) {
          state.canvasPixels.set(canvas, pixels);
          state.revision++;
          dynamic = true;
        }
      } catch {
        state.canvasPixels.delete(canvas);
        dynamic = true;
      }
    }
    // A canvas must not make ongoing DOM changes wait for the static debounce.
    if (canvases.length && Date.now() - state.changedAt < 150) dynamic = true;
  }
  dynamic ||=
    (document.getAnimations?.() || []).some(animation => animation.playState === "running" &&
      !animation.effect?.target?.closest?.("[data-plasmic-editor-only], [data-plasmic-slot-placeholder]"));
  return {id:state.id,revision:state.revision,changedAt:state.changedAt,dynamic};
}

module.exports = { inspectVisualState };
