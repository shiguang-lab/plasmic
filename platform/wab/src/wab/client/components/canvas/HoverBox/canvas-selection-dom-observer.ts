import ResizeObserver from "resize-observer-polyfill";

/** DOM callbacks belong to the ViewCtx lifetime, which can end before React's
 * passive effect cleanup. The fence also cancels a callback already queued by
 * the browser; disconnect alone cannot revoke a captured callback. */
export function observeCanvasSelectionDom(
  lifetime: AbortSignal,
  targets: readonly Node[],
  options: MutationObserverInit,
  onMutations: (records: MutationRecord[]) => void,
  resize?: { readonly targets: readonly Element[]; readonly onResize: () => void },
): () => void {
  if (lifetime.aborted) { return () => undefined; }
  let active = true;
  const mutations = new MutationObserver((records) => {
    if (active) { onMutations(records); }
  });
  const sizes = resize ? new ResizeObserver(() => {
    if (active) { resize.onResize(); }
  }) : undefined;
  const stop = () => {
    if (!active) { return; }
    active = false;
    mutations.takeRecords();
    mutations.disconnect();
    sizes?.disconnect();
    lifetime.removeEventListener("abort", stop);
  };
  lifetime.addEventListener("abort", stop, { once: true });
  targets.forEach((target) => mutations.observe(target, options));
  resize?.targets.forEach((target) => sizes?.observe(target));
  return stop;
}
