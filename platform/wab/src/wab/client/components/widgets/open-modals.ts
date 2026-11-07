import * as React from "react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

// Each frame owns its modal lifetimes. Only the first open / last close changes
// the UI snapshot; opening another modal does not notify subscribers.
let openModalCount = 0;
const modalStore = createStore(() => false);

export function isAnyModalOpen(): boolean {
  return modalStore.getState();
}

export function useIsAnyModalOpen(): boolean {
  return useStore(modalStore, (open) => open);
}

export function subscribeModalOpen(
  listener: (open: boolean) => void,
): () => void {
  const unsubscribe = modalStore.subscribe((open) => listener(open));
  listener(modalStore.getState());
  return unsubscribe;
}

export function useTrackOpenModal(open: boolean): void {
  React.useEffect(() => {
    if (!open) {
      return;
    }
    openModalCount++;
    modalStore.setState(true, true);
    return () => {
      openModalCount--;
      modalStore.setState(openModalCount > 0, true);
    };
  }, [open]);
}
