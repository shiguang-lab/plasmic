import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import React from "react";

/** Keep canvas labels away from text and controls; crowded labels let clicks pass through. */
export function useTagPlacement(
  tagRef: React.RefObject<HTMLElement>,
  width: number,
  zoom: number,
  viewCtx?: ViewCtx,
) {
  const [placement, setPlacement] = React.useState<React.CSSProperties>({});
  React.useLayoutEffect(() => {
    const tag = tagRef.current;
    const parent = tag?.parentElement?.parentElement;
    if (!tag || !parent || !viewCtx) {
      return;
    }
    const bounds = parent.getBoundingClientRect();
    const iframe = viewCtx.canvasCtx.viewport();
    const frameBounds = iframe.getBoundingClientRect();
    const scale = frameBounds.width / iframe.clientWidth;
    if (!Number.isFinite(scale) || scale <= 0) {
      setPlacement((current) =>
        current.visibility === "hidden" && current.pointerEvents === "none"
          ? current
          : { visibility: "hidden", pointerEvents: "none" },
      );
      return;
    }
    const doc = viewCtx.canvasCtx.doc();
    const canvasBounds = viewCtx.viewportCtx.clipperBox();
    const w = tag.offsetWidth;
    const h = tag.offsetHeight + 5;
    const left = Math.min(0, width * zoom - w);
    const candidates = [
      { left, top: -h },
      { left, top: bounds.height + 5 },
      { left: bounds.width + 5, top: 0 },
      { left: -w - 5, top: 0 },
    ];
    const collides = (candidate: { left: number; top: number }) => {
      const x = bounds.left + candidate.left;
      const y = bounds.top + candidate.top;
      if (
        x < canvasBounds.left() ||
        y < canvasBounds.top() ||
        x + w > canvasBounds.right() ||
        y + h > canvasBounds.bottom()
      ) {
        return true;
      }
      return [0.1, 0.5, 0.9].some((dx) =>
        [0.2, 0.8].some((dy) => {
          const px = (x + w * dx - frameBounds.left) / scale;
          const py = (y + h * dy - frameBounds.top) / scale;
          const element = viewCtx.canvasCtx.getActualTargetUnderCanvasOverlay(
            px,
            py,
          );
          return (
            !!element &&
            (!!element.closest(
              'button,a,input,select,textarea,[role="tab"],[role="button"]',
            ) ||
              [...element.childNodes].some((node) => {
                if (
                  node.nodeType !== Node.TEXT_NODE ||
                  !node.textContent?.trim()
                ) {
                  return false;
                }
                const range = doc.createRange();
                range.selectNodeContents(node);
                return [...range.getClientRects()].some(
                  (rect) =>
                    px >= rect.left &&
                    px <= rect.right &&
                    py >= rect.top &&
                    py <= rect.bottom,
                );
              }))
          );
        }),
      );
    };
    const safe = candidates.find((candidate) => !collides(candidate));
    const next: React.CSSProperties = {
      ...(safe ?? candidates[0]),
      transform: "none",
      pointerEvents: safe ? "auto" : "none",
      visibility: safe ? "visible" : "hidden",
    };
    setPlacement((current) =>
      JSON.stringify(current) === JSON.stringify(next) ? current : next,
    );
  });
  return placement;
}
