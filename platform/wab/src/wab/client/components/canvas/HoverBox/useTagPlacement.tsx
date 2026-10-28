import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { Box } from "@/wab/shared/geom";
import React from "react";

/** Keep canvas labels away from text and controls; crowded labels let clicks pass through. */
export function useTagPlacement(
  tagRef: React.RefObject<HTMLElement>,
  width: number,
  zoom: number,
  viewCtx?: ViewCtx,
) {
  const [placement, setPlacement] = React.useState<React.CSSProperties>({
    visibility: "hidden",
    pointerEvents: "none",
  });
  // Measure the current label before paint so a new node never uses the previous
  // node's placement for a frame.
  React.useLayoutEffect(() => {
    const tag = tagRef.current;
    const container = tag?.parentElement;
    const parent = container?.parentElement;
    if (!tag || !container || !parent || !viewCtx) {
      return;
    }
    const toolbarSelector =
      "[data-content-editor-mode], [data-content-editor-entry]";
    const overlay =
      tag.closest(".canvas-editor__canvas-container") ?? tag.ownerDocument.body;
    const mutations = new MutationObserver(() => measure());
    const resize = new ResizeObserver(() => measure());
    const measure = () => {
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
      const toolbars = Array.from(
        overlay.querySelectorAll<HTMLElement>(toolbarSelector),
      ).filter((element) => {
        const css =
          element.ownerDocument.defaultView?.getComputedStyle(element);
        return css?.visibility !== "hidden" && css?.display !== "none";
      });
      toolbars.forEach((element) => {
        mutations.observe(element, {
          attributes: true,
          attributeFilter: ["style", "class"],
        });
        resize.observe(element);
      });
      const toolbarBounds = toolbars
        .map((element) => element.getBoundingClientRect())
        .filter((rect) => rect.width > 0 && rect.height > 0);
      const padding = toolbarBounds.length
        ? viewCtx.studioCtx.canvasZoomPadding()
        : undefined;
      const safeBounds = {
        left: canvasBounds.left() + (padding?.left ?? 0),
        right: canvasBounds.right() - (padding?.right ?? 0),
        top: canvasBounds.top() + (padding ? 60 : 0),
        bottom: canvasBounds.bottom() - (padding?.bottom ?? 0),
      };
      const w = tag.offsetWidth;
      const h = tag.offsetHeight + 5;
      const left = Math.min(0, width * zoom - w);
      const labelBox = container.getBoundingClientRect();
      const treeBounds = toolbarBounds.length
        ? Array.from(
            container.querySelectorAll<HTMLElement>("[data-canvas-node-tree]"),
          )
            .map((element) => {
              resize.observe(element);
              return element.getBoundingClientRect();
            })
            .filter((rect) => rect.width > 0 && rect.height > 0)
        : [];
      const group = {
        left: Math.min(
          0,
          ...treeBounds.map((rect) => rect.left - labelBox.left),
        ),
        right: Math.max(
          w,
          ...treeBounds.map((rect) => rect.right - labelBox.left),
        ),
        top: Math.min(0, ...treeBounds.map((rect) => rect.top - labelBox.top)),
        bottom: Math.max(
          h,
          ...treeBounds.map((rect) => rect.bottom - labelBox.top),
        ),
      };
      const candidates = toolbarBounds.length
        ? [
            { left, top: -h },
            // Keep the label horizontally associated with its node. When the
            // content toolbar overlaps it, stack the label above the toolbar.
            ...toolbarBounds.map((rect) => ({
              left: Math.max(
                safeBounds.left - bounds.left - group.left,
                Math.min(left, safeBounds.right - bounds.left - group.right),
              ),
              top: rect.top - bounds.top - group.bottom - 8,
            })),
          ]
        : [
            { left, top: -h },
            { left, top: bounds.height + 5 },
            { left: bounds.width + 5, top: 0 },
            { left: -w - 5, top: 0 },
          ];
      const collides = (candidate: { left: number; top: number }) => {
        const x = bounds.left + candidate.left;
        const y = bounds.top + candidate.top;
        if (
          x + group.left < safeBounds.left ||
          y + group.top < safeBounds.top ||
          x + group.right > safeBounds.right ||
          y + group.bottom > safeBounds.bottom ||
          toolbarBounds.some((rect) =>
            Box.fromRect({
              left: x + group.left,
              top: y + group.top,
              width: group.right - group.left,
              height: group.bottom - group.top,
            }).intersects(
              Box.fromRect({
                left: rect.left - 4,
                top: rect.top - 4,
                width: rect.width + 8,
                height: rect.height + 8,
              }),
            ),
          )
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
    };
    measure();
    mutations.observe(overlay, { childList: true });
    mutations.observe(container, { childList: true, subtree: true });
    resize.observe(tag);
    resize.observe(overlay);
    return () => {
      mutations.disconnect();
      resize.disconnect();
    };
  });
  return placement;
}
