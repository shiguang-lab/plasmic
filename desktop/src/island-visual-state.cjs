/** Cheap document-local invalidation; the bitmap renderer runs only after changes. */
function inspectVisualState() {
  let state = globalThis.__plasmicIslandVisualState;
  if (!state) {
    const ignored = "[data-plasmic-editor-only], [data-plasmic-slot-placeholder], script";
    const ignoredAttributes = new Set(["data-plasmic-render-ready", "data-plasmic-frame-uuid", "data-plasmic-component-uuid", "data-plasmic-table-column-selected"]);
    const relevant = node => !(node.nodeType === 1 ? node : node.parentElement)?.closest(ignored);
    state = { id: crypto.randomUUID(), revision: 0, changedAt: 0 };
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
  // Canvas pixels and active animation frames have no DOM mutation event.
  const dynamic = !!document.querySelector("canvas, video") ||
    (document.getAnimations?.() || []).some(animation => animation.playState === "running" &&
      !animation.effect?.target?.closest?.("[data-plasmic-editor-only], [data-plasmic-slot-placeholder]"));
  return {id:state.id,revision:state.revision,changedAt:state.changedAt,dynamic};
}

module.exports = { inspectVisualState };
