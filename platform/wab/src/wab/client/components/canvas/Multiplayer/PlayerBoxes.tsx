import { computeScalerVisibility } from "@/wab/client/components/canvas/HoverBox/visible-bounds";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { hasLayoutBox } from "@/wab/client/dom";
import {
  cssPropsForInvertTransform,
  StudioCtx,
} from "@/wab/client/studio-ctx/StudioCtx";
import { useForceUpdate } from "@/wab/client/useForceUpdate";
import { getArenaFrames } from "@/wab/shared/Arenas";
import { maybe } from "@/wab/shared/common";
import $ from "jquery";
import { observer } from "mobx-react";
import * as React from "react";

export const PlayerBoxes = observer(function PlayerBoxes() {
  const studioCtx = useStudioCtx();
  return (
    <>
      {!studioCtx.editMode || !studioCtx.showMultiplayerSelections()
        ? null
        : studioCtx.multiplayerCtx
            .getAllPlayerIds()
            .map((playerId) => (
              <PlayerBox
                studioCtx={studioCtx}
                key={playerId}
                playerId={playerId}
              />
            ))}
    </>
  );
});

interface PlayerBoxProps {
  studioCtx: StudioCtx;
  playerId: number;
}

const PlayerBox = observer(function PlayerBox({
  studioCtx,
  playerId,
}: PlayerBoxProps) {
  const maybeData = (() => {
    const multiplayerCtx = studioCtx.multiplayerCtx;
    const playerData = multiplayerCtx.getPlayerDataById(playerId);
    if (
      !multiplayerCtx.knowsSelf() ||
      !playerData ||
      !playerData.viewInfo?.selectionInfo?.selectableFrameUuid
    ) {
      return null;
    }
    const branch = studioCtx.branchInfo();
    if (playerData.viewInfo?.branchId !== branch?.id) {
      return null;
    }
    const viewCtx = tryGetViewCtxFromFrameUuid(
      studioCtx,
      playerData.viewInfo.selectionInfo.selectableFrameUuid,
    );
    if (!viewCtx) {
      return null;
    }
    const selectable = viewCtx.getSelectableFromSelectionId(
      playerData.viewInfo.selectionInfo.selectableKey,
    );
    if (!selectable) {
      return null;
    }
    return {
      $elt: maybe(
        viewCtx.renderState.sel2dom(selectable, viewCtx.canvasCtx),
        (dom) => $(dom),
      ),
      viewCtx,
      playerData,
    };
  })();

  const $elt = maybeData?.$elt;

  const forceUpdate = useForceUpdate();

  React.useEffect(() => {
    if ($elt && $elt.length > 0) {
      const resizeObserver = new ResizeObserver(forceUpdate);
      const elts = $elt.toArray();
      elts.forEach((elt) => resizeObserver.observe(elt));
      // Scrolling moves the element and changes which part of it is visible.
      const doc = elts[0].ownerDocument;
      doc.addEventListener("scroll", forceUpdate, true);
      return () => {
        resizeObserver.disconnect();
        doc.removeEventListener("scroll", forceUpdate, true);
      };
    } else {
      return undefined;
    }
  }, [$elt]);

  if (!maybeData || !$elt || $elt.toArray().filter(hasLayoutBox).length === 0) {
    return null;
  }

  const { viewCtx, playerData } = maybeData;

  // Like the local selection, outline only the visible part of the element.
  const { visible: scalerRect } = computeScalerVisibility($elt, viewCtx);
  if (!scalerRect) {
    return null;
  }
  const cssProps = cssPropsForInvertTransform(studioCtx.zoom, scalerRect);

  return (
    <div
      className={"PlayerBox"}
      data-original-width={scalerRect.width}
      data-original-height={scalerRect.height}
      style={{
        display: "block",
        ...scalerRect,
        ...cssProps,
        borderColor: playerData.color,
      }}
    />
  );
});

export function tryGetViewCtxFromFrameUuid(
  studioCtx: StudioCtx,
  selectableFrameUuid: string,
) {
  return studioCtx.tryGetViewCtxForFrame(
    getArenaFrames(studioCtx.currentArena).find(
      (frame) => frame.uuid === selectableFrameUuid,
    ),
  );
}
