import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ModelFieldStore } from "@/wab/client/studio-ctx/model-snapshots";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

const inactivePreview = createStore(() => ({ isLive: false }));

export function useStudioLiveMode(studio: StudioCtx): boolean {
  const preview = useStore(studio.previewOwnerStore);
  const store: ModelFieldStore<{ readonly isLive: boolean }> = preview?.store ?? inactivePreview;
  return useStore(store, (state) => state.isLive);
}

export const useCurrentAppUser = (studio: StudioCtx) =>
  useStore(studio.currentAppUserStore, (state) => state.appUser);

export const useCurrentAppUserToken = (studio: StudioCtx) =>
  useStore(studio.currentAppUserStore, (state) => state.fakeAuthToken);

export function subscribeStudioLiveMode(
  studio: StudioCtx,
  listener: (next: boolean, previous: boolean) => void,
) {
  const read = () => studio.previewOwnerStore.getState()?.store.getState().isLive ?? false;
  let previous = read();
  const update = () => {
    const next = read();
    if (next !== previous) {
      const before = previous;
      previous = next;
      listener(next, before);
    }
  };
  let stopPreview = studio.previewOwnerStore.getState()?.store.subscribe(update);
  const stopOwner = studio.previewOwnerStore.subscribe((preview) => {
    stopPreview?.();
    stopPreview = preview?.store.subscribe(update);
    update();
  });
  return () => { stopPreview?.(); stopOwner(); };
}
