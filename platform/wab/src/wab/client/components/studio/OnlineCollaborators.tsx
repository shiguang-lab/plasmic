import { AnonymousAvatar, Avatar } from "@/wab/client/components/studio/Avatar";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ensure } from "@/wab/shared/common";
import { Popover } from "antd";
import * as React from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

const PlayerAvatar = React.memo(function PlayerAvatar({
  studioCtx,
  playerId,
}: {
  studioCtx: StudioCtx;
  playerId: number;
}) {
  const [type, user, color, focused] = useStore(
    studioCtx.multiplayerCtx.store,
    useShallow((state) => {
      const player = state.players.get(playerId);
      return [
        player?.type,
        player?.user,
        player?.color,
        player?.viewInfo?.arenaInfo?.focused,
      ] as const;
    }),
  );
  if (!type) {
    return null;
  }
  const canBeFollowed = !focused;
  const props = {
    className: "AvatarPlayer",
    style: {
      borderColor: canBeFollowed ? color : undefined,
    } as React.CSSProperties,
    tooltipPlacement: "bottom" as const,
    onClick: canBeFollowed
      ? () => studioCtx.setWatchPlayerId(playerId)
      : undefined,
  };
  return type === "AnonUser" ? (
    <AnonymousAvatar {...props} />
  ) : (
    <Avatar user={ensure(user, "Missing collaborator user")} {...props} />
  );
});

export function OnlineCollaborators({ studioCtx }: { studioCtx: StudioCtx }) {
  const playerIds = useStore(
    studioCtx.multiplayerCtx.store,
    (state) => state.playerIds,
  );
  if (!playerIds.length) {
    return null;
  }
  const avatars = (ids: readonly number[]) =>
    ids.map((playerId) => (
      <PlayerAvatar studioCtx={studioCtx} playerId={playerId} key={playerId} />
    ));
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 4 }}
      data-test-id="editor-collaborators"
    >
      {avatars(playerIds.slice(0, 3))}
      {playerIds.length > 3 && (
        <Popover
          placement="bottomRight"
          content={
            <div style={{ display: "flex", flexDirection: "column" }}>
              {avatars(playerIds.slice(3))}
            </div>
          }
        >
          <div className="Avatar AvatarPlayerSize">+{playerIds.length - 3}</div>
        </Popover>
      )}
    </div>
  );
}
