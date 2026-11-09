import { useContentEditorScope } from "@/wab/client/studio-ctx/canvas-content-editor";
import { useStudioOverlayState } from "@/wab/client/studio-ctx/studio-overlay-state";
import { useStore } from "zustand";
import { useViewVariants } from "@/wab/client/studio-ctx/variant-state";
import { useHoveredViewCtx, useStudioSelection, useViewSelection } from "@/wab/client/studio-ctx/selection-state";
import { useShallow } from "zustand/react/shallow";
import { useCanvasTransforming } from "@/wab/client/studio-ctx/viewport-state";
import { useCanvasZoom } from "@/wab/client/studio-ctx/viewport-state";
import { EditableNodeLabel } from "@/wab/client/components/canvas/EditableNodeLabel";
import { getActiveCanvasModal, getCanvasModalSelectionRoot } from "@/wab/client/components/canvas/canvas-modal-scope";
import styles from "@/wab/client/components/canvas/HoverBox/HoverBox.module.scss";
import { useTagPlacement } from "@/wab/client/components/canvas/HoverBox/useTagPlacement";
import { computeScalerVisibility } from "@/wab/client/components/canvas/HoverBox/visible-bounds";
import { createNodeIcon } from "@/wab/client/components/sidebar-tabs/tpl-tree";
import {
  BASE_VARIANT_COLOR,
  NON_BASE_VARIANT_COLOR,
} from "@/wab/client/components/studio/GlobalCssVariables";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { hasLayoutBox } from "@/wab/client/dom";
import {
  StudioCtx,
  cssPropsForInvertTransform,
} from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { summarizeFocusObj } from "@/wab/client/utils/tpl-client-utils";
import { ensure } from "@/wab/shared/common";
import {
  SQ,
  Selectable,
  makeSelectableFullKey,
} from "@/wab/shared/core/selection";
import { isTplTagOrComponent } from "@/wab/shared/core/tpls";
import cn from "classnames";
import $ from "jquery";
import { useCanvasRenderCount } from "@/wab/client/hooks/useCanvasRenderStatus";
import { useParentStackItemInputs } from "@/wab/client/components/canvas/HoverBox/parent-stack-inputs";
import { useHoverVariantInputs } from "@/wab/client/components/canvas/HoverBox/hover-variant-inputs";
import { useStyleCells } from "@/wab/client/studio-ctx/style-inputs-react";
import type { NativeStyleProvider } from "@/wab/client/studio-ctx/style-inputs";
import { useFrameForceUpdate } from "@/wab/client/useForceUpdate";
import React from "react";

export const PreselectBoxes = React.memo(PreselectBoxes_);
function PreselectBoxes_() {
  const studioCtx = useStudioCtx();
  useContentEditorScope(studioCtx);
  const transforming = useCanvasTransforming(studioCtx);
  const ancestorsHoverBoxes = useStudioOverlayState(studioCtx, (state) => state.ancestorsHoverBoxes);

  const viewCtx = useHoveredViewCtx(studioCtx);
  useViewSelection(viewCtx, useShallow((state) => [state.hover, state.hoverDom]));
  const alive = usePreselectLifetime(viewCtx);
  useCanvasRenderCount(viewCtx);
  const doc = alive ? viewCtx?.canvasCtx.$doc()[0] : undefined;
  const subscribeModal = React.useCallback((listener: () => void) => {
    if (!doc?.body) { return () => undefined; }
    const observer = new MutationObserver(listener);
    observer.observe(doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "style", "aria-modal", "role", "hidden"] });
    return () => observer.disconnect();
  }, [doc]);
  const readModal = React.useCallback(() => getActiveCanvasModal(doc), [doc]);
  const modal = React.useSyncExternalStore(subscribeModal, readModal, readModal);

  if (transforming || !alive) {
    return null;
  }

  const hoveredSelectable = viewCtx?.hoveredSelectable();
  const cloneKey = hoveredSelectable
    ? viewCtx?.sel2cloneKey(hoveredSelectable)
    : undefined;
  const hoveredSQ =
    viewCtx && hoveredSelectable
      ? SQ(hoveredSelectable, viewCtx.valState())
      : undefined;
  const ancestorsSelectables = (hoveredSQ?.ancestors().toArray() ?? []).filter(
    (selectable) => viewCtx?.contentEditor.contains(selectable),
  );

  const preselectBoxes = ancestorsHoverBoxes
    ? ancestorsSelectables.map((selectable) => (
        <PreselectBox
          key={makeSelectableFullKey(selectable)}
          selectable={selectable}
          cloneKey={cloneKey}
          studioCtx={studioCtx}
          viewCtx={viewCtx}
          isHoveredElt={hoveredSelectable === selectable}
          modal={modal}
        />
      ))
    : !!hoveredSelectable && (
        <PreselectBox
          selectable={hoveredSelectable}
          cloneKey={cloneKey}
          studioCtx={studioCtx}
          viewCtx={viewCtx}
          isHoveredElt={true}
          modal={modal}
        />
      );
  return <>{preselectBoxes}</>;
}

