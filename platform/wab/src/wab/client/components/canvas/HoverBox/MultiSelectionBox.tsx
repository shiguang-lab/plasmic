import { useStore } from "zustand";
import { useViewSelection } from "@/wab/client/studio-ctx/selection-state";
import { useShallow } from "zustand/react/shallow";
import { useCanvasZoom } from "@/wab/client/studio-ctx/viewport-state";
import {
  getVisibleSelectionBounds,
  useSelectionBounds,
} from "@/wab/client/components/canvas/selection-bounds";
import { frameToScalerRect } from "@/wab/client/coords";
import { UiText } from "@/wab/client/i18n/UiText";
import { cssPropsForInvertTransform } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import React from "react";

export function MultiSelectionBox({
  viewCtx,
}: {
  viewCtx: ViewCtx;
}) {
  useViewSelection(viewCtx, useShallow((state) => [state.doms, state.targets]));
  const draggingObject = useStore(viewCtx.studioCtx.draggingObjectStore);
  const transformingObject = useStore(viewCtx.studioCtx.transformingObjectStore);
  const viewportZoom = useCanvasZoom(viewCtx.studioCtx);
  // `bounds` is the real union of the selection and drives the size badge;
  // the box itself is drawn on the visible part of that union.
  const bounds = useSelectionBounds(viewCtx);
  const visibleBounds = getVisibleSelectionBounds(viewCtx.focusedDomElts());
  if (
    !bounds ||
    !visibleBounds ||
    draggingObject ||
    transformingObject
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
        ...cssPropsForInvertTransform(viewportZoom, rect),
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
}
