import { createStudioStore, resolveStore } from "@/wab/client/stores/store-kit";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { useStore } from "zustand";

/**
 * The `data-plasmic-canvas-mirror` attribute of the canvas root, mirrored into
 * the host so the canvas can be rendered in a separate document.
 *
 * Replaces `ViewCtx._canvasMirrorTarget` (`observable.box`). Written by a DOM
 * MutationObserver, read when deciding whether a frame needs to render.
 */
export interface CanvasMirrorSnapshot {
  readonly target: string | undefined;
}

export function createCanvasMirrorStore() {
  return createStudioStore<CanvasMirrorSnapshot>(
    () => ({ target: undefined }),
    { name: "view-canvas-mirror" },
  );
}

export type CanvasMirrorStore = ReturnType<typeof createCanvasMirrorStore>;

const emptyMirror = createCanvasMirrorStore();

export function useCanvasMirrorTarget(
  view: ViewCtx | undefined,
): string | undefined {
  return useStore(
    resolveStore(view?.canvasMirrorStore, emptyMirror),
    (state) => state.target,
  );
}

export function setCanvasMirrorTarget(
  view: ViewCtx,
  target: string | undefined,
): void {
  if (view.canvasMirrorStore.getState().target === target) {
    return;
  }
  view.canvasMirrorStore.setState({ target });
}
