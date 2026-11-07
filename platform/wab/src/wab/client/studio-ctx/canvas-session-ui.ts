import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

const noReveals = createStore<boolean>(() => false);

export function useCanvasReveals(view: ViewCtx | undefined) {
  return useStore(view?.canvasSessionState.revealsStore ?? noReveals);
}
