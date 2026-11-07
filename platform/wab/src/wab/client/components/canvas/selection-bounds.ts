import { useActiveContentEditor } from "@/wab/client/studio-ctx/canvas-content-editor";
import { useFrameHeights } from "@/wab/client/studio-ctx/frame-heights";
import { useStudioSelection, useViewSelection } from "@/wab/client/studio-ctx/selection-state";
import { recomputeBounds } from "@/wab/client/components/canvas/HoverBox/recomputeBounds";
import { computeElementVisibility } from "@/wab/client/components/canvas/HoverBox/visible-bounds";
import { hasLayoutBox } from "@/wab/client/dom";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { useFrameForceUpdate } from "@/wab/client/useForceUpdate";
import { Box } from "@/wab/shared/geom";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { arrayEq, assert } from "@/wab/shared/common";
import { useViewportValue } from "@/wab/client/studio-ctx/viewport-state";
import { useShallow } from "zustand/react/shallow";
import { useStudioArena, useViewRegistry } from "@/wab/client/studio-ctx/arena-state";
import ResizeObserver from "resize-observer-polyfill";

/** Selection bounds in the artboard's CSS pixels, independent of Studio zoom. */
export function getSelectionBounds(doms: readonly (JQuery | null)[]): Box | undefined {
  return Box.mergeBBs(
    doms.flatMap((dom) =>
      dom?.toArray().some(hasLayoutBox) ? [recomputeBounds(dom).rect()] : [],
    ),
  );
}

/**
 * Union of the visible parts of the selection (after overflow and artboard
 * clipping), in the artboard's CSS pixels. Undefined when nothing is visible.
 * Use `getSelectionBounds` for sizes; this is only where to draw.
 */
export function getVisibleSelectionBounds(
  doms: readonly (JQuery | null)[],
): Box | undefined {
  return Box.mergeBBs(
    doms.flatMap((dom) => {
      if (!dom?.toArray().some(hasLayoutBox)) {
        return [];
      }
      const { visible } = computeElementVisibility(dom, recomputeBounds(dom));
      return visible ? [visible.rect()] : [];
    }),
  );
}

export function useSelectionBounds(viewCtx: ViewCtx) {
  useViewSelection(viewCtx, (state) => state.doms);
  const forceUpdate = useFrameForceUpdate();
  const doms = viewCtx.focusedDomElts();
  const body = viewCtx.canvasCtx.$userBody()?.[0];
  useEffect(() => {
    const doc = viewCtx.canvasCtx.doc();
    const resizeObserver = new ResizeObserver(forceUpdate);
    for (const dom of doms) {
      dom?.each((_index, elt) => resizeObserver.observe(elt));
    }
    const mutationObserver = new MutationObserver(forceUpdate);
    if (body) {
      mutationObserver.observe(body, {
        attributes: true,
        childList: true,
        subtree: true,
        characterData: true,
      });
    }
    doc.addEventListener("scroll", forceUpdate, true);
    viewCtx.studioCtx.styleChanged.add(forceUpdate);
    viewCtx.studioCtx.framesChanged.add(forceUpdate);
    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      doc.removeEventListener("scroll", forceUpdate, true);
      viewCtx.studioCtx.styleChanged.remove(forceUpdate);
      viewCtx.studioCtx.framesChanged.remove(forceUpdate);
    };
  }, [viewCtx, doms, body, forceUpdate]);
  return getSelectionBounds(doms);
}

/** Artboard selection bounds in Studio scaler coordinates. */
export function getFrameSelectionBounds(studioCtx: StudioCtx) {
  if (studioCtx.canvasContentEditor) {
    return undefined;
  }
  return Box.mergeBBs(
    studioCtx.focusedFrames().flatMap((frame) => {
      const rect = studioCtx.getArenaFrameScalerRect(frame);
      return rect ? [rect] : [];
    }),
  );
}

export function useFrameSelectionBounds(studioCtx: StudioCtx) {
  useActiveContentEditor(studioCtx);
  useStudioSelection(studioCtx, (state) => state.frames);
  useStudioArena(studioCtx, (state) => state.frames);
  const entries = useViewRegistry(studioCtx, (snapshot) => snapshot);
  const forceUpdate = useFrameForceUpdate();
  const frames = studioCtx.focusedFrames();
  useFrameHeights(studioCtx, frames);
  const roster = useRef<readonly (typeof frames)[number][]>(frames.slice());
  if (!arrayEq(roster.current, frames)) { roster.current = frames.slice(); }
  const stableFrames = roster.current;
  const geometry = useMemo(() => {
    const owner = studioCtx.arenaState, lifetime = owner.lifetime();
    const models = studioCtx.modelSnapshots;
    const members = owner.frameMembershipStore.getState();
    const sources = stableFrames.flatMap((frame) => {
      const member = members.find((ref) => ref.uid === frame.uid);
      assert(!lifetime.aborted && owner.isCurrentLifetime(lifetime) && member && models.resolve(member) === frame, "Cannot attach foreign selection geometry to the current model owner");
      return [
      models.field(frame, "left"),
      models.field(frame, "top"),
      models.field(frame, "width"),
    ]; });
    let current = Object.freeze(sources.map((source) => source.getState()));
    const read = () => {
      const next = sources.map((source) => source.getState());
      if (!arrayEq(current, next)) { current = Object.freeze(next); }
      return current;
    };
    return {
      read,
      subscribe: (notify: () => void) => {
        if (lifetime.aborted) { return () => undefined; }
        let closed = false;
        const changed = () => { if (!closed) { notify(); } };
        const stops = sources.map((source) => source.subscribe(changed));
        const stop = () => {
          if (closed) { return; }
          closed = true;
          stops.forEach((off) => off());
          lifetime.removeEventListener("abort", stop);
        };
        lifetime.addEventListener("abort", stop, { once: true });
        return stop;
      },
    };
  }, [studioCtx, stableFrames]);
  const dimensions = useSyncExternalStore(geometry.subscribe, geometry.read, geometry.read);
  const hasAutomaticLayout = stableFrames.some((_frame, index) => dimensions[index * 3] == null || dimensions[index * 3 + 1] == null);
  useViewportValue(studioCtx, useShallow((viewport) => hasAutomaticLayout ? {
    scale: viewport.scale, scroll: viewport.scroll,
    canvasPadding: viewport.canvasPadding, clipperBox: viewport.clipperBox,
  } : undefined));
  useEffect(() => {
    const observer = new ResizeObserver(forceUpdate);
    frames.forEach((frame) => {
      const element = studioCtx.arenaState.viewRegistry
        .selectFrame(entries, frame)
        ?.view.canvasCtx.viewportContainer();
      if (element) {
        observer.observe(element);
      }
    });
    const listener = studioCtx.framesChanged.add(forceUpdate);
    return () => {
      observer.disconnect();
      listener.detach();
    };
  }, [studioCtx, frames, entries, forceUpdate]);
  return getFrameSelectionBounds(studioCtx);
}
