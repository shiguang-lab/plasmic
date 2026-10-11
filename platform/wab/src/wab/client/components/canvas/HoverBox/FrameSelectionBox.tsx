import { useFrameSelectionBounds } from "@/wab/client/components/canvas/selection-bounds";
import { UiText } from "@/wab/client/i18n/UiText";
import {
  StudioCtx,
  cssPropsForInvertTransform,
} from "@/wab/client/studio-ctx/StudioCtx";
import { observer } from "mobx-react";
import React from "react";

export const FrameSelectionBox = observer(function FrameSelectionBox({
  studioCtx,
}: {
  studioCtx: StudioCtx;
}) {
  const bounds = useFrameSelectionBounds(studioCtx);
  if (
    !bounds ||
    studioCtx.isDraggingObject() ||
    studioCtx.isTransformingObject()
  ) {
    return null;
  }
  const frames = studioCtx.focusedFrames();
  const rect = bounds.rect();
  return (
    <div
      className="canvas-editor__multi-selection"
      data-artboard-selection
      style={{
        top: rect.top,
        left: rect.left,
        ...cssPropsForInvertTransform(studioCtx.zoom, rect),
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
});
