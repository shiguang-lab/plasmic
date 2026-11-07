import { ViewportCtx } from "@/wab/client/studio-ctx/ViewportCtx";
import { Box, Pt } from "@/wab/shared/geom";
import { afterEach } from "vitest";
import { createStore } from "zustand/vanilla";

const viewports = new Set<ViewportCtx>();
afterEach(() => {
  viewports.forEach((viewport) => viewport.dispose());
  viewports.clear();
});

/** Real geometry and ownership stores for UI fixtures with partial Studio mocks. */
export function createViewportFixture(scale = 1) {
  const viewport = new ViewportCtx({
    dom: {
      updateCanvasPadding: () => undefined,
      updateArenaSize: () => undefined,
      scaleTo: () => undefined,
      scrollTo: () => undefined,
      scrollBy: () => undefined,
    },
    initialArena: null,
    initialClipperBox: new Box(0, 0, 1000, 800),
    initialClipperScroll: Pt.zero(),
  });
  viewports.add(viewport);
  if (scale !== 1) {
    viewport.enqueueTransform(scale, Pt.zero(), false);
  }
  const viewportOwnerStore = createStore<ViewportCtx | null>(() => viewport);
  return {
    get viewportCtx() {
      return viewportOwnerStore.getState();
    },
    set viewportCtx(value: ViewportCtx | null) {
      viewportOwnerStore.setState(value, true);
    },
    viewportOwnerStore,
  };
}
