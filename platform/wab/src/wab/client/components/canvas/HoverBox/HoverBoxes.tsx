import { useContentEditorScope } from "@/wab/client/studio-ctx/canvas-content-editor";
import { useEditingTextContext } from "@/wab/client/studio-ctx/editing-text-state";
import { useAutoOpenedUuid } from "@/wab/client/studio-ctx/auto-open-state";
import { useFrameHeight } from "@/wab/client/studio-ctx/frame-heights";
import { useStudioOverlayState } from "@/wab/client/studio-ctx/studio-overlay-state";
import { useStudioRenderPolicy } from "@/wab/client/studio-ctx/studio-render-policy";
import { observeCanvasSelectionDom } from "@/wab/client/components/canvas/HoverBox/canvas-selection-dom-observer";
import { useStudioArena, useViewRegistry } from "@/wab/client/studio-ctx/arena-state";
import { useStore } from "zustand";
import { useViewVariants } from "@/wab/client/studio-ctx/variant-state";
import { useFocusedViewSelection, useStudioSelection, useViewSelection } from "@/wab/client/studio-ctx/selection-state";
import { useShallow } from "zustand/react/shallow";
import { useViewportValue, useCanvasTransforming, useCanvasZoom } from "@/wab/client/studio-ctx/viewport-state";
import { useCanvasReveals } from "@/wab/client/studio-ctx/canvas-session-ui";
import { CanvasOverlayToolbar } from "@/wab/client/components/canvas/CanvasOverlayToolbar";
import { getActiveCanvasModal } from "@/wab/client/components/canvas/canvas-modal-scope";
import { EditableNodeLabel } from "@/wab/client/components/canvas/EditableNodeLabel";
import { ClippedEdgeIndicators } from "@/wab/client/components/canvas/HoverBox/ClippedEdgeIndicator";
import {
  computeHoverBoxTargets,
  computeHoverBoxViewState,
  getControlledSpacingObj,
  HoverBoxTarget,
  HoverBoxViewProps,
} from "@/wab/client/components/canvas/HoverBox/computeHoverBoxViewStates";
import {
  EdgeDragMode,
  getAffectedSides,
  SpaceEdgeControls,
  SpaceEdgeType,
} from "@/wab/client/components/canvas/HoverBox/draggable-edge";
import { FrameSelectionBox } from "@/wab/client/components/canvas/HoverBox/FrameSelectionBox";
import styles from "@/wab/client/components/canvas/HoverBox/HoverBox.module.scss";
import { InlineAddButton } from "@/wab/client/components/canvas/HoverBox/InlineAddButton";
import { MultiSelectionBox } from "@/wab/client/components/canvas/HoverBox/MultiSelectionBox";
import { ResponsiveColumnsCanvasControls } from "@/wab/client/components/canvas/HoverBox/ResponsiveColumnsCanvasControls";
import { SpacingVisualizer } from "@/wab/client/components/canvas/HoverBox/SpacingVisualizer";
import { useTagPlacement } from "@/wab/client/components/canvas/HoverBox/useTagPlacement";
import { VirtualScrollBar } from "@/wab/client/components/canvas/HoverBox/virtual-scrollbar";
import {
  geometryLayerStyle,
  NO_CLIPPED_SIDES,
} from "@/wab/client/components/canvas/HoverBox/visible-bounds";
import { maybeShowContextMenu } from "@/wab/client/components/ContextMenu";
import { toast } from "@/wab/client/components/Messages";
import {
  canEditSection,
  Section,
} from "@/wab/client/components/sidebar-tabs/Sections";
import { OneShortcutCombo } from "@/wab/client/components/studio/Shortcuts";
import { getContextMenuForFocusedTpl } from "@/wab/client/components/tpl-menu";
import { LinkButton } from "@/wab/client/components/widgets";
import { usePlasmicCtx } from "@/wab/client/contexts/StudioContexts";
import { offsetPxAsUnits } from "@/wab/client/DimManip";
import {
  FreestyleManipulator,
  ManipState,
  ManipulatorAbortedError,
  mkFreestyleManipForFocusedDomElt,
  mkFreestyleManipForFocusedFrame,
} from "@/wab/client/FreestyleManipulator";
import { UiText } from "@/wab/client/i18n/UiText";
import {
  cssPropsForInvertTransform,
  StudioCtx,
} from "@/wab/client/studio-ctx/StudioCtx";
import {
  selectLeftPaneWidth,
  selectLeftTabKey,
} from "@/wab/client/studio-ctx/left-panel-state";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { useFrameForceUpdate } from "@/wab/client/useForceUpdate";
import {
  XDraggable,
  XDraggableEvent,
} from "@/wab/commons/components/XDraggable";
import { sidesAndCorners, styleCase } from "@/wab/commons/ViewUtil";
import { isHeightAutoDerived } from "@/wab/shared/Arenas";
import {
  ensure,
  ensureArray,
  ensureInstance,
  maybe,
  spawnWrapper,
} from "@/wab/shared/common";
import { isSelectableLocked } from "@/wab/shared/core/selection";
import { SlotSelection } from "@/wab/shared/core/slots";
import { isTplColumns } from "@/wab/shared/core/tpls";
import {
  ValComponent,
  ValNode,
  ValSlot,
  ValTag,
} from "@/wab/shared/core/val-nodes";
import { createNumericSize, showSizeCss, Unit } from "@/wab/shared/css-size";
import {
  Corner,
  isAxisSide,
  Side,
  sideOrCornerToSides,
  sideToOrient,
  sideToSize,
} from "@/wab/shared/geom";
import {
  ArenaFrame,
  isKnownArenaFrame,
  TplNode,
} from "@/wab/shared/model/classes";
import { isTplAutoSizable, resetTplSize } from "@/wab/shared/sizingutils";
import { notification } from "antd";
import { ArgsProps } from "antd/lib/notification";
import cn from "classnames";
import { throttle } from "lodash";
import { useCanvasRenderCount } from "@/wab/client/hooks/useCanvasRenderStatus";
import { hoverBoxModelFields, hoverBoxStyleKeys } from "@/wab/client/components/canvas/HoverBox/hover-box-inputs";
import { parentStackStyleProvider } from "@/wab/client/components/canvas/HoverBox/parent-stack-inputs";
import { useCanvasViewInputs, noCanvasModelFields, type CanvasViewFieldRecipe } from "@/wab/client/components/canvas/canvas-view-inputs";
import { useStyleCells } from "@/wab/client/studio-ctx/style-inputs-react";
import type { NativeStyleProvider } from "@/wab/client/studio-ctx/style-inputs";
import { useCanvasGeometry } from "@/wab/client/studio-ctx/viewport-state";
import { $$$ } from "@/wab/shared/TplQuery";
import { isTplVariantable } from "@/wab/shared/core/tpls";
import { ok, Result } from "neverthrow";
import * as React from "react";
import { memo, useEffect, useRef, useState } from "react";
import { useLocalStorage } from "react-use";

