import { recomputeBounds } from "@/wab/client/components/canvas/HoverBox/recomputeBounds";
import { hasLayoutBox } from "@/wab/client/dom";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { useForceUpdate } from "@/wab/client/useForceUpdate";
import { Box } from "@/wab/shared/geom";
import { useEffect } from "react";
import ResizeObserver from "resize-observer-polyfill";

/** Selection bounds in the artboard's CSS pixels, independent of Studio zoom. */
export function getSelectionBounds(doms: (JQuery | null)[]): Box | undefined {
  return Box.mergeBBs(
    doms.flatMap((dom) =>
      dom?.toArray().some(hasLayoutBox) ? [recomputeBounds(dom).rect()] : [],
    ),
  );
}

export function useSelectionBounds(viewCtx: ViewCtx) {
  const forceUpdate = useForceUpdate();
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
  return Box.mergeBBs(
    studioCtx.focusedFrames().flatMap((frame) => {
      const rect = studioCtx.getArenaFrameScalerRect(frame);
      return rect ? [rect] : [];
    }),
  );
}

export function useFrameSelectionBounds(studioCtx: StudioCtx) {
  const forceUpdate = useForceUpdate();
  const frames = studioCtx.focusedFrames();
  useEffect(() => {
    const observer = new ResizeObserver(forceUpdate);
    frames.forEach((frame) => {
      const element = studioCtx
        .tryGetViewCtxForFrame(frame)
        ?.canvasCtx.viewportContainer();
      if (element) {
        observer.observe(element);
      }
    });
    const listener = studioCtx.framesChanged.add(forceUpdate);
    return () => {
      observer.disconnect();
      listener.detach();
    };
  }, [studioCtx, frames, forceUpdate]);
  return getFrameSelectionBounds(studioCtx);
}
