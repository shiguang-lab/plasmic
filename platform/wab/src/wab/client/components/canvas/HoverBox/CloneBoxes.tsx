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
import { isTplVariantable } from "@/wab/shared/core/tpls";
import Chroma from "@/wab/shared/utils/color-utils";
import $ from "jquery";
import { computed } from "mobx";
import { observer } from "mobx-react";
import * as React from "react";
export const CloneBoxes = observer(function CloneBoxes() {
  const studioCtx = useStudioCtx();
  useStudioSelection(studioCtx, (state) => state.view);
  const viewCtx = studioCtx.focusedViewCtx();
  useViewSelection(viewCtx, (state) => state.targets);
  const selectable = viewCtx?.focusedSelectable();
  const isUnlogged = useStudioSaveState(studioCtx, (state) => state.isUnlogged);
  const cloneKeys = isUnlogged
    ? []
    : (viewCtx?.selectableToCloneKeys(selectable) ?? []);

  const skip = !selectable;
  const needsRecompute = useRerenderOnUserBodyChange(studioCtx, viewCtx, skip);

  if (!viewCtx || !selectable) {
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

const CloneBox = observer(function CloneBox({
  cloneKey,
  selectable,
  viewCtx,
}: CloneBoxProps) {
  useViewVariants(viewCtx, useShallow((variantState) => [variantState.frames, variantState.global]));
  useViewSelection(viewCtx, useShallow((state) => [state.cloneKeys, state.doms]));
  const cloneSelectable = viewCtx.renderState.sel2clone(selectable, cloneKey);
  const $elt = maybes(cloneSelectable)((sel) =>
    viewCtx.renderState.sel2dom(sel, viewCtx.canvasCtx, cloneKey),
  )((dom) => $(dom))();
  const isTargetingSomeNonBaseVariant =
    isTplVariantable(selectable.tpl) &&
    viewCtx.variantTplMgr().isTargetingNonBaseVariant(selectable.tpl);

  const isFocusedClone = computed(
    () => viewCtx.focusedCloneKey() === cloneKey,
  ).get();
  const isFocusedElt = computed(() => {
    const focusedElt = viewCtx.focusedDomElt();
    return !!focusedElt && !!$elt && $elt.is($(focusedElt));
  }).get();

  const shouldShow =
    $elt &&
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
