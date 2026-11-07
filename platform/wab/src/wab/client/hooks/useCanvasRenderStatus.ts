import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

const notRendered = createStore(() => ({ renderCount: 0, isFirstRenderComplete: false }));

export const useCanvasRenderCount = (view: ViewCtx | undefined) =>
  useStore(view?.csEvaluator?.renderStatusStore ?? notRendered, (state) => state.renderCount);

export const useCanvasFirstRenderComplete = (view: ViewCtx | undefined) =>
  useStore(view?.csEvaluator?.renderStatusStore ?? notRendered, (state) => state.isFirstRenderComplete);
