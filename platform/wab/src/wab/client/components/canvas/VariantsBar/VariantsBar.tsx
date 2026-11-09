import { useContentEditorScope } from "@/wab/client/studio-ctx/canvas-content-editor";
import { useFrameHeights } from "@/wab/client/studio-ctx/frame-heights";
import { useStudioOverlayState } from "@/wab/client/studio-ctx/studio-overlay-state";
import { useStudioArena } from "@/wab/client/studio-ctx/arena-state";
import { useViewVariants } from "@/wab/client/studio-ctx/variant-state";
import { useFocusedViewSelection, useStudioSelection, useViewSelection } from "@/wab/client/studio-ctx/selection-state";
import { useShallow } from "zustand/react/shallow";
import { useStudioLiveMode } from "@/wab/client/studio-ctx/studio-mode-state";
import { useCanvasGeometry, useCanvasTransforming } from "@/wab/client/studio-ctx/viewport-state";
import { getVisibleFrameRect } from "@/wab/client/components/canvas/HoverBox/visible-bounds";
import {
  getSpotlightDomInfo,
  getSpotlightInfo,
} from "@/wab/client/components/canvas/Spotlight";
import VariantBadge from "@/wab/client/components/canvas/VariantsBar/VariantBadge";
import styles from "@/wab/client/components/canvas/VariantsBar/VariantsBar.module.scss";
import VariantsDrawer from "@/wab/client/components/canvas/VariantsBar/VariantsDrawer";
import { makeVariantsController } from "@/wab/client/components/variants/VariantsController";
import { usePlasmicCtx } from "@/wab/client/contexts/StudioContexts";
import { frameToClientRect } from "@/wab/client/coords";
import { plasmicCanvasTransformEvent } from "@/wab/client/definitions/events";
import { useAutoFocus } from "@/wab/client/hooks/useAutoFocus";
import PlasmicVariantsBar from "@/wab/client/plasmic/plasmic_kit_variants_bar/PlasmicVariantsBar";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { useSignalListener } from "@/wab/commons/components/use-signal-listener";
import {
  getAllVariantsForTpl,
  getDisplayVariants,
  isPrivateStyleVariant,
  isScreenVariant,
} from "@/wab/shared/Variants";
import { ensure } from "@/wab/shared/common";
import {
  getSuperComponentVariantGroupToComponent,
  isFrameComponent,
} from "@/wab/shared/core/components";
import { isTplTag } from "@/wab/shared/core/tpls";
import { Box } from "@/wab/shared/geom";
import { Variant, isKnownArenaFrame } from "@/wab/shared/model/classes";
import { Dropdown } from "antd";
import last from "lodash/lodash";
import { useCanvasRenderCount } from "@/wab/client/hooks/useCanvasRenderStatus";
import { useCanvasViewInputs, type CanvasViewFieldRecipe } from "@/wab/client/components/canvas/canvas-view-inputs";
import { canvasVariantChromeFields, canvasVariantFrameFields } from "@/wab/client/components/canvas/canvas-variant-chrome-inputs";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const HOVER_TAG_HEIGHT = 30;
const CANVAS_PADDING = 15;
const GUTTER = 7;

function useFocusedVariants(viewCtx: ViewCtx) {
  useViewSelection(viewCtx, (state) => state.tpls);
  const { studioCtx } = usePlasmicCtx();
  const arenaKind = useStudioArena(studioCtx, (state) => state.kind);
  useStudioArena(studioCtx, (state) => state.current);
  useStudioArena(studioCtx, (state) => state.focusedMode);

  useViewVariants(viewCtx, useShallow((variantState) => [variantState.frames, variantState.global]));
  const variantsController = makeVariantsController(studioCtx, viewCtx);
  const canChangeVariants = variantsController?.canChangeActiveVariants();
  const activeVariants = variantsController?.getActiveNonBaseVariants() ?? [];
  const targetedVariants = activeVariants?.filter((it) =>
    variantsController?.isTargeted(it),
  );

  const focusedTpl = viewCtx?.focusedTpl();
  const frame = viewCtx?.arenaFrame();

  const displayVariants = frame
    ? getDisplayVariants({
        site: studioCtx.site,
        frame,
        isPageArena: arenaKind === "page",
        focusedTag: focusedTpl && isTplTag(focusedTpl) ? focusedTpl : undefined,
        includeAllPrivateStyleVariantsForFocusedTag: true,
      }).map((info) => info.variant)
    : [];

  return {
    variantsController,
    canChangeVariants,
    activeVariants,
    targetedVariants,
    displayVariants,
  };
}

