import { useShallow } from "zustand/react/shallow";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { subscribeStudioSelection, useFocusedViewCtx } from "@/wab/client/studio-ctx/selection-state";
import type { TplNode, Variant } from "@/wab/shared/model/classes";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import type { ViewVariantSnapshot } from "@/wab/client/studio-ctx/view-variant-state";
import { arrayEq } from "@/wab/shared/common";
import * as React from "react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

const empty = createStore<ViewVariantSnapshot>(() => Object.freeze({
  frames: Object.freeze([]),
  global: Object.freeze({ targets: Object.freeze([]), pins: Object.freeze([]) }),
  showDefaultSlots: false,
  isEditingNonBaseVariant: false,
  isTargetingNonBaseVariant: false,
}));

export function useViewVariants<Selected>(view: ViewCtx | undefined, selector: (state: ViewVariantSnapshot) => Selected): Selected {
  return useStore(view ? view.variantStore : empty, selector);
}
export function useFocusedViewVariants<Selected>(studio: StudioCtx, selector: (state: ViewVariantSnapshot) => Selected): Selected {
  return useViewVariants(useFocusedViewCtx(studio), selector);
}

/** A tree renders several artboard owners. Combine their immutable inputs with
 * one React subscription, retaining the snapshot when every owner is unchanged. */
export function useViewVariantsList(views: readonly ViewCtx[]) {
  const owners = useShallow((input: readonly ViewCtx[]) => input)(views);
  const source = React.useMemo(() => createViewVariantsListSource(owners), [owners]);
  return React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
}

/** Project the domain's node-specific target combo at the store boundary. */
export function useCurrentSharedVariantCombo(view: ViewCtx, tpl: TplNode) {
  const source = React.useMemo(() => createSharedVariantComboSource(view, tpl), [view, tpl]);
  return React.useSyncExternalStore(source.subscribe, source.read, source.read);
}
function createSharedVariantComboSource(view: ViewCtx, tpl: TplNode) {
  let current: Variant[] = [];
  const read = () => {
    if (view.isDisposed) { return current; }
    const next = view.variantTplMgr().getCurrentSharedVariantComboForNode(tpl);
    if (!arrayEq(current, next)) { current = next; }
    return current;
  };
  return { read, subscribe: (listener: () => void) => view.variantStore.subscribe(() => { const before = current; read(); if (current !== before) { listener(); } }) };
}

export function subscribeViewVariants<Selected>(view: ViewCtx, selector: (state: ViewVariantSnapshot) => Selected, listener: (next: Selected, previous: Selected) => void) {
  let current = selector(view.variantStore.getState());
  return view.variantStore.subscribe((state) => {
    const next = selector(state);
    if (!Object.is(current, next)) {
      const previous = current;
      current = next;
      listener(next, previous);
    }
  });
}


export function subscribeFocusedViewVariants<Selected>(studio: StudioCtx, selector: (state: ViewVariantSnapshot) => Selected, listener: (next: Selected, previous: Selected) => void) {
  const initialOwner = studio.selectionStore.getState().view;
  let current = selector(initialOwner ? initialOwner.variantStore.getState() : empty.getState());
  let stopView: (() => void) | undefined;
  const sync = () => {
    const owner = studio.selectionStore.getState().view;
    const next = selector(owner ? owner.variantStore.getState() : empty.getState());
    if (!Object.is(current, next)) { const previous = current; current = next; listener(next, previous); }
  };
  const connect = () => {
    stopView?.();
    const owner = studio.selectionStore.getState().view;
    stopView = owner ? owner.variantStore.subscribe(sync) : undefined;
    sync();
  };
  connect();
  const stopOwner = subscribeStudioSelection(studio, (selection) => selection.view, connect);
  return () => { stopOwner(); stopView?.(); };
}

function createViewVariantsListSource(owners: readonly ViewCtx[]) {
    type TreeInputs = Pick<ViewVariantSnapshot, "frames" | "global" | "showDefaultSlots">;
    let snapshot: readonly TreeInputs[] = Object.freeze([]);
    const getSnapshot = () => {
      const next = owners.map((view, index) => {
        const state = view.variantStore.getState();
        const before = snapshot[index];
        return before && before.frames === state.frames && before.global === state.global && before.showDefaultSlots === state.showDefaultSlots
          ? before : Object.freeze({ frames: state.frames, global: state.global, showDefaultSlots: state.showDefaultSlots });
      });
      if (!arrayEq(snapshot, next)) { snapshot = Object.freeze(next); }
      return snapshot;
    };
    const subscribe = (listener: () => void) => {
      const stops = owners.map((view) => view.variantStore.subscribe(listener));
      return () => stops.forEach((stop) => stop());
    };
    return { getSnapshot, subscribe };
  }