const HoverBoxInner = memo(HoverBoxInner_);

function getObjResizability(
  controlledObj: ArenaFrame | undefined | ValNode | SlotSelection,
  viewCtx: ViewCtx | undefined,
) {
  if (isKnownArenaFrame(controlledObj)) {
    return isHeightAutoDerived(controlledObj)
      ? {
          width: true,
          height: false,
        }
      : { width: true, height: true };
  }

  if (viewCtx) {
    return viewCtx.isFocusedResizeDraggable();
  }

  return { width: false, height: false };
}

const _throttledWarn = throttle(
  (args: ArgsProps) => notification.warning(args),
  5000,
  {
    trailing: false,
  },
);

interface SpacingEdgeDragState {
  edgeType: SpaceEdgeType;
  side: Side;
  mode: EdgeDragMode;
  unit: Unit;
  domElt: HTMLElement;
  initValue: number;
  dragDirectionFromZero: undefined | 1 | -1;
  tpl: TplNode;
}

let showedToast = false;

function HoverBoxInner_({ viewProps }: { viewProps: HoverBoxViewProps }) {
  const plasmicCtx = usePlasmicCtx();
  const studioCtx = plasmicCtx.studioCtx;
  const leftTabKey = useStore(studioCtx.leftPanelState.store, selectLeftTabKey);
  const leftPaneWidth = useStore(
    studioCtx.leftPanelState.store,
    selectLeftPaneWidth,
  );
  useFocusedViewSelection(studioCtx, useShallow((state) => [state.context, state.targets, state.tpls]));
  useStudioSelection(studioCtx, useShallow((state) => [state.frames, state.view]));
  const visibleScalerBox = useViewportValue(studioCtx, (state) => state.visibleScalerBox);
  const viewportZoom = useCanvasZoom(studioCtx);
  const arenaKind = useStudioArena(studioCtx, (state) => state.kind);
  const draggingObject = useStore(studioCtx.draggingObjectStore);
  const commentCtx = studioCtx.commentsCtx;
  useStore(studioCtx.uiEnvironment.store, (state) => state.componentSectionPermissions);
  const scope = useCanvasViewInputs(plasmicCtx.viewCtx, noCanvasModelFields);
  const viewCtx = scope.alive && plasmicCtx.viewCtx && !plasmicCtx.viewCtx.isDisposed ? plasmicCtx.viewCtx : undefined;
  useViewSelection(viewCtx, useShallow((state) => [state.doms, state.measure, state.targets]));
  const revealed = useCanvasReveals(viewCtx);
  const autoOpenedUuid = useAutoOpenedUuid(viewCtx);
  const editingTextContext = useEditingTextContext(viewCtx);
  const [resizePart, setResizePart] = useState<Side | Corner | undefined>();
  const [manipState, setManipState] = useState<ManipState>();
  const dimsBoxRef = useRef<HTMLDivElement>(null);
  const [dimsBoxWidth, setDimsBoxWidth] = useState(0);
  const [spacingDragState, setSpacingDragState] = React.useState<
    SpacingEdgeDragState | undefined
  >(undefined);

  const isMultiSelection = (viewCtx?.focusedSelectables().length || 0) > 1;

  const [suppressSpacingToast, setSuppressSpacingToast] = useLocalStorage(
    "HoverBox.suppressSpacingToast",
    false,
  );

  const mkFreestyleManip = (): Result<
    FreestyleManipulator,
    ManipulatorAbortedError
  > => {
    const obj = studioCtx.hoverBoxControlledObj;
    if (isKnownArenaFrame(obj)) {
      return mkFreestyleManipForFocusedFrame(studioCtx, obj);
    } else {
      return mkFreestyleManipForFocusedDomElt(
        ensure(
          viewCtx,
          () =>
            `mkFreestyleManip is only called when there's a focused viewCtx`,
        ),
        obj,
      );
    }
  };

  const startResize = (part: Corner | Side) => {
    const maybeManipulator = mkFreestyleManip();
    maybeManipulator.match(
      (manipulator) => {
        studioCtx.startUnlogged();
        studioCtx.isResizeDragging = true;
        setResizePart(part);
        setManipState(manipulator.start());
      },
      () => {
        setResizePart(undefined);
        setManipState(undefined);
      },
    );
  };

  const dragResize = async (part: Corner | Side, e: XDraggableEvent) => {
    if (manipState) {
      const maybeAborted = await studioCtx.change<ManipulatorAbortedError>(() =>
        mkFreestyleManip().andThen((manipulator) => {
          setManipState(
            manipulator.resize(manipState, part, {
              deltaFrameX: Math.round(e.data.deltaX / viewportZoom),
              deltaFrameY: Math.round(e.data.deltaY / viewportZoom),
              shiftKey: e.mouseEvent.shiftKey,
              altKey: e.mouseEvent.altKey,
              metaKey: e.mouseEvent.metaKey,
              ctrlKey: e.mouseEvent.ctrlKey,
            }),
          );
          return ok();
        }),
      );
      if (maybeAborted.isErr()) {
        await stopResize();
      }
    }
  };

  const stopResize = async () => {
    await studioCtx.changeUnsafe(() => {
      if (studioCtx.isUnlogged()) {
        studioCtx.stopUnlogged();
      }
      studioCtx.isResizeDragging = false;
      const obj = studioCtx.hoverBoxControlledObj;
      if (isKnownArenaFrame(obj)) {
        studioCtx.spreadNewFrameSize(obj);
      }

      setResizePart(undefined);
      setManipState(undefined);
    });
  };

  const clearSize = (part: Corner | Side) => {
    if (!viewCtx || studioCtx.focusedFrame()) {
      return;
    }
    const vtm = viewCtx.variantTplMgr();
    const val = ensureInstance(
      viewCtx.focusedSelectable(),
      ValTag,
      ValComponent,
    );
    const tpl = val.tpl;

    // Skip if focused on the root element of a stretchy frame
    if (viewCtx.getViewOps().isRootNodeOfStretchFrame(tpl)) {
      return;
    }

    viewCtx.change(() => {
      sideOrCornerToSides(part).forEach((side) => {
        if (isTplAutoSizable(tpl, vtm, sideToSize(side))) {
          resetTplSize(tpl, vtm, sideToSize(side));
        }
      });
    });
  };

  const state = viewProps.displayProps;

  const focusedElt = viewCtx?.focusedDomElt()?.get()[0];

  const controlledObj = studioCtx.hoverBoxControlledObj;
  const controlledTpl =
    controlledObj instanceof ValNode ? controlledObj.tpl : undefined;
  const controlledSpacingObj = maybe(viewCtx, (vc) =>
    getControlledSpacingObj(controlledObj, vc),
  );

  const resizable = getObjResizability(controlledObj, viewCtx);

  // `state` width/height/top/left are the element's real box; the HoverBox
  // outline is drawn on all four edges of its visible part. Edge handles are
  // hidden on clipped sides, and controls laid out against the real box go in
  // a geometry layer that is cut off on those sides.
  const visibleBox = state?.visibleBox;
  const clippedSides = state?.clippedSides ?? NO_CLIPPED_SIDES;
  const geometryLayer = (zIndex?: number): React.CSSProperties | undefined =>
    state && visibleBox
      ? {
          ...geometryLayerStyle(
            state,
            visibleBox,
            clippedSides,
            viewportZoom,
          ),
          zIndex,
        }
      : undefined;

  const cssProps = cssPropsForInvertTransform(viewportZoom, visibleBox);

  useEffect(() => {
    setDimsBoxWidth(dimsBoxRef.current ? dimsBoxRef.current.offsetWidth : 0);
  }, [state?.width, state?.height]);

  React.useEffect(() => {
    const listener = studioCtx.focusReset.add(
      spawnWrapper(async () => {
        if (manipState) {
          await stopResize();
        }
      }),
    );

    return () => {
      listener.detach();
    };
  }, [studioCtx, manipState, stopResize]);

  const frameTagRef = useRef<HTMLDivElement>(null);
  const shouldShowDimBadge =
    !isMultiSelection &&
    (!isKnownArenaFrame(controlledObj) || arenaKind === "mixed") &&
    !spacingDragState;
  const showFrameTag = shouldShowDimBadge && isKnownArenaFrame(controlledObj);
  const tagPlacement = useTagPlacement(
    frameTagRef,
    visibleBox?.width || 0,
    viewportZoom,
    showFrameTag ? viewCtx : undefined,
  );
  // The size badge sits centered below the box. When the name tag has to go
  // below the box too, stack the badge under the tag instead of over it.
  const tagIsBelow =
    showFrameTag &&
    tagPlacement.visibility === "visible" &&
    typeof tagPlacement.top === "number" &&
    tagPlacement.top > 0;
  const [tagHeight, setTagHeight] = useState(0);
  React.useLayoutEffect(() => {
    const tag = frameTagRef.current;
    if (!tag) { return; }
    const measure = () => setTagHeight(tag.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure); observer.observe(tag);
    return () => observer.disconnect();
  }, [frameTagRef, showFrameTag]);
  const dimsStyle: React.CSSProperties | undefined =
    tagIsBelow && typeof tagPlacement.left === "number"
      ? {
          top:
            (tagPlacement.top as number) +
            tagHeight +
            3,
          left: tagPlacement.left,
          transform: "none",
        }
      : undefined;

  // The controlledSpacingObj might be undefined if the component's artboard frame
  // view mode is set to `FrameViewMode.Centered`, if that is the case treat the
  // frame as not locked by default.
  const isLocked =
    viewCtx && controlledSpacingObj
      ? isSelectableLocked(controlledSpacingObj, viewCtx.valState())
      : false;

  const shouldShowSideControls =
    ((state?.edgeControls.top.length ?? 0) > 0 ||
      (state?.edgeControls.right.length ?? 0) > 0 ||
      (state?.edgeControls.bottom.length ?? 0) > 0 ||
      (state?.edgeControls.left.length ?? 0) > 0) &&
    !(controlledSpacingObj instanceof ValSlot) &&
    !isLocked &&
    !isMultiSelection &&
    !editingTextContext;

  // TASK #27926: Show corner resizers for arena scratch artboards
  // and for component artboard when their viewmode is set to FrameViewMode.Centered.
  const canShowCornerResizers = false;

  const showingMeasurements = !!viewCtx?.$measureToolDomElt() && !spacingDragState;
  return (
          <div
            className="hoverbox"
            onContextMenu={(e) => {
              if (viewCtx && commentCtx && !state?.isComponentPart) {
                viewCtx.tryBlurEditingText();
                const menu = getContextMenuForFocusedTpl(viewCtx);
                maybeShowContextMenu(e.nativeEvent, menu);
              }
            }}
            data-original-width={visibleBox?.width}
            data-original-height={visibleBox?.height}
            style={{
              position: state?.position as any,
              top: visibleBox?.top,
              left: visibleBox?.left,
              display: viewProps.display,
              ...cssProps,
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {
              <>
                {shouldShowSideControls &&
                  (() => {
                    const anyEdge = state?.edgeControls.top;
                    const allowPadding = anyEdge?.includes("padding") ?? false;
                    const allowMargin = anyEdge?.includes("margin") ?? false;

                    return (
                      <div style={geometryLayer(-1)}>
                        <SpacingVisualizer
                          allowPadding={allowPadding}
                          allowMargin={allowMargin}
                          paddingPx={state?.paddingPx}
                          marginPx={state?.marginPx}
                          zoom={viewportZoom}
                        />
                      </div>
                    );
                  })()}

                {showFrameTag && viewCtx && (
                  <div
                    className={styles.hoverBoxTagContainer}
                    style={tagPlacement}
                  >
                    <div ref={frameTagRef} className="node-outline-tag">
                      {state?.tagName && (
                        <EditableNodeLabel
                          studioCtx={studioCtx}
                          viewCtx={viewCtx}
                          displayName={state.tagName}
                          icon={state?.tagIcon}
                          nameable={controlledObj}
                        />
                      )}
                    </div>
                  </div>
                )}
                <div
                  className={cn({
                    HoverBox__Border: true,
                    "HoverBox__Border--autoWidth": state && state.autoWidth,
                    "HoverBox__Border--autoHeight": state && state.autoHeight,
                    "HoverBox__Border--dashed": state && state.dashedBorder,
                  })}
                />
                <div className={"HoverBox__Controls"}>
                  <div
                    className="HoverBox__Resizers"
                    style={
                      // Edges extend across neighbouring margins; a clipped
                      // side's margin is not on screen, so don't extend into it.
                      Object.fromEntries(
                        (["top", "bottom", "left", "right"] as const).map(
                          (s) => [
                            `--selected-element-margin-${s}`,
                            `${
                              clippedSides[s]
                                ? 0
                                : (state?.marginPx?.[s] ?? 0) * viewportZoom
                            }px`,
                          ],
                        ),
                      ) as React.CSSProperties
                    }
                  >
                    {shouldShowSideControls &&
                      sidesAndCorners({
                        ...(canShowCornerResizers
                          ? {
                              corner: (corner) =>
                                !sideOrCornerToSides(corner).some(
                                  (s) => clippedSides[s],
                                ) &&
                                state?.edgeControls["top"].includes("size") &&
                                state?.edgeControls["bottom"].includes(
                                  "size",
                                ) &&
                                state?.edgeControls["left"].includes("size") &&
                                state?.edgeControls["right"].includes("size") &&
                                resizable.width &&
                                resizable.height && (
                                  <XDraggable
                                    key={corner}
                                    onStart={(_e) => startResize(corner)}
                                    onDrag={(e) => dragResize(corner, e)}
                                    onStop={() => stopResize()}
                                  >
                                    <div
                                      onDoubleClick={() => clearSize(corner)}
                                      className={cn("HoverBox__Resizer", `HoverBox__Resizer__${styleCase(corner)}`)}
                                    />
                                  </XDraggable>
                                ),
                            }
                          : undefined),
                        side: (side) => {
                          if (clippedSides[side]) {
                            // The real edge is not visible; a handle on the
                            // visible box would move an edge the user can't see.
                            return null;
                          }
                          const isVertical = isAxisSide(side, "width");
                          const isHorizontal = isAxisSide(side, "height");
                          const allowPadding =
                            state?.edgeControls[side].includes("padding");
                          const allowMargin =
                            state?.edgeControls[side].includes("margin");
                          const allowSizing =
                            state?.edgeControls[side].includes("size") &&
                            ((isVertical && resizable.width) ||
                              (isHorizontal && resizable.height));
                          const disabledDnd = !canEditSection(
                            studioCtx,
                            Section.Spacing,
                          );
                          return (
                            <SpaceEdgeControls
                              side={side}
                              paddingLabel={
                                allowPadding
                                  ? maybe(
                                      state?.padding?.[side],
                                      (size) => `${showSizeCss(size)}`,
                                    )
                                  : null
                              }
                              marginLabel={
                                allowMargin
                                  ? maybe(
                                      state?.margin?.[side],
                                      (size) => `${showSizeCss(size)}`,
                                    )
                                  : null
                              }
                              paddingPxValue={
                                allowPadding
                                  ? (state?.paddingPx?.[side] ?? 0)
                                  : null
                              }
                              disabledPaddingDragging={
                                state?.padding?.[side]?.type === "FunctionSize"
                              }
                              disabledMarginDragging={
                                state?.margin?.[side]?.type === "FunctionSize"
                              }
                              marginPxValue={
                                allowMargin
                                  ? (state?.marginPx?.[side] ?? 0)
                                  : null
                              }
                              sizePxValue={
                                allowSizing ? (state?.[side] ?? 0) : null
                              }
                              draggedSide={spacingDragState?.side}
                              draggedEdgeType={spacingDragState?.edgeType}
                              zoom={viewportZoom}
                              isAutoSized={
                                sideToOrient(side) === "horiz"
                                  ? state?.autoWidth
                                  : state?.autoHeight
                              }
                              childAlign={
                                state?.containerChildAlignment[
                                  sideToOrient(side)
                                ]
                              }
                              showMeasurements={showingMeasurements}
                              // Edge controls span the visible edge, so size
                              // their labels/thickness by its on-screen length.
                              focusedHeight={visibleBox?.height}
                              focusedWidth={visibleBox?.width}
                              onDragStart={async (side2, edgeType) => {
                                await studioCtx.change(() => {
                                  if (edgeType === "size") {
                                    startResize(side2);
                                    return ok();
                                  } else {
                                    if (!viewCtx || !controlledSpacingObj) {
                                      return ok();
                                    }
                                    const val = maybe(
                                      controlledSpacingObj,
                                      (focused) =>
                                        ensureInstance(
                                          focused,
                                          ValTag,
                                          ValComponent,
                                        ),
                                    );
                                    if (!val) {
                                      return ok();
                                    }
                                    const domElt = ensureArray(
                                      viewCtx.renderState.sel2dom(
                                        val,
                                        viewCtx.canvasCtx,
                                      ),
                                    )[0] as HTMLElement;
                                    studioCtx.startUnlogged();
                                    studioCtx.isResizeDragging = true;
                                    const initValue =
                                      state?.[`${edgeType}Px`]?.[side2] ?? 0;
                                    const edgeSide = state?.[edgeType]?.[side2];
                                    setSpacingDragState({
                                      side: side2,
                                      edgeType,
                                      mode: "single",
                                      domElt,
                                      unit:
                                        edgeSide?.type === "NumericSize"
                                          ? edgeSide.unit
                                          : "px",
                                      tpl: val.tpl,
                                      initValue,
                                      dragDirectionFromZero: undefined,
                                    });
                                    if (!showedToast && !suppressSpacingToast) {
                                      showedToast = true;
                                      toast(
                                        <div>
                                          <UiText
                                            message="Hold down {alt} or {shift} to update more than one side at a time"
                                            values={{
                                              alt: (
                                                <OneShortcutCombo combo="alt" />
                                              ),
                                              shift: (
                                                <OneShortcutCombo combo="shift" />
                                              ),
                                            }}
                                          />
                                          <br />(
                                          <LinkButton
                                            onClick={() => {
                                              setSuppressSpacingToast(true);
                                              notification.destroy("spacing");
                                            }}
                                          >
                                            <UiText
                                              message={"never show again"}
                                            />
                                          </LinkButton>
                                          )
                                        </div>,
                                        {
                                          duration: 999,
                                          key: "spacing",
                                        },
                                      );
                                    }
                                    return ok();
                                  }
                                });
                              }}
                              onDrag={async (side2, edgeType, delta, mode) => {
                                if (edgeType === "size") {
                                  if (!manipState) {
                                    return;
                                  }
                                  const maybeAborted =
                                    await studioCtx.change<ManipulatorAbortedError>(
                                      () =>
                                        mkFreestyleManip().andThen((manipulator) => {
                                          const isVertical2 =
                                            side2 === "left" ||
                                            side2 === "right";
                                          setManipState(
                                            manipulator.resize(
                                              manipState,
                                              side2,
                                              {
                                                deltaFrameX: isVertical2
                                                  ? (side2 === "left"
                                                      ? -1
                                                      : 1) * Math.round(delta)
                                                  : 0,
                                                deltaFrameY: isVertical2
                                                  ? 0
                                                  : (side2 === "top" ? -1 : 1) *
                                                    Math.round(delta),
                                                shiftKey: mode === "all",
                                                altKey: mode === "symmetric",
                                                metaKey: false,
                                                ctrlKey: false,
                                              },
                                            ),
                                          );
                                          return ok();
                                        }),
                                    );
                                  if (maybeAborted.isErr()) {
                                    await stopResize();
                                  }
                                } else {
                                  if (!spacingDragState) {
                                    return;
                                  }
                                  await studioCtx.changeUnsafe(() => {
                                    const { initValue, dragDirectionFromZero } =
                                      spacingDragState;
                                    const newValue =
                                      initValue === 0 &&
                                      dragDirectionFromZero === undefined &&
                                      edgeType === "padding"
                                        ? Math.abs(delta)
                                        : initValue +
                                          (dragDirectionFromZero ?? 1) * delta;
                                    const frameOffset = Math.max(0, newValue);
                                    const newNumericValue = offsetPxAsUnits(
                                      spacingDragState.domElt,
                                      spacingDragState.unit,
                                      frameOffset,
                                      "width",
                                      0,
                                    );
                                    const newUnitValue = showSizeCss(
                                      createNumericSize(
                                        newNumericValue,
                                        spacingDragState.unit,
                                      ),
                                    );
                                    const vtm = ensure(
                                      viewCtx,
                                      () =>
                                        `Only possible to resize if there's a focused viewCtx`,
                                    ).variantTplMgr();
                                    const expr = vtm.targetRshForNode(
                                      spacingDragState.tpl,
                                    );
                                    for (const s of getAffectedSides(
                                      side2,
                                      mode,
                                    )) {
                                      expr.set(
                                        `${edgeType}-${s}`,
                                        newUnitValue,
                                      );
                                    }

                                    if (spacingDragState.mode !== mode) {
                                      setSpacingDragState({
                                        ...spacingDragState,
                                        mode,
                                      });
                                    }
                                    if (
                                      initValue === 0 &&
                                      dragDirectionFromZero === undefined &&
                                      edgeType === "padding" &&
                                      delta !== 0
                                    ) {
                                      setSpacingDragState({
                                        ...spacingDragState,
                                        dragDirectionFromZero:
                                          delta > 0 ? 1 : -1,
                                      });
                                    }
                                  });
                                }
                              }}
                              onDragStop={async (side2, edgeType) => {
                                if (edgeType === "size") {
                                  await stopResize();
                                } else {
                                  await studioCtx.change(() => {
                                    setSpacingDragState(undefined);
                                    studioCtx.stopUnlogged();
                                    studioCtx.isResizeDragging = false;
                                    return ok();
                                  });
                                  setTimeout(
                                    () => notification.destroy("spacing"),
                                    3000,
                                  );
                                }
                              }}
                              onHover={() => {}}
                              onDoubleClick={async (side2, edgeType) => {
                                if (edgeType === "size") {
                                  clearSize(side2);
                                } else {
                                  if (!viewCtx || !controlledSpacingObj) {
                                    return;
                                  }
                                  await studioCtx.changeUnsafe(() => {
                                    const val = ensureInstance(
                                      controlledSpacingObj,
                                      ValTag,
                                      ValComponent,
                                    );
                                    const vtm = ensure(
                                      viewCtx,
                                      () =>
                                        `Only possible to resize when there's a focused viewCtx`,
                                    ).variantTplMgr();
                                    const expr = vtm.targetRshForNode(val.tpl);
                                    if (expr.has(`${edgeType}-${side2}`)) {
                                      expr.clear(`${edgeType}-${side2}`);
                                    } else {
                                      expr.set(`${edgeType}-${side2}`, "0px");
                                    }
                                  });
                                }
                              }}
                              showSquare={!canShowCornerResizers && allowSizing}
                              disabledDnd={disabledDnd}
                            />
                          );
                        },
                      })}
                  </div>
                </div>
                {focusedElt && viewCtx && (
                  // The editor scrollbar maps 1:1 onto the element's own
                  // scroll area, so it is laid out on the real box.
                  <div style={geometryLayer()}>
                    <VirtualScrollBar element={focusedElt} axis={"vertical"} />
                    <VirtualScrollBar
                      element={focusedElt}
                      axis={"horizontal"}
                    />
                  </div>
                )}
                {state &&
                  shouldShowDimBadge &&
                  !(autoOpenedUuid || revealed) && (
                    // Real element size, even when the drawn box is clipped.
                    <div
                      ref={dimsBoxRef}
                      className={"HoverBox__Dims"}
                      style={dimsStyle}
                    >
                      {Math.round(state.width)} × {Math.round(state.height)}
                    </div>
                  )}
                {state &&
                  visibleBox &&
                  viewCtx &&
                  !isMultiSelection &&
                  !manipState &&
                  !spacingDragState &&
                  !draggingObject && (
                    <ClippedEdgeIndicators
                      elements={viewCtx.focusedDomElt()?.get() ?? []}
                      geometry={state}
                      visible={visibleBox}
                      clippedSides={clippedSides}
                      zoom={viewportZoom}
                    />
                  )}
                {resizePart && (
                  <div
                    className={cn("HoverBox__DragGuard", `HoverBox__DragGuard__${styleCase(resizePart)}`)}
                  />
                )}
                {state &&
                  viewCtx &&
                  controlledTpl &&
                  isTplColumns(controlledTpl) && (
                    // Column dividers are positioned from the element's real
                    // content box.
                    <div style={geometryLayer(-1)}>
                      <ResponsiveColumnsCanvasControls
                        viewCtx={viewCtx}
                        tpl={controlledTpl}
                      />
                    </div>
                  )}
              </>
            }
            {viewCtx && state && !state.isComponentPart && shouldShowDimBadge && (
              <div
                className={styles.elementActions}
                style={{
                  left: Math.max(
                    -28,
                    ((visibleScalerBox.left() ??
                      state.visibleBox.left) -
                      state.visibleBox.left) *
                      viewportZoom +
                      (leftTabKey ? leftPaneWidth : 0) +
                      4,
                  ),
                }}
              >
                <CanvasOverlayToolbar viewCtx={viewCtx} />
              </div>
            )}
            {!isMultiSelection && !state?.isComponentPart && (
              <InlineAddButton
                // The button sits on the drawn box, so check space against it.
                elementWidth={visibleBox?.width}
                elementHeight={visibleBox?.height}
                dimensionsBoxWidth={dimsBoxWidth}
                key={state?.targetUid}
              />
            )}
          </div>
  );
}

export const HoverBox = memo(HoverBox_);
function HoverBox_(props: { viewCtx: ViewCtx; target: HoverBoxTarget }) {
  const { viewCtx, target } = props;
  const renderCount = useCanvasRenderCount(viewCtx);
  const root = useStore(viewCtx.frameState.valRootStore);
  const variants = useViewVariants(viewCtx, useShallow((state) => [state.frames, state.global]));
  const recipe = React.useCallback<CanvasViewFieldRecipe>((field) => hoverBoxModelFields(viewCtx, target, field), [viewCtx, target, renderCount, root, variants]);
  const input = useCanvasViewInputs(viewCtx, recipe);
  const providers = React.useMemo(() => {
    if (!input.alive) { return []; }
    const spacing = getControlledSpacingObj(isKnownArenaFrame(target) ? target : target.focusObj, viewCtx);
    const tpl = spacing?.tpl;
    const parent = tpl ? $$$(tpl).layoutParent().maybeOneTpl() : undefined;
    return [tpl, parent].filter((node): node is TplNode => !!node && isTplVariantable(node))
      .map((node) => parentStackStyleProvider(viewCtx, node));
  }, [viewCtx, target, input, renderCount, root, variants]);
  return <HoverBoxStyles {...props} providers={providers} input={input} />;
}
function HoverBoxStyles(props: {
  viewCtx: ViewCtx;
  target: HoverBoxTarget;
  providers: NativeStyleProvider[];
  input: ReturnType<typeof useCanvasViewInputs>;
}) {
  if (!props.input.alive) { return null; }
  const [provider, ...rest] = props.providers;
  return provider ? <HoverBoxStyleSubscriber provider={provider} render={() => <HoverBoxStyles {...props} providers={rest} />} />
    : <HoverBoxGeometry {...props} />;
}
function HoverBoxStyleSubscriber(props: { provider: NativeStyleProvider; render: () => React.ReactElement }) {
  useStyleCells(props.provider, hoverBoxStyleKeys);
  return props.render();
}
function HoverBoxGeometry({
  viewCtx,
  target,
}: {
  viewCtx: ViewCtx;
  target: HoverBoxTarget;
}) {
  "use no memo";
  // Read live model coordinates and DOM layout after their subscriptions fire.
  useViewVariants(viewCtx, useShallow((variantState) => [variantState.frames, variantState.global]));
  const selection = useViewSelection(viewCtx, useShallow((state) => [state.part, state.doms, state.context, state.cloneKeys]));
  const selectedPart = React.useMemo(() => viewCtx.focusedComponentPart, [viewCtx, selection]);
  useContentEditorScope(viewCtx.studioCtx);
  const forceUpdate = useFrameForceUpdate(viewCtx.disposeSignal);
  useCanvasGeometry(viewCtx.studioCtx);

  const focusedElt = !isKnownArenaFrame(target) ? target.node : undefined;
  const transformingObject = useStore(viewCtx.studioCtx.transformingObjectStore);
  const draggingObject = useStore(viewCtx.studioCtx.draggingObjectStore);
  useFrameHeight(viewCtx.studioCtx, isKnownArenaFrame(target) ? target : undefined);
  const viewProps = computeHoverBoxViewState(viewCtx, target, transformingObject, draggingObject, selectedPart);
  const partElement =
    viewProps.displayProps &&
    "isComponentPart" in viewProps.displayProps &&
    viewProps.displayProps.isComponentPart
      ? viewProps.focusedElt?.[0]
      : undefined;

  React.useEffect(() => {
    const doc = viewCtx.canvasCtx.$doc()[0];
    doc.addEventListener("scroll", forceUpdate, true);
    return () => doc.removeEventListener("scroll", forceUpdate, true);
  }, [viewCtx, forceUpdate]);

  React.useEffect(() => {
    // Subscribe to events that may cause HoverBoxes to need to re-render
    // as underlying DOM elements may have changed in size or location
    const stylesListener = viewCtx.studioCtx.styleChanged.add(forceUpdate);
    const framesListener = viewCtx.studioCtx.framesChanged.add(forceUpdate);

    return () => {
      stylesListener.detach();
      framesListener.detach();
    };
  }, [viewCtx.studioCtx, forceUpdate]);

  React.useEffect(() => {
    if (focusedElt && focusedElt.length > 0) {
      const elts = partElement ? [partElement] : focusedElt.toArray();
      const eltsSet = new Set<Node>(elts);
      return observeCanvasSelectionDom(
        viewCtx.disposeSignal,
        elts.flatMap((elt) => elt.parentNode ? [elt.parentNode] : []),
        { childList: true },
        (mutations) => {
          for (const mutation of mutations) {
            for (const el of mutation.removedNodes) {
              if (eltsSet.has(el)) {
                viewCtx.recomputeFocusedDomElts();
                if (viewCtx.disposeSignal.aborted) { return; }
              }
            }
          }
        },
        { targets: elts, onResize: forceUpdate },
      );
    } else {
      return undefined;
    }
  }, [focusedElt, partElement, viewCtx, forceUpdate]);

  return <HoverBoxInner viewProps={viewProps} />;
}

export const HoverBoxes = memo(HoverBoxes_);
function HoverBoxes_(props: { studioCtx: StudioCtx }) {
  const { studioCtx } = props;
  useContentEditorScope(studioCtx);
  useCanvasTransforming(studioCtx);
  // computeHoverBoxTargets resolves controlled frames through the registry
  // command index; this subscription keeps that result reactive to a roster
  // change without making every unrelated model commit clone the roster.
  useViewRegistry(studioCtx, (entries) => entries);

  const studioSelection = useStudioSelection(studioCtx, (state) => state);
  const viewCtx = studioSelection.view;
  useCanvasRenderCount(viewCtx);
  const targetRecipe = React.useCallback<CanvasViewFieldRecipe>((field) => {
    if (!viewCtx) { return; }
    const frame = viewCtx.arenaFrame(); field(frame, "viewMode", "container");
    field(frame.container, "component"); field(frame.container.component, "tplTree");
  }, [viewCtx]);
  const scope = useCanvasViewInputs(viewCtx, targetRecipe);
  useViewVariants(viewCtx, useShallow((variantState) => [variantState.frames, variantState.global]));
  const selection = useViewSelection(viewCtx, useShallow((state) => ({
    targets: state.targets, doms: state.doms, tpls: state.tpls, part: state.part,
  })));

  useStudioRenderPolicy(studioCtx, (policy) => policy.devMode);
  useStudioOverlayState(studioCtx, (state) => state.screenshotting);
  const shouldHideHoverBox = studioCtx.shouldHideUIOverlay(false) || !viewCtx || !scope.alive;

  const forceUpdate = useFrameForceUpdate(viewCtx?.disposeSignal);

  // With React 18, sometimes rendering won't be done in time for a newly-inserted
  // tpl to be rendered and its DOM element set. So we need to monitor the
  // artboard root for DOM mutations, and select the proper DOM element once
  // rendered.
  // https://app.shortcut.com/plasmic/story/23379/urgent-selection-is-not-appearing-for-newly-inserted-pasted-moved-elements
  // Portaled overlays mount next to the user root, so include the canvas body.
  const canvasBody = scope.alive ? viewCtx?.canvasCtx.doc().body : undefined;
  React.useEffect(() => {
    if (!canvasBody || !viewCtx) {
      return;
    }

    let modal = getActiveCanvasModal(canvasBody.ownerDocument);
    return observeCanvasSelectionDom(viewCtx.disposeSignal, [canvasBody], {
      subtree: true, childList: true, attributes: true, attributeFilter: ["class", "style", "aria-modal"],
    }, (mutations) => {
      const currentModal = getActiveCanvasModal(canvasBody.ownerDocument);
      if (currentModal === modal && !mutations.some((mutation) => mutation.type === "childList")) {
        return;
      }
      modal = currentModal;
      // Because the selected element may now be present, we try to recompute
      // focus on it
      const updated = viewCtx.recomputeFocusedDomElts();
      if (!updated) {
        // If new DOM elements are now focused, then HoverBox will re-render.
        // But even if not, we want to force an update here, because the
        // DOM may have been updated such that the old position is stale
        // (for example, if hoverbox is on 10th, we press delete, and it's
        // now on the next item, Hoverbox will be rendering where that next
        // item used to be rather than where it is now). This is also only
        // for React 18 :-/
        forceUpdate();
      }
    });
  }, [viewCtx, canvasBody, forceUpdate]);

  if (studioSelection.frames.length > 1) {
    return studioCtx.shouldHideUIOverlay(false) ? null : (
      <FrameSelectionBox studioCtx={studioCtx} />
    );
  }
  if (viewCtx && selection.targets.length > 1) {
    return shouldHideHoverBox ? null : <MultiSelectionBox viewCtx={viewCtx} />;
  }
  const targets = scope.alive ? computeHoverBoxTargets(studioCtx, studioSelection, selection) : [];
  return shouldHideHoverBox ? null : (
    <>
      {targets.map((target, i) => (
        <HoverBox key={i} viewCtx={viewCtx!} target={target} />
      ))}
    </>
  );
}
