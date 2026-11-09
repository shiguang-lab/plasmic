import { useStore } from "zustand";
import { useStudioSelection } from "@/wab/client/studio-ctx/selection-state";
import { useCanvasZoom } from "@/wab/client/studio-ctx/viewport-state";
import { useFrameSelectionBounds } from "@/wab/client/components/canvas/selection-bounds";
import { UiText } from "@/wab/client/i18n/UiText";
import {
  StudioCtx,
  cssPropsForInvertTransform,
} from "@/wab/client/studio-ctx/StudioCtx";
import React from "react";

export function FrameSelectionBox({
  studioCtx,
}: {
  studioCtx: StudioCtx;
}) {
  const frames = useStudioSelection(studioCtx, (state) => state.frames);
  const draggingObject = useStore(studioCtx.draggingObjectStore);
  const transformingObject = useStore(studioCtx.transformingObjectStore);
  const viewportZoom = useCanvasZoom(studioCtx);
  const bounds = useFrameSelectionBounds(studioCtx);
  if (
    !bounds ||
    draggingObject ||
    transformingObject
  ) {
    return null;
  }
  const rect = bounds.rect();
  return (
    <div
      className="canvas-editor__multi-selection"
      data-artboard-selection
      style={{
        top: rect.top,
        left: rect.left,
        ...cssPropsForInvertTransform(viewportZoom, rect),
      }}
    >
      <div className="canvas-editor__multi-selection-label">
        <UiText
          message="{count} artboards selected"
          values={{ count: frames.length }}
        />
      </div>
      <div className="canvas-editor__multi-selection-dimensions">
        {Math.round(bounds.width())} × {Math.round(bounds.height())}
      </div>
    </div>
  );
}
