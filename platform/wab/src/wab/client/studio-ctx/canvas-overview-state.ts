import { createStudioStore, resolveStore } from "@/wab/client/stores/store-kit";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { StudioViewportSnapshot } from "@/wab/client/studio-ctx/studio-arena-state";
import type { AnyArena } from "@/wab/shared/Arenas";
import { useStore } from "zustand";

/**
 * The saved viewport of the arena the user came from when focusing a single
 * canvas frame ("focus mode"), so leaving focus mode can restore it.
 *
 * Replaces `StudioCtx.canvasOverviewViewport` (`observable.box`). Only
 * `outline-tab` reads it reactively, through `canvasFocusActive`.
 */
export interface CanvasOverviewSnapshot {
  readonly overview:
    | {
        readonly arena: AnyArena;
        readonly viewport: StudioViewportSnapshot;
      }
    | undefined;
}

export function createCanvasOverviewStore() {
  return createStudioStore<CanvasOverviewSnapshot>(
    () => ({ overview: undefined }),
    { name: "studio-canvas-overview" },
  );
}

export type CanvasOverviewStore = ReturnType<typeof createCanvasOverviewStore>;

const emptyOverview = createCanvasOverviewStore();

/**
 * The arena whose viewport is currently saved for focus mode.
 *
 * Returned as the arena itself rather than a boolean so callers can compare it
 * with their own arena without the hook capturing a stale `currentArena`.
 */
export function useCanvasOverviewArena(
  studio: StudioCtx | undefined,
): AnyArena | undefined {
  return useStore(
    resolveStore(studio?.canvasOverviewStore, emptyOverview),
    (state) => state.overview?.arena,
  );
}