function getFocusedElementRect(studioCtx: StudioCtx) {
  const vc = studioCtx.focusedViewCtx();
  const focusObj = studioCtx.hoverBoxControlledObj;

  if (isKnownArenaFrame(focusObj) && vc) {
    return vc.viewportCtx
      .scalerToClient(
        Box.fromRect(studioCtx.getArenaFrameScalerRect(focusObj)!),
      )
      .rect();
  } else {
    // The bar keeps clear of the selection's name tag, which sits on the
    // visible part of the element, so measure that part.
    const elt = vc?.focusedDomElt()?.[0];
    const objRect = elt && getVisibleFrameRect(elt).rect();

    return vc && objRect
      ? Box.fromRect(frameToClientRect(objRect, vc)).rect()
      : {
          width: 0,
          height: 0,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        };
  }
}

class FloatingBarPosition {
  private pendingTask: number | undefined;
  private inactive = false;
  constructor(readonly models: StudioCtx["modelSnapshots"]) {}
  get task() { return this.pendingTask; }
  get closed() { return this.inactive; }
  open() { this.inactive = false; }
  cancelTask() {
    if (this.pendingTask !== undefined) { window.cancelAnimationFrame(this.pendingTask); this.pendingTask = undefined; }
  }
  close = () => { this.inactive = true; this.cancelTask(); };
  setTask(task: number | undefined) { this.pendingTask = task; }
}