export const PreselectBox = React.memo(PreselectBox_);
function PreselectBox_(props: {
  selectable: Selectable;
  cloneKey: string | undefined;
  studioCtx: StudioCtx;
  viewCtx: ViewCtx | undefined;
  isHoveredElt: boolean;
  modal?: HTMLElement;
}) {
  const { selectable, cloneKey, studioCtx, viewCtx, isHoveredElt } = props;
  useContentEditorScope(studioCtx);
  const draggingObject = useStore(studioCtx.draggingObjectStore);
  const screenshotting = useStudioOverlayState(studioCtx, (state) => state.screenshotting);
  const stackOfParents = useStudioOverlayState(studioCtx, (state) => state.stackOfParents);
  useStudioSelection(studioCtx, (state) => state.view);
  useViewVariants(viewCtx, useShallow((state) => [state.frames, state.global]));
  useCanvasRenderCount(viewCtx);
  const alive = usePreselectLifetime(viewCtx);
  useViewSelection(viewCtx, useShallow((state) => [state.doms, state.hoverDom]));

  const $selection = alive ? viewCtx?.selectionDom(selectable, cloneKey) ?? undefined : undefined;
  const $hovered = alive ? viewCtx?.$hoveredDomElt() : undefined;
  // Portals keep model ancestors whose DOM remains behind the overlay. Only
  // outline ancestor roots that actually contain the hovered foreground DOM.
  const $ancestors = !isHoveredElt && $hovered?.length
    ? $selection?.filter((_, element) =>
        $hovered.toArray().some((hovered) => element.contains(hovered)),
      )
    : $selection;
  // Opening a modal can cover the last hover target before another mousemove.
  // Use the rendered modal boundary, including for that stale hovered element.
  const modal = props.modal ?? getActiveCanvasModal($selection?.[0]?.ownerDocument);
  const modalRoot = modal && viewCtx && getCanvasModalSelectionRoot(viewCtx, modal);
  const $element = modal && selectable === modalRoot
    ? $(modal) : modal
    ? $ancestors?.filter((_, element) => modal.contains(element))
    : $ancestors;
  const $focused =
    alive && viewCtx === studioCtx.focusedViewCtx() && viewCtx?.focusedDomElt();

  const shouldShow =
    alive && viewCtx &&
    viewCtx.contentEditor.contains(selectable) &&
    !draggingObject &&
    !screenshotting &&
    $element?.length &&
    $element?.get(0).isConnected &&
    $element?.toArray().filter(hasLayoutBox)?.length > 0 &&
    (stackOfParents || !$focused || !$element.is($focused));

  if (!shouldShow || !viewCtx) {
    return null;
  }

  return (
    <PreselectBoxInner
      selectable={selectable}
      studioCtx={studioCtx}
      viewCtx={viewCtx}
      isHoveredElt={isHoveredElt}
      $element={$element}
      $focused={$focused}
    />
  );
}

function PreselectBoxInner(props: {
  selectable: Selectable;
  studioCtx: StudioCtx;
  viewCtx: ViewCtx;
  isHoveredElt: boolean;
  $element: JQuery | undefined;
  $focused: false | JQuery<HTMLElement> | null | undefined;
}) {
  const { selectable, viewCtx } = props;
  const variants = useViewVariants(viewCtx, useShallow((state) => [state.frames, state.global]));
  const renderCount = useCanvasRenderCount(viewCtx);
  const metadataAlive = useParentStackItemInputs(viewCtx, selectable, false);
  const hover = useHoverVariantInputs(viewCtx, selectable, variants, renderCount);
  if (!metadataAlive || !hover.alive) { return null; }
  return <PreselectBoxStyled {...props} hover={hover} />;
}

function PreselectBoxStyled(props: Parameters<typeof PreselectBoxInner>[0] & {
  hover: ReturnType<typeof useHoverVariantInputs>;
}) {
  // Keep the hover manager's unthemed label and themed icon reads unchanged.
  return props.hover.provider
    ? <PreselectBoxStyleSubscriber {...props} provider={props.hover.provider} />
    : <PreselectBoxGeometry {...props} />;
}

