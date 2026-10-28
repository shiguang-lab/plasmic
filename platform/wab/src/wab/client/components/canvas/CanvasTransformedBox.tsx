import { recomputeBounds } from "@/wab/client/components/canvas/HoverBox";
import { computeElementVisibility } from "@/wab/client/components/canvas/HoverBox/visible-bounds";
import { frameToScalerRect } from "@/wab/client/coords";
import { useElementHasLayout } from "@/wab/client/dom-utils";
import { cssPropsForInvertTransform } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { unexpected } from "@/wab/shared/common";
import $ from "jquery";
import { omit } from "lodash";
import { observer } from "mobx-react";
import * as React from "react";
import { ReactNode } from "react";

export const CanvasTransformedBox = observer(function CanvasTransformedBox({
  relativeTo,
  $elt,
  viewCtx,
  className,
  style,
  children,
  keepDims,
  clipToVisible,
}: {
  relativeTo: "arena" | "frame";
  $elt: JQuery<HTMLElement>;
  viewCtx: ViewCtx;
  className?: string;
  style?: React.CSSProperties;
  children?: ReactNode;
  keepDims?: boolean;
  /**
   * Draw only the part of the element that is visible after overflow and
   * artboard clipping, and nothing when it is fully clipped. For outlines and
   * highlights; anchors that must follow the real element should not set it.
   */
  clipToVisible?: boolean;
}) {
  const element = useElementHasLayout($elt.length > 0 ? $elt[0] : null);
  if (!element) {
    return null;
  }

  const $element = $(element);
  const geometry = recomputeBounds($element);
  const frameRect = clipToVisible
    ? computeElementVisibility($element, geometry).visible?.rect()
    : geometry.rect();
  const scalerRect = !frameRect
    ? undefined
    : relativeTo === "arena"
      ? frameToScalerRect(frameRect, viewCtx)
      : relativeTo === "frame"
        ? frameRect
        : unexpected();
  if (!scalerRect) {
    return null;
  }
  const cssProps = cssPropsForInvertTransform(
    viewCtx.studioCtx.zoom,
    scalerRect,
  );
  const cssPropsForJqElt = {
    ...scalerRect,
    ...cssProps,
  };

  return (
    <div
      className={"CanvasTransformedBox " + className}
      data-original-width={scalerRect.width}
      data-original-height={scalerRect.height}
      style={omit(
        {
          ...cssPropsForJqElt,
          ...style,
        },
        keepDims ? ["width", "height", "transform"] : [],
      )}
    >
      {children}
    </div>
  );
});
