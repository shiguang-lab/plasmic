import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { emptyViewSelection, type ViewSelectionSnapshot, type SelectionTargetRef } from "@/wab/client/studio-ctx/view-selection";
import type { StudioSelectionSnapshot } from "@/wab/client/studio-ctx/studio-selection";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

const emptyView = createStore<ViewSelectionSnapshot>(() => emptyViewSelection);
const emptyStudio = createStore<StudioSelectionSnapshot>(() => Object.freeze({ view: undefined, frames: Object.freeze([]) }));

/** Select only immutable editor input fields; model reads remain explicit. */
export function useViewSelection<Selected>(view: ViewCtx | undefined, select: (state: ViewSelectionSnapshot) => Selected): Selected {
  return useStore(view ? view.selectionStore : emptyView, select);
}

export function useStudioSelection<Selected>(studio: StudioCtx | undefined, select: (state: StudioSelectionSnapshot) => Selected): Selected {
  return useStore(studio ? studio.selectionStore : emptyStudio, select);
}

export const useFocusedViewCtx = (studio: StudioCtx | undefined) => useStudioSelection(studio, (state) => state.view);

export function useFocusedViewSelection<Selected>(studio: StudioCtx | undefined, select: (state: ViewSelectionSnapshot) => Selected): Selected {
  const view = useFocusedViewCtx(studio);
  return useViewSelection(view, select);
}

export function subscribeViewSelection<Selected>(view: ViewCtx, select: (state: ViewSelectionSnapshot) => Selected, listener: (next: Selected, previous: Selected) => void) {
  let previous = select(view.selectionStore.getState());
  return view.selectionStore.subscribe((state) => {
    const next = select(state);
    if (!Object.is(next, previous)) {
      const before = previous;
      previous = next;
      listener(next, before);
    }
  });
}

export function subscribeStudioSelection<Selected>(studio: StudioCtx, select: (state: StudioSelectionSnapshot) => Selected, listener: (next: Selected, previous: Selected) => void) {
  let previous = select(studio.selectionStore.getState());
  return studio.selectionStore.subscribe((state) => {
    const next = select(state);
    if (!Object.is(next, previous)) {
      const before = previous;
      previous = next;
      listener(next, before);
    }
  });
}

/** Native ownership changes detach the old ViewCtx before reading the next one. */
export function subscribeFocusedViewSelection<Selected>(studio: StudioCtx, select: (state: ViewSelectionSnapshot) => Selected, listener: (next: Selected, previous: Selected) => void) {
  const read = () => select(studio.selectionStore.getState().view?.selectionStore.getState() ?? emptyViewSelection);
  let previous = read();
  const update = () => {
    const next = read();
    if (!Object.is(next, previous)) {
      const before = previous;
      previous = next;
      listener(next, before);
    }
  };
  let stopView = studio.selectionStore.getState().view?.selectionStore.subscribe(update);
  const stopStudio = studio.selectionStore.subscribe((state, before) => {
    if (state.view !== before.view) {
      stopView?.();
      stopView = state.view?.selectionStore.subscribe(update);
      update();
    }
  });
  return () => { stopView?.(); stopStudio(); };
}

export const useHoveredViewCtx = (studio: StudioCtx) => useStore(studio.hoveredViewStore);

export function matchesSelectionTarget(target: SelectionTargetRef | null | undefined, item: { readonly tplUid: number; readonly paramUid: number | undefined }): boolean {
  if (!target) { return false; }
  if (item.paramUid === undefined) { return target.kind === "value" && target.tpl.uid === item.tplUid; }
  const owner = target.kind === "slot" ? target.tpl : target.slotOwner;
  return owner?.uid === item.tplUid && target.slotParam?.uid === item.paramUid;
}
