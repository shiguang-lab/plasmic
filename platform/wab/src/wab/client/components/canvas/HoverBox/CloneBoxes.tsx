import { useCanvasRenderCount } from "@/wab/client/hooks/useCanvasRenderStatus";
import { useCloneVariantInputs } from "@/wab/client/components/canvas/HoverBox/clone-variant-inputs";
import { useFrameForceUpdate } from "@/wab/client/useForceUpdate";
import { useStudioSaveState } from "@/wab/client/studio-ctx/save-state";
import { useViewVariants } from "@/wab/client/studio-ctx/variant-state";
import { useStudioSelection, useViewSelection } from "@/wab/client/studio-ctx/selection-state";
import { useShallow } from "zustand/react/shallow";
import { CanvasTransformedBox } from "@/wab/client/components/canvas/CanvasTransformedBox";
import { useRerenderOnUserBodyChange } from "@/wab/client/components/canvas/UserBodyObserver";
import {
  BASE_VARIANT_COLOR,
  NON_BASE_VARIANT_COLOR,
} from "@/wab/client/components/studio/GlobalCssVariables";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { hasLayoutBox } from "@/wab/client/dom";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { maybes } from "@/wab/shared/common";
import { Selectable } from "@/wab/shared/core/selection";
import Chroma from "@/wab/shared/utils/color-utils";
import $ from "jquery";
import * as React from "react";
export const CloneBoxes = React.memo(function CloneBoxes() {
  const studioCtx = useStudioCtx();
  useStudioSelection(studioCtx, (state) => state.view);
  const viewCtx = studioCtx.focusedViewCtx();
  useViewSelection(viewCtx, useShallow((state) => [state.targets, state.cloneKeys]));
  useCanvasRenderCount(viewCtx);
  const scope = React.useMemo(() => viewCtx ? { models: studioCtx.modelSnapshots, signal: viewCtx.disposeSignal } : undefined, [viewCtx, studioCtx.modelSnapshots]);
  const active = !!scope && !!viewCtx && !scope.signal.aborted && scope.models === studioCtx.modelSnapshots && studioCtx.arenaState.isCurrentLifetime(viewCtx.modelLifetime);
  const selectable = active ? viewCtx?.focusedSelectable() : undefined;
  const isUnlogged = useStudioSaveState(studioCtx, (state) => state.isUnlogged);
  const cloneKeys = isUnlogged || !active
    ? []
    : (viewCtx?.selectableToCloneKeys(selectable) ?? []);

  const skip = !selectable || !active;
  const needsRecompute = useRerenderOnUserBodyChange(studioCtx, active ? viewCtx : undefined, skip);

  if (!active || !viewCtx || !selectable) {
    return null;
  }

  return (
    <>
      {cloneKeys.map((key) => (
        <CloneBox
          viewCtx={viewCtx}
          selectable={selectable}
          cloneKey={key}
          key={needsRecompute + "_" + key}
        />
      ))}
    </>
  );
});

interface CloneBoxProps {
  cloneKey: string;
  viewCtx: ViewCtx;
  selectable: Selectable;
}

const CloneBox = React.memo(function CloneBox({
  cloneKey,
  selectable,
  viewCtx,
}: CloneBoxProps) {
  const variants = useViewVariants(viewCtx, useShallow((state) => [state.frames, state.global]));
  useCanvasRenderCount(viewCtx);
  const input = useCloneVariantInputs(viewCtx, selectable.tpl, variants);
  useViewSelection(viewCtx, useShallow((state) => [state.cloneKeys, state.doms]));
  const cloneSelectable = input.alive ? viewCtx.renderState.sel2clone(selectable, cloneKey) : undefined;
  const $elt = maybes(cloneSelectable)((sel) =>
    viewCtx.renderState.sel2dom(sel, viewCtx.canvasCtx, cloneKey),
  )((dom) => $(dom))();
  const isTargetingSomeNonBaseVariant = input.targeting;
  const isFocusedClone = input.alive && viewCtx.focusedCloneKey() === cloneKey;
  const focusedElt = input.alive ? viewCtx.focusedDomElt() : undefined;
  const isFocusedElt = !!focusedElt && !!$elt && $elt.is($(focusedElt));
  const elements = useShallow((nodes: Element[]) => nodes)($elt?.toArray() ?? []);
  const refresh = useFrameForceUpdate(viewCtx.disposeSignal);
  React.useEffect(() => {
    if (!input.alive || !elements.length) { return; }
    const doc = elements[0].ownerDocument;
    const resize = new ResizeObserver(refresh);
    elements.forEach((element) => resize.observe(element));
    resize.observe(doc.documentElement);
    doc.addEventListener("scroll", refresh, true);
    const styles = viewCtx.studioCtx.styleChanged.add(refresh), frames = viewCtx.studioCtx.framesChanged.add(refresh);
    return () => { resize.disconnect(); doc.removeEventListener("scroll", refresh, true); styles.detach(); frames.detach(); };
  }, [elements, viewCtx, refresh, input.alive]);

  const shouldShow =
    input.alive && $elt &&
    !isFocusedClone &&
    $elt.length &&
    $elt.get(0).isConnected &&
    $elt.toArray().filter(hasLayoutBox).length > 0 &&
    !isFocusedElt;

  if (!shouldShow || !$elt) {
    return null;
  }

  const color = isTargetingSomeNonBaseVariant
    ? NON_BASE_VARIANT_COLOR
    : BASE_VARIANT_COLOR;
  return (
    <CanvasTransformedBox
      relativeTo={"arena"}
      $elt={$elt}
      viewCtx={viewCtx}
      className={"ElementHighlightBoxContainer"}
      // Repeated clones (e.g. table rows) often extend past the artboard.
      clipToVisible
    >
      <div
        className="ElementHighlightBoxRendered"
        style={{
          borderColor: Chroma(color).alpha(0.05).css(),
          backgroundColor: Chroma(color).alpha(0.05).css(),
        }}
      />
    </CanvasTransformedBox>
  );
});
