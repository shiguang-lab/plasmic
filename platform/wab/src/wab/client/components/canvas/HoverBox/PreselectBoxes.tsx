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
import { useForceUpdate } from "@/wab/client/useForceUpdate";
import { summarizeFocusObj } from "@/wab/client/utils/tpl-client-utils";
import { ensure } from "@/wab/shared/common";
import {
  SQ,
  Selectable,
  makeSelectableFullKey,
} from "@/wab/shared/core/selection";
import { isTplTagOrComponent, isTplVariantable } from "@/wab/shared/core/tpls";
import cn from "classnames";
import $ from "jquery";
import { observer } from "mobx-react";
import React from "react";

export const PreselectBoxes = observer(PreselectBoxes_);
function PreselectBoxes_() {
  const studioCtx = useStudioCtx();
  useContentEditorScope(studioCtx);
  const transforming = useCanvasTransforming(studioCtx);
  const ancestorsHoverBoxes = useStudioOverlayState(studioCtx, (state) => state.ancestorsHoverBoxes);
  const forceUpdate = useForceUpdate();

  const viewCtx = useHoveredViewCtx(studioCtx);
  useViewSelection(viewCtx, useShallow((state) => [state.hover, state.hoverDom]));
  const doc = viewCtx?.canvasCtx.$doc()[0];
  React.useEffect(() => {
    if (!doc?.body) {
      return;
    }
    let previous = getActiveCanvasModal(doc);
    const modalObserver = new MutationObserver(() => {
      const current = getActiveCanvasModal(doc);
      if (current !== previous) {
        previous = current;
        forceUpdate();
      }
    });
    modalObserver.observe(doc.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "style", "aria-modal"],
    });
    return () => modalObserver.disconnect();
  }, [doc, forceUpdate]);

  if (transforming) {
    return null;
  }
  const modal = getActiveCanvasModal(doc);

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

export const PreselectBox = observer(PreselectBox_);
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
  useStudioOverlayState(studioCtx, (state) => state.screenshotting);
  const stackOfParents = useStudioOverlayState(studioCtx, (state) => state.stackOfParents);
  useStudioSelection(studioCtx, (state) => state.view);
  useViewVariants(viewCtx, useShallow((state) => [state.frames, state.global]));
  useViewSelection(viewCtx, useShallow((state) => [state.doms, state.hoverDom]));

  const $selection = viewCtx?.selectionDom(selectable, cloneKey) ?? undefined;
  const $hovered = viewCtx?.$hoveredDomElt();
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
    viewCtx === studioCtx.focusedViewCtx() && viewCtx?.focusedDomElt();

  const shouldShow =
    viewCtx &&
    viewCtx.contentEditor.contains(selectable) &&
    !draggingObject &&
    !studioCtx.shouldHidePreselectBox() &&
    $element?.length &&
    $element?.get(0).isConnected &&
    $element?.toArray().filter(hasLayoutBox)?.length > 0 &&
    (stackOfParents || !$focused || !$element.is($focused));

  if (!shouldShow) {
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
  const { selectable, studioCtx, viewCtx, isHoveredElt, $element, $focused } =
    props;
  const viewportZoom = useCanvasZoom(studioCtx);
  const stackOfParents = useStudioOverlayState(studioCtx, (state) => state.stackOfParents);

  const hoverTagRef = React.useRef<HTMLDivElement>(null);
  const forceUpdate = useForceUpdate();
  React.useEffect(() => {
    const doc = viewCtx.canvasCtx.$doc()[0];
    doc.addEventListener("scroll", forceUpdate, true);
    return () => doc.removeEventListener("scroll", forceUpdate, true);
  }, [viewCtx, forceUpdate]);

  const tpl = selectable.tpl;

  const shouldShowHoverTag =
    isHoveredElt && $element && (!$focused || !$element.is($focused));

  // Hover outlines show only what the user can see of the element.
  const { visible: scalerRect } = computeScalerVisibility(
    ensure($element, "PreselectBoxInner requires a hovered element"),
    viewCtx,
  );
  const cssProps = cssPropsForInvertTransform(viewportZoom, scalerRect);

  const tagPlacement = useTagPlacement(
    hoverTagRef,
    scalerRect?.width ?? 0,
    viewportZoom,
    viewCtx,
  );

  if (!scalerRect) {
    return null;
  }

  const hoverVtm = viewCtx.hoverVariantTplMgr(selectable);
  const isTargetingSomeNonBaseVariant =
    isTplVariantable(tpl) && hoverVtm.isTargetingNonBaseVariant(tpl);

  const effectiveVariantSetting =
    shouldShowHoverTag && isTplTagOrComponent(tpl)
      ? hoverVtm.effectiveVariantSetting(tpl)
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