function useFloatingBarForFocusedFrame({
  activeVariants,
  viewCtx,
  contained,
}: {
  activeVariants: Variant[];
  viewCtx: ViewCtx;
  contained?: boolean;
}) {
  const selectionGeometry = useViewSelection(viewCtx, useShallow((state) => [state.targets, state.doms, state.context]));
  const { studioCtx } = usePlasmicCtx();
  const arenaKind = useStudioArena(studioCtx, (state) => state.kind);
  useStudioSelection(studioCtx, useShallow((state) => [state.view, state.frames]));
  const stackOfParents = useStudioOverlayState(studioCtx, (state) => state.stackOfParents);
  const geometry = useCanvasGeometry(studioCtx);
  const contentScope = useContentEditorScope(studioCtx);
  const ownFrame = viewCtx.arenaFrame();
  const controlled = studioCtx.hoverBoxControlledObj;
  const heightFrames = isKnownArenaFrame(controlled) && controlled !== ownFrame ? [ownFrame, controlled] : [ownFrame];
  const heights = useFrameHeights(studioCtx, contained ? [] : heightFrames);
  const position = useMemo(() => new FloatingBarPosition(studioCtx.modelSnapshots), [viewCtx, studioCtx]);
  useEffect(() => {
    if (contained) { return; }
    position.open();
    const cancel = position.close;
    viewCtx.disposeSignal.addEventListener("abort", cancel, { once: true });
    if (viewCtx.disposeSignal.aborted) { cancel(); }
    return () => { viewCtx.disposeSignal.removeEventListener("abort", cancel); cancel(); };
  }, [viewCtx, position, contained]);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const [showPanel, setShowPanel] = useState(true);

  const getFocusedComponentRect = useCallback(() => {
    if (contained || position.closed || viewCtx.disposeSignal.aborted || position.models !== studioCtx.modelSnapshots) { return undefined; }
    const spotlightInfo = getSpotlightInfo(viewCtx!);
    const spotlightDOMInfo = getSpotlightDomInfo(viewCtx!);

    return spotlightInfo.shouldRender
      ? spotlightDOMInfo.focusedScalerRect
      : studioCtx.getArenaFrameScalerRect(viewCtx?.arenaFrame());
  }, [viewCtx, studioCtx, position, contained]);

  const updatePosition = useCallback(() => {
    if (contained || position.closed || viewCtx.disposeSignal.aborted || position.models !== studioCtx.modelSnapshots) { return; }
    position.cancelTask();
    const task = window.requestAnimationFrame(() => {
      if (position.task !== task || position.closed || viewCtx.disposeSignal.aborted || position.models !== studioCtx.modelSnapshots) { return; }
      position.setTask(undefined);
      if (!panelRef.current) {
        return;
      }

      const focusedComponentRect = getFocusedComponentRect();

      if (!focusedComponentRect) {
        return;
      }

      const clipperBox = viewCtx.viewportCtx.clipperBox();
      const componentBox = viewCtx.viewportCtx.scalerToClient(
        Box.fromRect(focusedComponentRect),
      );
      const panelRect = panelRef.current.getBoundingClientRect();
      const controlledObj = studioCtx.hoverBoxControlledObj;
      const focusedElementRect = getFocusedElementRect(studioCtx);
      const hoverTagHeight =
        isKnownArenaFrame(controlledObj) &&
        (arenaKind === "component" || arenaKind === "page")
          ? 0
          : HOVER_TAG_HEIGHT; // TODO: dynamically measure

      const componentTopMargin =
        (arenaKind === "mixed"
          ? HOVER_TAG_HEIGHT
          : focusedElementRect && focusedElementRect.height
            ? Math.max(
                componentBox.top() - (focusedElementRect.top - hoverTagHeight),
                0,
              )
            : 0) +
        GUTTER * 1.3;

      const maxTranslateX =
        clipperBox.width() - panelRect.width - CANVAS_PADDING;
      const maxTranslateY =
        clipperBox.height() - panelRect.height - CANVAS_PADDING;

      const translateX =
        studioCtx.canvasClipper().scrollLeft +
        Math.max(
          Math.min(
            componentBox.left() - clipperBox.left() + GUTTER,
            maxTranslateX,
          ),
          CANVAS_PADDING,
        );

      const translateY =
        studioCtx.canvasClipper().scrollTop +
        Math.max(
          Math.min(
            componentBox.top() -
              componentTopMargin -
              clipperBox.top() -
              panelRect.height,
            maxTranslateY,
          ),
          CANVAS_PADDING,
        );

      panelRef.current.style.transform = `translate(${translateX}px, ${translateY}px)`;

      setShowPanel(clipperBox.intersects(componentBox, true));
    });
    position.setTask(task);
  }, [
    position,
    selectionGeometry,
    getFocusedComponentRect,
    studioCtx,
    viewCtx,
    activeVariants.length,
    arenaKind,
    contentScope,
    contained,
  ]);

  useEffect(() => {
    if (contained) { return; }
    const frameListener = studioCtx.styleChanged.add(updatePosition);
    window.addEventListener(plasmicCanvasTransformEvent, updatePosition);

    return () => {
      frameListener.detach();
      window.removeEventListener(plasmicCanvasTransformEvent, updatePosition);
    };
  }, [updatePosition, studioCtx, contained]);

  useSignalListener(studioCtx.framesChanged, updatePosition, [
    studioCtx,
    updatePosition,
  ]);

  useEffect(() => {
    if (contained || position.closed || viewCtx.disposeSignal.aborted || position.models !== studioCtx.modelSnapshots) { return; }
    const doc = viewCtx.canvasCtx.$doc()[0];
    if (!doc) { return; }
    const resize = new ResizeObserver(updatePosition);
    resize.observe(doc.documentElement);
    const focused = viewCtx.focusedDomElt()?.toArray() ?? [];
    const spotlight = getSpotlightDomInfo(viewCtx).focusedElements ?? [];
    [...focused, ...spotlight].forEach((element) => resize.observe(element));
    if (panelRef.current) { resize.observe(panelRef.current); }
    doc.addEventListener("scroll", updatePosition, true);
    return () => { resize.disconnect(); doc.removeEventListener("scroll", updatePosition, true); };
  }, [viewCtx, studioCtx, position, updatePosition, selectionGeometry, contained]);
  const focusedComponentRect = getFocusedComponentRect();

  useEffect(updatePosition, [
    focusedComponentRect?.left,
    focusedComponentRect?.top,
    focusedComponentRect?.width,
    focusedComponentRect?.height,
    heights,
    geometry,
  ]);

  useLayoutEffect(updatePosition, [updatePosition, heights, contentScope]);

  return {
    showPanel: showPanel && (contained || !stackOfParents),
    panelRef,
  };
}

