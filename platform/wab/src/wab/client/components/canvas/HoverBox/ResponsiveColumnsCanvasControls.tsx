import { useViewVariants } from "@/wab/client/studio-ctx/variant-state";
import { useViewSelection } from "@/wab/client/studio-ctx/selection-state";
import { useShallow } from "zustand/react/shallow";
import { useCanvasZoom } from "@/wab/client/studio-ctx/viewport-state";
import { ColumnSizeControlDraggables } from "@/wab/client/components/sidebar-tabs/ResponsiveColumns/ColumnsSizeControls";
import { shouldBeDisabled } from "@/wab/client/components/sidebar/sidebar-helpers";
import { getContentOnlyRect } from "@/wab/client/dom";
import { getElementBounds } from "@/wab/client/dom-utils";
import { reportError } from "@/wab/client/ErrorNotifications";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { useFrameForceUpdate } from "@/wab/client/useForceUpdate";
import { useSignalListener } from "@/wab/commons/components/use-signal-listener";
import { ensure, NullOrUndefinedValueError } from "@/wab/shared/common";
import { isTplColumns, TplColumnsTag } from "@/wab/shared/core/tpls";
import { computeDefinedIndicator } from "@/wab/shared/defined-indicator";
import { useCanvasRenderCount } from "@/wab/client/hooks/useCanvasRenderStatus";
import { useCanvasViewInputs, type CanvasViewFieldRecipe } from "@/wab/client/components/canvas/canvas-view-inputs";
import { canvasVariantChromeFields, canvasVariantFrameFields } from "@/wab/client/components/canvas/canvas-variant-chrome-inputs";
import * as React from "react";

export const ResponsiveColumnsCanvasControls = React.memo(
  function ResponsiveColumnsCanvasControls(props: {
    viewCtx: ViewCtx;
    tpl: TplColumnsTag;
  }) {
    const { viewCtx, tpl } = props;
  useViewVariants(viewCtx, useShallow((variantState) => [variantState.frames, variantState.global]));
  useViewSelection(viewCtx, useShallow((state) => [state.context, state.doms]));
    const zoom = useCanvasZoom(viewCtx.studioCtx);
    const [dragState, setDragState] = React.useState<
      | {
          index: number;
          cols: number[];
        }
      | undefined
    >(undefined);

    const renderCount = useCanvasRenderCount(viewCtx);
    const recipe = React.useCallback<CanvasViewFieldRecipe>((field) => {
      canvasVariantChromeFields(viewCtx.site, viewCtx.currentComponent(), tpl, field);
      canvasVariantFrameFields(viewCtx, field);
      field(tpl, "type", "vsettings");
      tpl.vsettings.forEach((setting) => {
        field(setting, "variants", "columnsConfig");
        if (setting.columnsConfig) { field(setting.columnsConfig, "colsSizes", "breakUpRows"); }
      });
    }, [viewCtx, tpl]);
    const { alive } = useCanvasViewInputs(viewCtx, recipe);
    const forceUpdate = useFrameForceUpdate(viewCtx.disposeSignal);
    const elt = alive ? viewCtx.focusedDomElt() : undefined;
    const elements = useShallow((nodes: Element[]) => nodes)(elt?.toArray() ?? []);
    React.useEffect(() => {
      if (!alive || !elements.length) { return; }
      const doc = elements[0].ownerDocument;
      const resize = new ResizeObserver(forceUpdate);
      elements.forEach((element) => resize.observe(element));
      resize.observe(doc.documentElement);
      doc.addEventListener("scroll", forceUpdate, true);
      const frames = viewCtx.studioCtx.framesChanged.add(forceUpdate);
      return () => { resize.disconnect(); doc.removeEventListener("scroll", forceUpdate, true); frames.detach(); };
    }, [alive, elements, forceUpdate, viewCtx, renderCount]);

    const studioCtx = viewCtx.studioCtx;
    useSignalListener(studioCtx.styleChanged, forceUpdate, [studioCtx]);
    if (!alive) { return null; }
    const effectiveVs = viewCtx.effectiveCurrentVariantSetting(tpl);
    const columnsConfig = effectiveVs.columnsConfig;

    if (!columnsConfig) {
      reportError(
        new NullOrUndefinedValueError(
          "[rc] - columnsConfig expected to be truthy",
        ),
      );
      return null;
    }

    if (!isTplColumns(tpl)) {
      return null;
    }

    const rect = getElementBounds(ensure(elt));
    const contentRect = getContentOnlyRect(ensure(elt), {
      origin: {
        top: 0,
        left: 0,
      },
    });

    const definedIndicator = computeDefinedIndicator(
      studioCtx.site,
      viewCtx.currentComponent(),
      effectiveVs.getColumnsConfigSource(),
      viewCtx.variantTplMgr().getTargetIndicatorComboForNode(tpl),
    );

    const { isDisabled } = shouldBeDisabled({
      props: {},
      indicators: [definedIndicator],
    });

    if (isDisabled) {
      return null;
    }

    return (
      <div
        style={{
          position: "absolute",
          top: 0,
          left: contentRect.left * zoom,
          width: contentRect.width * zoom,
          height: rect.height * zoom,
          zIndex: -1,
          cursor: dragState ? "ew-resize" : undefined,
        }}
      >
        <ColumnSizeControlDraggables
          tpl={tpl}
          viewCtx={viewCtx}
          sizes={columnsConfig.colsSizes}
          dragState={dragState}
          zoom={zoom}
          isCanvas={true}
          width={rect.width}
          setDragState={setDragState}
        />
      </div>
    );
  },
);
