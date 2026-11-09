import { createStudioStore, resolveStore } from "@/wab/client/stores/store-kit";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import type { Adoptee } from "@/wab/client/Dnd";
import { useStore } from "zustand";

/**
 * Adoptees highlighted while dragging a node over a container.
 *
 * Replaces `ViewCtx._xHighlightedAdoptees` (`observable.box`). Written by the
 * freestyle drag path, read by the DnD overlay.
 */
export interface AdopteeHighlightSnapshot {
  readonly adoptees: readonly Adoptee[];
}

export function createAdopteeHighlightStore() {
  return createStudioStore<AdopteeHighlightSnapshot>(
    () => ({ adoptees: [] }),
    { name: "view-adoptee-highlight" },
  );
}

export type AdopteeHighlightStore = ReturnType<
  typeof createAdopteeHighlightStore
>;

const emptyHighlight = createAdopteeHighlightStore();

/** Reactive read for overlays. */
export function useHighlightedAdoptees(view: ViewCtx | undefined): readonly Adoptee[] {
  return useStore(
    resolveStore(view?.adopteeHighlightStore, emptyHighlight),
    (state) => state.adoptees,
  );
}

/** Imperative write used by the drag path. */
export function setHighlightedAdoptees(
  view: ViewCtx,
  adoptees: readonly Adoptee[],
): void {
  if (view.adopteeHighlightStore.getState().adoptees === adoptees) {
    return;
  }
  view.adopteeHighlightStore.setState({ adoptees });
}
