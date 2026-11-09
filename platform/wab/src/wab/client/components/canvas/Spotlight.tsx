import { useViewVariants } from "@/wab/client/studio-ctx/variant-state";
import { useStudioLiveMode } from "@/wab/client/studio-ctx/studio-mode-state";
import { useCanvasGeometry } from "@/wab/client/studio-ctx/viewport-state";
import {
  clipBox,
  computeClipBounds,
  getVisibleFrameRect,
} from "@/wab/client/components/canvas/HoverBox/visible-bounds";
import { frameToScalerRect } from "@/wab/client/coords";
import { hasLayoutBox } from "@/wab/client/dom";
import { UiText } from "@/wab/client/i18n/UiText";
import { adjustSpotLightDueToZoom } from "@/wab/client/studio-ctx/StudioCtx";
import { ComponentCtx } from "@/wab/client/studio-ctx/component-ctx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { swallowClick } from "@/wab/commons/components/ReactUtil";
import { getTplSlots } from "@/wab/shared/SlotUtils";
import * as common from "@/wab/shared/common";
import { maybe, swallow, withoutNils } from "@/wab/shared/common";
import { SlotSelection } from "@/wab/shared/core/slots";
import { Box } from "@/wab/shared/geom";
import { Switch } from "antd";
import $ from "jquery";
import { useCanvasRenderCount } from "@/wab/client/hooks/useCanvasRenderStatus";
import { useCanvasViewInputs } from "@/wab/client/components/canvas/canvas-view-inputs";
import { canvasSlotFields } from "@/wab/client/components/canvas/canvas-slot-inputs";
import { useViewSelection } from "@/wab/client/studio-ctx/selection-state";
import { useFrameForceUpdate } from "@/wab/client/useForceUpdate";
import { useShallow } from "zustand/react/shallow";
import * as React from "react";

export const Spotlight = React.memo(Spotlight_);

