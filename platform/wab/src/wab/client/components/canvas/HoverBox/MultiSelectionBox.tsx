import {
  getVisibleSelectionBounds,
  useSelectionBounds,
} from "@/wab/client/components/canvas/selection-bounds";
import { frameToScalerRect } from "@/wab/client/coords";
import { UiText } from "@/wab/client/i18n/UiText";
import { cssPropsForInvertTransform } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { observer } from "mobx-react";
import React from "react";

export const MultiSelectionBox = observer(function MultiSelectionBox({
  viewCtx,
}: {
  viewCtx: ViewCtx;
}) {
  // `bounds` is the real union of the selection and drives the size badge;
  // the box itself is drawn on the visible part of that union.
  const bounds = useSelectionBounds(viewCtx);
  const visibleBounds = getVisibleSelectionBounds(viewCtx.focusedDomElts());
  if (
    !bounds ||
    !visibleBounds ||
    viewCtx.studioCtx.isDraggingObject() ||
    viewCtx.studioCtx.isTransformingObject()
  ) {
    return null;
  }
  const rect = frameToScalerRect(visibleBounds.rect(), viewCtx);
  return (
    <div
      className="canvas-editor__multi-selection"
      style={{
        top: rect.top,
        left: rect.left,
        ...cssPropsForInvertTransform(viewCtx.studioCtx.zoom, rect),
      }}
    >
      <div className="canvas-editor__multi-selection-label">
        <UiText
          message="{count} layers selected"
          values={{ count: viewCtx.focusedSelectables().length }}
        />
      </div>
      <div className="canvas-editor__multi-selection-dimensions">
        {Math.round(bounds.width())} × {Math.round(bounds.height())}
      </div>
    </div>
  );
});