function PreselectBoxStyleSubscriber(props: Parameters<typeof PreselectBoxStyled>[0] & { provider: NativeStyleProvider }) {
  useStyleCells(props.provider, ["display", "flex-direction"]);
  return <PreselectBoxGeometry {...props} />;
}

function PreselectBoxGeometry(props: Parameters<typeof PreselectBoxStyled>[0]) {
  const { selectable, studioCtx, viewCtx, isHoveredElt, $element, $focused, hover } = props;
  const viewportZoom = useCanvasZoom(studioCtx);
  const stackOfParents = useStudioOverlayState(studioCtx, (state) => state.stackOfParents);
  const alive = usePreselectLifetime(viewCtx);
  const hoverTagRef = React.useRef<HTMLDivElement>(null);
  const forceUpdate = useFrameForceUpdate(viewCtx.disposeSignal);
  const elements = useShallow((nodes: Element[]) => nodes)($element?.toArray() ?? []);
  React.useEffect(() => {
    if (!alive || !hover.alive || !elements.length) { return; }
    const doc = elements[0].ownerDocument;
    const resize = new ResizeObserver(forceUpdate);
    elements.forEach((element) => resize.observe(element));
    resize.observe(doc.documentElement);
    doc.addEventListener("scroll", forceUpdate, true);
    const styleSignal = studioCtx.styleChanged.add(forceUpdate), frames = studioCtx.framesChanged.add(forceUpdate);
    return () => { resize.disconnect(); doc.removeEventListener("scroll", forceUpdate, true); styleSignal.detach(); frames.detach(); };
  }, [elements, viewCtx, studioCtx, forceUpdate, hover.alive, alive]);

  const tpl = selectable.tpl;

  const shouldShowHoverTag =
    isHoveredElt && $element && (!$focused || !$element.is($focused));

  // Hover outlines show only what the user can see of the element.
  const scalerRect = alive ? computeScalerVisibility(
    ensure($element, "PreselectBoxInner requires a hovered element"),
    viewCtx,
  ).visible : undefined;
  const cssProps = cssPropsForInvertTransform(viewportZoom, scalerRect);

  const tagPlacement = useTagPlacement(
    hoverTagRef,
    scalerRect?.width ?? 0,
    viewportZoom,
    alive ? viewCtx : undefined,
  );

  if (!alive || !scalerRect) {
    return null;
  }

  const hoverVtm = hover.manager;
  const isTargetingSomeNonBaseVariant =
    hover.targeting;

  const effectiveVariantSetting =
    shouldShowHoverTag && isTplTagOrComponent(tpl)
      ? hoverVtm?.effectiveVariantSetting(tpl)
      : undefined;
  const tagName = shouldShowHoverTag
    ? summarizeFocusObj(selectable, viewCtx, effectiveVariantSetting)
    : undefined;
  const tagIcon =
    shouldShowHoverTag && createNodeIcon(tpl!, effectiveVariantSetting);

  return (
    <div
      className={cn("PreselectBox", {
        [styles.hoveringParentStack]: stackOfParents,
      })}
      data-original-width={scalerRect.width}
      data-original-height={scalerRect.height}
      style={{
        display: "block",
        ...scalerRect,
        ...cssProps,
      }}
    >
      <div
        className={styles.preselectBoxBorder}
        style={{
          borderColor: isTargetingSomeNonBaseVariant
            ? NON_BASE_VARIANT_COLOR
            : BASE_VARIANT_COLOR,
          ...(!isHoveredElt && {
            opacity: 0.1,
            borderWidth: "2px",
          }),
        }}
      />
      {shouldShowHoverTag && (
        <div className={styles.hoverBoxTagContainer} style={tagPlacement}>
          <div ref={hoverTagRef} className="node-outline-tag">
            {tagName && (
              <EditableNodeLabel
                studioCtx={studioCtx}
                displayName={tagName}
                icon={tagIcon}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** A prop from a retired model world cannot register against its replacement. */
function usePreselectLifetime(view: ViewCtx | undefined) {
  const scope = React.useMemo(() => view ? { view, models: view.studioCtx.modelSnapshots, signal: view.disposeSignal } : undefined, [view]);
  const subscribe = React.useCallback((listener: () => void) => {
    scope?.signal.addEventListener("abort", listener, { once: true });
    return () => scope?.signal.removeEventListener("abort", listener);
  }, [scope]);
  const snapshot = React.useCallback(() => !!scope && !scope.signal.aborted && scope.models === scope.view.studioCtx.modelSnapshots && scope.view.studioCtx.arenaState.isCurrentLifetime(scope.view.modelLifetime), [scope]);
  return React.useSyncExternalStore(subscribe, snapshot, snapshot);
}
