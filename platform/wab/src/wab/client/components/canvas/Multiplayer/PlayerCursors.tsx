import { useStudioOverlayState } from "@/wab/client/studio-ctx/studio-overlay-state";
import { useStudioSaveState } from "@/wab/client/studio-ctx/save-state";
import { useStudioArena } from "@/wab/client/studio-ctx/arena-state";
import { useStudioLiveMode } from "@/wab/client/studio-ctx/studio-mode-state";
import MultiplayerCursor from "@/wab/client/components/canvas/Multiplayer/MultiplayerCursor";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewportCtx } from "@/wab/client/studio-ctx/ViewportCtx";
import { getArenaType, getArenaUuidOrName } from "@/wab/shared/Arenas";
import { Pt } from "@/wab/shared/geom";
import { PerfectCursor } from "perfect-cursors";
import * as React from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

export function PlayerCursors() {
  const studioCtx = useStudioCtx();
  const multiplayerSelections = useStudioOverlayState(studioCtx, (state) => state.multiplayerSelections);
  const editMode = useStudioSaveState(studioCtx, (state) => state.editMode);
  const liveMode = useStudioLiveMode(studioCtx);
  const viewportCtx = useStore(studioCtx.viewportOwnerStore);
  const playerIds = useStore(
    studioCtx.multiplayerCtx.store,
    (state) => state.playerIds,
  );
  if (
    !viewportCtx ||
    !editMode ||
    liveMode ||
    !multiplayerSelections
  ) {
    return null;
  }
  return (
    <>
      {playerIds.map((playerId) => (
        <PlayerCursor
          studioCtx={studioCtx}
          viewportCtx={viewportCtx}
          key={playerId}
          playerId={playerId}
        />
      ))}
    </>
  );
}

interface PlayerCursorProps {
  studioCtx: StudioCtx;
  viewportCtx: ViewportCtx;
  playerId: number;
}

const PlayerCursor = React.memo(function PlayerCursor({
  studioCtx,
  viewportCtx,
  playerId,
}: PlayerCursorProps) {
  const [scale, canvasPadding, scroll] = useStore(viewportCtx.store,
    useShallow((state) => [state.scale, state.canvasPadding, state.scroll] as const));
  const multiplayerCtx = studioCtx.multiplayerCtx;
  const [color, userName, knowsSelf, cursorData, branchId, arenaInfo] =
    useStore(
      multiplayerCtx.store,
      useShallow((state) => {
        const player = state.players.get(playerId);
        return [
          player?.color,
          player?.user?.displayName ?? "Anonymous",
          state.selfId !== -1,
          player?.viewInfo?.cursorInfo,
          player?.viewInfo?.branchId,
          player?.viewInfo?.arenaInfo,
        ] as const;
      }),
    );
  useStudioArena(studioCtx, (state) => state.current);
  useStudioArena(studioCtx, (state) => state.name);
  const focusedMode = useStudioArena(studioCtx, (state) => state.focusedMode);
  const activeArena = studioCtx.currentArena;
  const currentBranchId = useStore(studioCtx.uiEnvironment.store, (state) => state.branchId);
  if (!knowsSelf || !cursorData || !color || !activeArena) {
    return null;
  }

  const arenaType = getArenaType(activeArena);
  const arenaUuidOrName = getArenaUuidOrName(activeArena);
  const clipper = studioCtx.maybeCanvasClipper();

  if (
    branchId !== (currentBranchId ?? undefined) ||
    arenaInfo?.type !== arenaType ||
    arenaInfo.uuidOrName !== arenaUuidOrName ||
    !clipper
  ) {
    return null;
  }

  // TODO: https://app.shortcut.com/plasmic/story/37322
  if (focusedMode || arenaInfo?.focused) {
    return null;
  }

  const pt = new Pt(cursorData.left, cursorData.top).scale(scale).plus(canvasPadding).sub(scroll);

  const dataTestId = userName.replace(/[^a-zA-Z0-9-]/g, "");

  return (
    <AnimatedCursor
      point={pt}
      userName={userName}
      data-test-id={dataTestId}
      color={color}
    />
  );
});

const AnimatedCursor = React.memo(function AnimatedCursor(props: {
  point: Pt;
  userName: string;
  color: string;
  "data-test-id": string;
}) {
  const { point, userName, color } = props;
  const rCursor = React.useRef<HTMLDivElement>(null);
  const animateCursor = React.useCallback((p: number[]) => {
    const elm = rCursor.current;
    if (!elm) {
      return;
    }
    elm.style.setProperty(
      "transform",
      `translate3d(${p[0]}px, ${p[1]}px, 0px)`,
    );
  }, []);

  const onPointMove = usePerfectCursor(animateCursor);

  React.useLayoutEffect(
    () => onPointMove([point.x, point.y]),
    [onPointMove, point],
  );

  return (
    <MultiplayerCursor
      ref={rCursor}
      className="PlayerCursor"
      hexColor={color}
      name={userName}
      data-test-id={props["data-test-id"]}
    />
  );
});

function usePerfectCursor(cb: (point: number[]) => void, point?: number[]) {
  const [pc] = React.useState(() => new PerfectCursor(cb));

  React.useLayoutEffect(() => {
    if (point) {
      pc.addPoint(point);
    }
    return () => pc.dispose();
  }, [pc]);

  const onPointChange = React.useCallback(
    (p: number[]) => pc.addPoint(p),
    [pc],
  );

  return onPointChange;
}
