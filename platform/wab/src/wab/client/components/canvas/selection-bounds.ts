import { useActiveContentEditor } from "@/wab/client/studio-ctx/canvas-content-editor";
import { useStudioSelection, useViewSelection } from "@/wab/client/studio-ctx/selection-state";
import { recomputeBounds } from "@/wab/client/components/canvas/HoverBox/recomputeBounds";
import { computeElementVisibility } from "@/wab/client/components/canvas/HoverBox/visible-bounds";
import { hasLayoutBox } from "@/wab/client/dom";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { useFrameForceUpdate } from "@/wab/client/useForceUpdate";
import { Box } from "@/wab/shared/geom";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { assert } from "@/wab/shared/common";
import { subscribeViewport } from "@/wab/client/studio-ctx/viewport-state";
import { useShallow } from "zustand/react/shallow";
import { useStudioArena } from "@/wab/client/studio-ctx/arena-state";
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
  const editor = useActiveContentEditor(studioCtx);
  const members = useStudioArena(studioCtx, (state) => state.frames);
  const frames = useStudioSelection(studioCtx, useShallow((state) => state.frames.filter((ref) => members.includes(ref)).map((ref) => studioCtx.modelSnapshots.resolve(ref))));
  const source = useMemo(() => createFrameSelectionBoundsSource(studioCtx, frames), [studioCtx, frames]);
  const bounds = useSyncExternalStore(source.subscribe, source.read, source.read);
  return editor ? undefined : bounds;
}

/** The projection owns model geometry, measurements and automatic-layout DOM
 * bounds. React receives one stable Box, rather than a discarded invalidation. */
function createFrameSelectionBoundsSource(studio: StudioCtx, frames: readonly import("@/wab/shared/model/classes").ArenaFrame[]) {
  const owner = studio.arenaState, lifetime = owner.lifetime(), models = studio.modelSnapshots;
  const members = owner.frameMembershipStore.getState();
  const inputs = frames.map((frame) => {
    const member = members.find((ref) => ref.uid === frame.uid);
    assert(!lifetime.aborted && owner.isCurrentLifetime(lifetime) && member && models.resolve(member) === frame, "Cannot attach foreign selection geometry to the current model owner");
    return { frame, left: models.field(frame, "left"), top: models.field(frame, "top"), width: models.field(frame, "width"), height: studio.frameHeights.frameStore(frame) };
  });
  let current: Box | undefined;
  const active = () => !lifetime.aborted && owner.isCurrentLifetime(lifetime) && models === studio.modelSnapshots;
  const read = () => {
    if (!active()) { current = undefined; return current; }
    const next = Box.mergeBBs(inputs.flatMap((input) => {
      const left = input.left.getState(), top = input.top.getState();
      const rect = left != null && top != null
        ? { left, top, width: input.width.getState(), height: input.height.getState() }
        : studio.getArenaFrameScalerRect(input.frame);
      return rect ? [rect] : [];
    }));
    if (!current || !next || current.left() !== next.left() || current.top() !== next.top() || current.width() !== next.width() || current.height() !== next.height()) { current = next; }
    return current;
  };
  return {
    read,
    subscribe: (notify: () => void) => {
      if (!active()) { return () => undefined; }
      let previous = read(), closed = false;
      const changed = () => { if (closed) { return; } const next = read(); if (next !== previous) { previous = next; notify(); } };
      const sources = inputs.flatMap((input) => [input.left, input.top, input.width, input.height]);
      const stops = sources.map((source) => source.subscribe(changed));
      const stopViewport = subscribeViewport(studio, (state) => state, changed);
      const observer = new ResizeObserver(changed);
      const observe = () => { observer.disconnect(); for (const { frame } of inputs) { const element = studio.arenaState.viewRegistry.forFrame(frame)?.view.canvasCtx.viewportContainer(); if (element) { observer.observe(element); } } };
      observe();
      const stopRegistry = studio.arenaState.viewRegistry.store.subscribe(() => { observe(); changed(); });
      const framesChanged = studio.framesChanged.add(changed);
      const retire = () => { changed(); stop(); };
      const stop = () => { if (closed) { return; } closed = true; stops.forEach((off) => off()); stopViewport(); stopRegistry(); observer.disconnect(); framesChanged.detach(); lifetime.removeEventListener("abort", retire); };
      lifetime.addEventListener("abort", retire, { once: true });
      return stop;
    },
  };
}