export const VariantsBar = React.memo(function VariantsBar_({
  contained,
}: {
  contained?: boolean;
}) {
  const { studioCtx, viewCtx } = usePlasmicCtx();
  const arenaKind = useStudioArena(studioCtx, (state) => state.kind);
  useViewSelection(viewCtx, useShallow((state) => [state.context, state.tpls]));
  const liveMode = useStudioLiveMode(studioCtx);
  const transforming = useCanvasTransforming(studioCtx);

  useCanvasRenderCount(viewCtx);
  const recipe = React.useCallback<CanvasViewFieldRecipe>((field) => {
    if (!viewCtx) { return; }
    canvasVariantChromeFields(viewCtx.site, viewCtx.currentComponent(), viewCtx.focusedTpl(), field);
    canvasVariantFrameFields(viewCtx, field);
  }, [viewCtx]);
  const { alive } = useCanvasViewInputs(viewCtx, recipe);
  if (!alive || liveMode || viewCtx?.studioCtx !== studioCtx) {
    return null;
  }

  if (!viewCtx || viewCtx.isDisposed || !viewCtx.valState().maybeValSysRoot()) {
    return null;
  }

  const valComponent = last(viewCtx.valComponentStack());
  const component = valComponent?.tpl?.component;

  if (transforming && !contained) {
    return null;
  }

  if (isFrameComponent(component)) {
    return null;
  }
  const spotlightInfo = getSpotlightInfo(viewCtx);

  const allAvailableVariants = getAllVariantsForTpl({
    component: viewCtx.currentComponent(),
    tpl: viewCtx.focusedTpl(),
    site: viewCtx.site,
  }).filter(
    // We do not show screen variants in the drawer in dedicated arenas
    // when in spotlight mode.
    (v) =>
      !(
        isScreenVariant(v) &&
        spotlightInfo.shouldRender &&
        (arenaKind === "component" || arenaKind === "page")
      ),
  );

  if (allAvailableVariants.length === 0) {
    return null;
  }

  return <VariantsBarInner viewCtx={viewCtx} contained={contained} />;
});

const VariantsBarInner = React.memo(function VariantsBarInner_(props: { contained?: boolean; viewCtx: ViewCtx }) {
  const { viewCtx } = props;
  const selection = useViewSelection(viewCtx, (state) => state.context);
  useCanvasRenderCount(viewCtx);
  const recipe = React.useCallback<CanvasViewFieldRecipe>((field) => {
    canvasVariantChromeFields(viewCtx.site, viewCtx.currentComponent(), viewCtx.focusedTpl(), field);
    canvasVariantFrameFields(viewCtx, field);
  }, [viewCtx, selection]);
  const { alive } = useCanvasViewInputs(viewCtx, recipe);
  return alive ? <VariantsBarActive {...props} /> : null;
});

