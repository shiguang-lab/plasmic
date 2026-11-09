import {
  createStudioStore,
  registerStoreReset,
} from "@/wab/client/stores/store-kit";
import * as React from "react";
import { useStore } from "zustand";

// Each frame owns its modal lifetimes. Only the first open / last close changes
// the UI snapshot; opening another modal does not notify subscribers.
let openModalCount = 0;
const modalStore = createStudioStore(() => false, { name: "open-modals" });

// `openModalCount` is part of this store's state even though it lives outside
// the snapshot; reset both together so tests start from a clean module.
registerStoreReset(() => {
  openModalCount = 0;
  modalStore.setState(modalStore.getInitialState(), true);
});

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

function retainOpenModal() {
  openModalCount++;
  modalStore.setState(true, true);
  return () => {
    openModalCount--;
    modalStore.setState(openModalCount > 0, true);
  };
}

export function useTrackOpenModal(open: boolean): void {
  React.useEffect(() => open ? retainOpenModal() : undefined, [open]);
}
