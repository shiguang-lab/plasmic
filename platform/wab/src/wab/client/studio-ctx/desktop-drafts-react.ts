import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import {
  DesktopDraftController,
  DesktopDraftState,
  initialDesktopDraftState,
} from "@/wab/client/studio-ctx/desktop-drafts";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

// A stable inactive snapshot supports Studio's asynchronous controller lifecycle.
const inactiveStore = createStore<DesktopDraftState>(
  () => initialDesktopDraftState,
);

export function useDesktopDraftSelector<T>(
  controller: DesktopDraftController | undefined,
  selector: (state: DesktopDraftState) => T,
): T {
  return useStore(controller?.store ?? inactiveStore, selector);
}

export function useDesktopDraftController(
  owner: Pick<StudioCtx, "desktopDraftStore">,
) {
  return useStore(owner.desktopDraftStore, (controller) => controller);
}
