import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ViewportSnapshot } from "@/wab/client/studio-ctx/ViewportCtx";
import { Box, Pt } from "@/wab/shared/geom";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { createStore } from "zustand/vanilla";

const emptyViewport = createStore<ViewportSnapshot>(() => ({
  scale: 1,
  scroll: Pt.zero(),
  clipperBox: Box.zero(),
  arenaScalerSize: Pt.zero(),
  arenaSize: Pt.zero(),
  canvasPadding: Pt.zero(),
  visibleScalerBox: Box.zero(),
  isTransforming: false,
  hasFrames: false,
  extraPadding: Pt.zero(),
}));

export function useViewportValue<Selected>(
  studio: StudioCtx,
  select: (state: ViewportSnapshot) => Selected,
) {
  const viewport = useStore(studio.viewportOwnerStore);
  return useStore(viewport?.store ?? emptyViewport, select);
}

export const useCanvasZoom = (studio: StudioCtx) =>
  useViewportValue(studio, (state) => state.scale);
export const useCanvasTransforming = (studio: StudioCtx) =>
  useViewportValue(studio, (state) => state.isTransforming);
export const useCanvasGeometry = (studio: StudioCtx) =>
  useViewportValue(
    studio,
    useShallow((state) => ({
      scale: state.scale,
      scroll: state.scroll,
      canvasPadding: state.canvasPadding,
      clipperBox: state.clipperBox,
    })),
  );

/** Bind a narrow imperative subscriber to the current viewport's lifetime. */
export function subscribeViewport<Selected>(
  studio: StudioCtx,
  select: (state: ViewportSnapshot) => Selected,
  listener: (next: Selected, previous: Selected) => void,
) {
  const read = () =>
    select(studio.viewportCtx?.store.getState() ?? emptyViewport.getState());
  let previous = read();
  const update = () => {
    const next = read();
    if (!Object.is(next, previous)) {
      const before = previous;
      previous = next;
      listener(next, before);
    }
  };
  let stopViewport = studio.viewportCtx?.store.subscribe(update);
  const stopOwner = studio.viewportOwnerStore.subscribe((viewport) => {
    stopViewport?.();
    stopViewport = viewport?.store.subscribe(update);
    update();
  });
  return () => {
    stopViewport?.();
    stopOwner();
  };
}
