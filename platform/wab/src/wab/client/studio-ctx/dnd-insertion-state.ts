import { createStudioStore, resolveStore } from "@/wab/client/stores/store-kit";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import type { InsertionSpec } from "@/wab/client/Dnd";
import { useStore } from "zustand";

/**
 * The tentative insertion currently being dragged over, shown as drop markers.
 *
 * Replaces `ViewCtx._dndTentativeInsertion` (`observable.box`). Written by the
 * drag managers, read by the DnD marker overlays.
 */
export interface DndInsertionSnapshot {
  readonly tentativeInsertion: InsertionSpec | undefined;
}

export function createDndInsertionStore() {
  return createStudioStore<DndInsertionSnapshot>(
    () => ({ tentativeInsertion: undefined }),
    { name: "view-dnd-insertion" },
  );
}

export type DndInsertionStore = ReturnType<typeof createDndInsertionStore>;

const emptyInsertion = createDndInsertionStore();

/** Reactive read for the drop markers. */
export function useDndTentativeInsertion(
  view: ViewCtx | undefined,
): InsertionSpec | undefined {
  return useStore(
    resolveStore(view?.dndInsertionStore, emptyInsertion),
    (state) => state.tentativeInsertion,
  );
}

/** Imperative write used by the drag managers. */
export function setDndTentativeInsertion(
  view: ViewCtx,
  insertion: InsertionSpec | undefined,
): void {
  if (view.dndInsertionStore.getState().tentativeInsertion === insertion) {
    return;
  }
  view.dndInsertionStore.setState({ tentativeInsertion: insertion });
}