function VariantsBarActive({
  contained,
  viewCtx,
}: {
  contained?: boolean;
  viewCtx: ViewCtx;
}) {
  useViewSelection(viewCtx, (state) => state.context);
  const {
    variantsController,
    canChangeVariants,
    activeVariants,
    targetedVariants,
    displayVariants,
  } = useFocusedVariants(viewCtx);

  const { studioCtx } = usePlasmicCtx();
  const arenaKind = useStudioArena(studioCtx, (state) => state.kind);
  const showVariantsDrawer = useStudioOverlayState(studioCtx, (state) => state.variantsDrawer);
  useFocusedViewSelection(studioCtx, (state) => state.targets);
  useStudioSelection(studioCtx, (state) => state.view);
  const { showPanel, panelRef } = useFloatingBarForFocusedFrame({
    activeVariants,
    viewCtx,
    contained,
  });
  const searchInputRef = useRef<HTMLInputElement>(null);
  const component = viewCtx.currentComponent();
  const groupToSuperComp =
    component && getSuperComponentVariantGroupToComponent(component);

  useEffect(
    /* Close variants drawer on unmount */ () => () =>
      studioCtx.setShowVariantsDrawer(false),
    [studioCtx],
  );

  useEffect(
    /* When selection change, close the variants drawer */ () => {
      studioCtx.setShowVariantsDrawer(false);
    },
    [
      studioCtx.focusedViewCtx()?.arenaFrame().uid,
      studioCtx.focusedViewCtx()?.focusedSelectable()?.tpl?.uid,
    ],
  );

  const getVariantUnpinHandler = (it: Variant) =>
    canChangeVariants
      ? () => viewCtx?.change(() => variantsController?.onToggleVariant(it))
      : undefined;

  const getVariantToggleHandler = (it: Variant) =>
    variantsController?.canToggleTargeting(it)
      ? () =>
          viewCtx?.change(() => {
            const isCurrentlyTargeted = variantsController.isTargeted(it);
            if (isCurrentlyTargeted && isPrivateStyleVariant(it)) {
              // For private style variants, toggling off from the canvas pin
              // should completely deactivate the variant (not just un-target)
              variantsController.onToggleVariant(it);
            } else {
              variantsController.onTargetVariant(it, !isCurrentlyTargeted);
            }
          })
      : undefined;

  const handleRecordingButtonClick = () => {
    viewCtx?.change(() =>
      variantsController?.onToggleTargetingOfActiveVariants(),
    );
  };

  const toggleDrawerProps = {
    onMouseDown: (e: React.MouseEvent) => {
      e.preventDefault(); // prevent focus, keep focus on VariantDrawer's search input
    },
    onClick: () => {
      studioCtx.setShowVariantsDrawer(!showVariantsDrawer);
    },
  };

  useAutoFocus(showVariantsDrawer && searchInputRef);

  const handleClearVariants = () => {
    variantsController?.onClearVariants();
  };

  const handleRemoveVariant = (variant: Variant) => {
    variantsController?.onToggleVariant(variant);
  };

  const handleTargetVariant = (variant: Variant) => {
    variantsController?.onTargetVariant(variant, true);
  };

  const spotlightInfo = getSpotlightInfo(
    ensure(viewCtx, "Expected viewCtx to be not null in VariantsBar"),
  );

  return !canChangeVariants && !displayVariants.length ? null : (
    <>
      <PlasmicVariantsBar
        isFocused
        isEditable={canChangeVariants}
        isEmpty={!displayVariants.length}
        contained={contained}
        root={
          contained
            ? undefined
            : {
                ref: panelRef,
                className: showPanel ? styles.absolute : styles.hidden,
              }
        }
        emptyListMessage={{ children: "Edit variants", ...toggleDrawerProps }}
        chevronDownIcon={{
          wrap: (chevronDownIcon) => (
            <Dropdown
              transitionName=""
              trigger={[]}
              placement={"bottomLeft"}
              open={showVariantsDrawer}
              popupRender={() => (
                <VariantsDrawer
                  component={component}
                  targetedVariants={targetedVariants}
                  onClearVariants={handleClearVariants}
                  onRemoveVariant={handleRemoveVariant}
                  onTargetVariant={handleTargetVariant}
                  searchInputRef={searchInputRef}
                  hideScreen={
                    (arenaKind === "component" || arenaKind === "page") &&
                    !!spotlightInfo.shouldRender
                  }
                  onDismiss={() => studioCtx.setShowVariantsDrawer(false)}
                />
              )}
            >
              <div
                data-test-id="variants-bar-dropdown-trigger"
                {...toggleDrawerProps}
              >
                {chevronDownIcon}
              </div>
            </Dropdown>
          ),
        }}
        recordingButton={{
          isRecording: targetedVariants.length > 0,
          onClick: handleRecordingButtonClick,
        }}
        variantsList={
          <>
            {displayVariants.map((variant) => (
              <VariantBadge
                key={variant.uid}
                isFocused
                isUnpinnable={
                  !isPrivateStyleVariant(variant) && canChangeVariants
                }
                onUnpin={getVariantUnpinHandler(variant)}
                onToggle={getVariantToggleHandler(variant)}
                isRecording={targetedVariants.includes(variant)}
                variant={variant}
                component={component!}
                superComp={
                  variant.parent
                    ? groupToSuperComp?.get(variant.parent)
                    : undefined
                }
              />
            ))}
          </>
        }
      />
    </>
  );
}
