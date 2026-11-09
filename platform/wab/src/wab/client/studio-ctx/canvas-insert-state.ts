import { createStudioStore, resolveStore } from "@/wab/client/stores/store-kit";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type {
  DragInsertState,
  FreestyleState,
} from "@/wab/client/studio-ctx/StudioCtx";
import { useStore } from "zustand";

/**
 * Canvas insertion modes: free-style drawing and "drag insert".
 *
 * Replaces `StudioCtx._freestyleState` and `_dragInsertState`
 * (`observable.box`). They are mutually exclusive by construction, so they share
 * one store, but each has its own selector.
 */
export interface CanvasInsertSnapshot {
  readonly freestyle: FreestyleState | undefined;
  readonly dragInsert: DragInsertState | undefined;
}

export function createCanvasInsertStore() {
  return createStudioStore<CanvasInsertSnapshot>(
    () => ({ freestyle: undefined, dragInsert: undefined }),
    { name: "studio-canvas-insert" },
  );
}

export type CanvasInsertStore = ReturnType<typeof createCanvasInsertStore>;

const emptyInsert = createCanvasInsertStore();

/** Reactive read for overlays that render the insertion mode. */
export function useFreestyleState(
  studio: StudioCtx | undefined,
): FreestyleState | undefined {
  return useStore(
    resolveStore(studio?.canvasInsertStore, emptyInsert),
    (state) => state.freestyle,
  );
}

export function useDragInsertState(
  studio: StudioCtx | undefined,
): DragInsertState | undefined {
  return useStore(
    resolveStore(studio?.canvasInsertStore, emptyInsert),
    (state) => state.dragInsert,
  );
}
