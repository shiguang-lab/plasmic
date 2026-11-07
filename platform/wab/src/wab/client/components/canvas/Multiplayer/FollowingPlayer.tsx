import MultiplayerFollowingBorder from "@/wab/client/components/canvas/Multiplayer/MultiplayerFollowingBorder";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import React from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

export const FollowingPlayer = React.memo(function FollowingPlayer({
  studioCtx,
}: {
  studioCtx: StudioCtx;
}) {
  "use memo";
  const id = useStore(studioCtx.multiplayerCtx.followStore, (state) => state);
  const [present, name, color] = useStore(
    studioCtx.multiplayerCtx.store,
    useShallow((state) => {
      const player = id === null ? undefined : state.players.get(id);
      return [
        !!player,
        player?.user?.displayName ?? "Anon",
        player?.color,
      ] as const;
    }),
  );
  return present && color ? (
    <MultiplayerFollowingBorder
      className="canvas-editor__watch-mode"
      name={name}
      hexColor={color}
    />
  ) : null;
});
