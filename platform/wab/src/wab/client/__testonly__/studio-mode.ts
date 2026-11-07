import type { PreviewCtx, PreviewState } from "@/wab/client/components/live/PreviewCtx";
import { mock } from "vitest-mock-extended";
import { createStore } from "zustand/vanilla";

export function createStudioModeFixture(isLive = false) {
  const preview = mock<PreviewCtx>();
  Object.defineProperty(preview, "store", { value: createStore<PreviewState>(() => ({
    previewData: undefined, isLive, navigationEntries: [], navigationIndex: -1,
    navigating: false, refreshKey: 0, targets: [], hasVariants: false,
  })) });
  return { previewOwnerStore: createStore<PreviewCtx | undefined>(() => preview) };
}
