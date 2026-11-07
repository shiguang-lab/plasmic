import { useContentEditorScope } from "@/wab/client/studio-ctx/canvas-content-editor";
import { useStudioOverlayState } from "@/wab/client/studio-ctx/studio-overlay-state";
import { useStudioSaveState } from "@/wab/client/studio-ctx/save-state";
import { useStudioArena, useViewEntryForFrame } from "@/wab/client/studio-ctx/arena-state";
import { useCanvasZoom } from "@/wab/client/studio-ctx/viewport-state";
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
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

export function PlayerBoxes() {
  const studioCtx = useStudioCtx();
  const multiplayerSelections = useStudioOverlayState(studioCtx, (state) => state.multiplayerSelections);
  const editMode = useStudioSaveState(studioCtx, (state) => state.editMode);
  const playerIds = useStore(
    studioCtx.multiplayerCtx.store,
    (state) => state.playerIds,
  );
  return (
    <>
      {!editMode || !multiplayerSelections
        ? null
        : playerIds.map((playerId) => (
            <PlayerBox
              studioCtx={studioCtx}
              key={playerId}
              playerId={playerId}
            />
          ))}
    </>
  );
}

interface PlayerBoxProps {
  studioCtx: StudioCtx;
  playerId: number;
}

const PlayerBox = observer(function PlayerBox({
  studioCtx,
  playerId,
}: PlayerBoxProps) {
  useContentEditorScope(studioCtx);
  useStudioArena(studioCtx, (state) => state.frames);
  const viewportZoom = useCanvasZoom(studioCtx);
  const [color, knowsSelf, selectionInfo, branchId] = useStore(
    studioCtx.multiplayerCtx.store,
    useShallow((state) => {
      const player = state.players.get(playerId);
      return [
        player?.color,
        state.selfId !== -1,
        player?.viewInfo?.selectionInfo,
        player?.viewInfo?.branchId,
      ] as const;
    }),
  );
  const frame =
    knowsSelf && color && selectionInfo?.selectableFrameUuid
      ? getArenaFrames(studioCtx.currentArena).find(
          (candidate) => candidate.uuid === selectionInfo.selectableFrameUuid,
        )
      : undefined;
  const viewEntry = useViewEntryForFrame(studioCtx, frame);
  const maybeData = (() => {
    if (!frame || !knowsSelf || !color || !selectionInfo?.selectableFrameUuid) {
      return null;
    }
    const branch = studioCtx.branchInfo();
    if (branchId !== branch?.id) {
      return null;
    }
    const viewCtx = viewEntry?.view;
    if (!viewCtx) {
      return null;
    }
    const selectable = viewCtx.getSelectableFromSelectionId(
      selectionInfo.selectableKey,
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
      color,
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

  const { viewCtx } = maybeData;

  // Like the local selection, outline only the visible part of the element.
  const { visible: scalerRect } = computeScalerVisibility($elt, viewCtx);
  if (!scalerRect) {
    return null;
  }
  const cssProps = cssPropsForInvertTransform(viewportZoom, scalerRect);

  return (
    <div
      className={"PlayerBox"}
      data-original-width={scalerRect.width}
      data-original-height={scalerRect.height}
      style={{
        display: "block",
        ...scalerRect,
        ...cssProps,
        borderColor: color,
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