function Spotlight_(props: { viewCtx: ViewCtx }) {
  const { viewCtx } = props;
  useViewVariants(viewCtx, (variantState) => variantState.showDefaultSlots);
  useStudioLiveMode(viewCtx.studioCtx);
  const selection = useViewSelection(viewCtx, useShallow((state) => [state.context, state.doms]));
  const renderCount = useCanvasRenderCount(viewCtx);
  const recipe = React.useCallback((field: Parameters<typeof canvasSlotFields>[1]) => canvasSlotFields(viewCtx.currentComponentCtx()?.tplComponent().component, field), [viewCtx, selection]);
  const { alive } = useCanvasViewInputs(viewCtx, recipe);
  const refresh = useFrameForceUpdate(viewCtx.disposeSignal);
  const { scale: viewportZoom } = useCanvasGeometry(viewCtx.studioCtx);
  const showDefaultSlotContents = viewCtx.showDefaultSlotContents();
  const { tplComponent, valComponent, shouldRender } =
    alive ? getSpotlightInfo(viewCtx) : { tplComponent: undefined, valComponent: undefined, shouldRender: false };

  const userBody = alive ? viewCtx.canvasCtx.$userBody()[0] : undefined;
  const rootRef = React.useRef<HTMLDivElement>(null);
  const spotlightDomInfo = alive && shouldRender ? getSpotlightDomInfo(viewCtx) : null;
  const measuredElements = useShallow((elements: Element[]) => elements)(spotlightDomInfo?.focusedElements ?? []);

  React.useEffect(() => {
    if (!userBody) {
      return;
    }
    // Whenever content inside the frame changes, to be safe, we re-render,
    // in case the DOM size has changed
    const mutationObserver = new MutationObserver(() => {
      refresh();
    });
    mutationObserver.observe(userBody, { childList: true, subtree: true });
    return () => mutationObserver.disconnect();
  }, [userBody, viewCtx, refresh]);

  React.useEffect(() => {
    // Re-render spotlight mode whenever styles change, as DOM size
    // may change as a result
    if (!alive) { return; }
    const listener = viewCtx.styleChanged.add(refresh);
    return () => {
      listener.detach();
    };
  }, [viewCtx, alive, refresh]);

  React.useEffect(() => {
    if (alive && !shouldRender && showDefaultSlotContents) {
      viewCtx.setShowDefaultSlotContents(false);
    }
  }, [alive, shouldRender, showDefaultSlotContents, viewCtx]);

  React.useEffect(() => {
    adjustSpotLightDueToZoom(viewportZoom);
  });

  React.useEffect(() => {
    if (!alive || !shouldRender || !userBody) { return; }
    const resize = new ResizeObserver(refresh);
    resize.observe(userBody);
    measuredElements.forEach((element) => resize.observe(element));
    resize.observe(userBody.ownerDocument.documentElement);
    const doc = userBody.ownerDocument;
    doc.addEventListener("scroll", refresh, true);
    const frames = viewCtx.studioCtx.framesChanged.add(refresh);
    return () => { resize.disconnect(); doc.removeEventListener("scroll", refresh, true); frames.detach(); };
  }, [alive, shouldRender, userBody, viewCtx, refresh, selection, renderCount, measuredElements]);

  if (!shouldRender || !spotlightDomInfo) {
    return null;
  }

  const { focusedElements, focusedScalerRect } = spotlightDomInfo;

  const tplSlots = getTplSlots(tplComponent!.component);

  return (
    <div
      className="component-ctx-spotlight"
      ref={rootRef}
      style={{
        display: "initial",
        ...(focusedScalerRect && {
          top: focusedScalerRect.top,
          left: focusedScalerRect.left,
          width: focusedScalerRect.width,
          height: focusedScalerRect.height,
        }),
      }}
    >
      <div className="component-ctx-spotlight__shadow" />
      {tplSlots.length > 0 && focusedElements && (
        <div
          className="component-ctx-spotlight__controls"
          onClick={swallowClick}
        >
          <Switch
            size="small"
            checked={showDefaultSlotContents}
            onClick={() =>
              viewCtx.setShowDefaultSlotContents(!showDefaultSlotContents)
            }
          />{" "}
          <UiText message={"Show default slot contents"} />
        </div>
      )}
      {/* Show slot shadows if we are not showing default contents, as we cannot actually
      edit the content of the slot in master component mode */}
      {tplSlots && !showDefaultSlotContents && focusedScalerRect && (
        <div className="component-ctx-spotlight__slots">
          {tplSlots.map((s) => {
            const valDoms =
              swallow(() =>
                common
                  .ensureArray(
                    viewCtx.renderState.sel2dom(
                      new SlotSelection({
                        slotParam: s.param,
                        val: valComponent,
                      }),
                      viewCtx.canvasCtx,
                    ) || [],
                  )
                  .filter((x) => !!x && x.tagName !== "STYLE"),
              ) || [];
            if (valDoms.length === 0) {
              return null;
            }
            // Shade only the visible part of each slot, like other overlays;
            // a slot that is entirely clipped gets no shadow.
            // Boxless doms (`display: contents`) report a 0×0 rect at the
            // origin, which would stretch the shadow to the artboard corner.
            const visibleParts = withoutNils(
              valDoms
                .filter(hasLayoutBox)
                .map((d) =>
                  clipBox(
                    Box.fromRect(d.getBoundingClientRect()),
                    computeClipBounds(d),
                  ),
                ),
            );
            const valRect = Box.mergeBBs(
              visibleParts.map((box) => box.rect()),
            )?.rect();
            if (!valRect) {
              return null;
            }
            const valScalerRect = frameToScalerRect(valRect, viewCtx);
            return (
              <div
                key={s.uid}
                className={`component-ctx-spotlight__slots__slot`}
                style={{
                  top: valScalerRect.top - focusedScalerRect!.top,
                  left: valScalerRect.left - focusedScalerRect!.left,
                  width: valScalerRect.width,
                  height: valScalerRect.height,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export function getSpotlightDomInfo(viewCtx: ViewCtx) {
  const valComponent = maybe(viewCtx.currentComponentCtx(), (x: ComponentCtx) =>
    x.valComponent(),
  );
  const $focused = valComponent
    ? maybe(
        viewCtx.renderState.sel2dom(valComponent, viewCtx.canvasCtx),
        (doms) => $(doms),
      )
    : undefined;

  const focusedElements =
    $focused && $focused.get().some(hasLayoutBox)
      ? $focused.get().filter(hasLayoutBox)
      : undefined;

  // The spotlight (and the controls below it and the variants bar above it)
  // follows the visible part of the component, like the selection outline.
  // Slot shadows are positioned relative to this rect from their own visible
  // parts.
  const focusedFrameRect =
    focusedElements && getVisibleFrameRect(focusedElements).rect();
  const focusedScalerRect =
    focusedFrameRect && frameToScalerRect(focusedFrameRect, viewCtx);

  return {
    focusedElements,
    focusedScalerRect,
  };
}

export function getSpotlightInfo(viewCtx: ViewCtx) {
  const tplComponent = maybe(viewCtx.currentComponentCtx(), (x: ComponentCtx) =>
    x.tplComponent(),
  );
  const valComponent = maybe(viewCtx.currentComponentCtx(), (x: ComponentCtx) =>
    x.valComponent(),
  );
  const shouldRender =
    tplComponent && valComponent && !viewCtx.studioCtx.isLiveMode;

  return {
    tplComponent,
    valComponent,
    shouldRender,
  };
}
