import { createStudioStore, resolveStore } from "@/wab/client/stores/store-kit";
import type {
  RightTabKey,
  StudioCtx,
} from "@/wab/client/studio-ctx/StudioCtx";
import { useStore } from "zustand";

/**
 * Which tab the right pane shows.
 *
 * Replaces `StudioCtx._xRightTabKey` (`observable.box`); the right pane renders
 * it, and commands switch it.
 */
export interface RightPanelSnapshot {
  readonly tabKey: RightTabKey | undefined;
}

export function createRightPanelStore() {
  return createStudioStore<RightPanelSnapshot>(() => ({ tabKey: undefined }), {
    name: "studio-right-panel",
  });
}

export type RightPanelStore = ReturnType<typeof createRightPanelStore>;

/** Fallback for callers without a Studio. */
const emptyRightPanel = createRightPanelStore();

/** Reactive read for the right pane. */
export function useRightTabKey(
  studio: StudioCtx | undefined,
): RightTabKey | undefined {
  return useStore(
    resolveStore(studio?.rightPanelStore, emptyRightPanel),
    (state) => state.tabKey,
  );
}
