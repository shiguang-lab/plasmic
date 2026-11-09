import { createStudioStore, resolveStore } from "@/wab/client/stores/store-kit";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { useStore } from "zustand";

/**
 * Auto-opened ("revealed") canvas content for one ViewCtx.
 *
 * This used to be `ViewCtx._autoOpenedUuid`, an `observable.box`. It is UI state,
 * written imperatively by the canvas rendering path and read by a couple of
 * overlays, so it belongs in a store rather than in MobX.
 */
export interface AutoOpenSnapshot {
  readonly autoOpenedUuid: string | undefined;
}

export function createAutoOpenStore() {
  return createStudioStore<AutoOpenSnapshot>(
    () => ({ autoOpenedUuid: undefined }),
    { name: "view-auto-open" },
  );
}

export type AutoOpenStore = ReturnType<typeof createAutoOpenStore>;

/** Fallback for components rendered without a ViewCtx. */
const emptyAutoOpen = createAutoOpenStore();

/** Reactive read; re-renders only when the revealed uuid changes. */
export function useAutoOpenedUuid(
  view: ViewCtx | undefined,
): string | undefined {
  return useStore(
    resolveStore(view?.autoOpenStore, emptyAutoOpen),
    (state) => state.autoOpenedUuid,
  );
}

/** Imperative write used by the canvas rendering path. */
export function setAutoOpenedUuid(
  view: ViewCtx,
  uuid: string | undefined,
): void {
  if (view.autoOpenStore.getState().autoOpenedUuid === uuid) {
    return;
  }
  view.autoOpenStore.setState({ autoOpenedUuid: uuid });
}
