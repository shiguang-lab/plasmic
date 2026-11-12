import { createStudioStore, resolveStore } from "@/wab/client/stores/store-kit";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { useStore } from "zustand";

/**
 * The last canvas runtime failure, surfaced through the host frame.
 *
 * Replaces `StudioCtx.canvasLoadError` (`observable.box`), which consumers read
 * with `.get()` directly.
 */
export interface CanvasLoadSnapshot {
  readonly error: string | undefined;
  readonly frameErrors: ReadonlyMap<string, string>;
}

export function createCanvasLoadStore() {
  return createStudioStore<CanvasLoadSnapshot>(
    () => ({ error: undefined, frameErrors: new Map() }),
    { name: "studio-canvas-load" },
  );
}

export type CanvasLoadStore = ReturnType<typeof createCanvasLoadStore>;

const emptyCanvasLoadStore = createCanvasLoadStore();

export function useCanvasLoadError(studio: StudioCtx): string | undefined {
  return useStore(resolveStore(studio.canvasLoadStore, emptyCanvasLoadStore), (state) => state.error);
}
