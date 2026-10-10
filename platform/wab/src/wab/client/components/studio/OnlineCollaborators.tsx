import { AnonymousAvatar, Avatar } from "@/wab/client/components/studio/Avatar";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { PlayerData } from "@/wab/client/studio-ctx/multiplayer-ctx";
import { Popover } from "antd";
import { observer } from "mobx-react";
import * as React from "react";

export const OnlineCollaborators = observer(
  ({ studioCtx }: { studioCtx: StudioCtx }) => {
    const allPlayers = studioCtx.multiplayerCtx.getAllPlayerData();
    if (allPlayers.length === 0) {
      return null;
    }
    // Keep overflow collaborators reachable without extending the toolbar.
    const players = allPlayers.slice(0, 3);
    const extraPlayers = allPlayers.slice(3);
    const playerAvatar = ([playerId, playerData]: [number, PlayerData]) => {
      // TODO: https://app.shortcut.com/plasmic/story/37322
      const canBeFollowed = !playerData.viewInfo?.arenaInfo?.focused;
      const styleOverrides = {
        className: "AvatarPlayer",
        style: {
          borderColor: canBeFollowed ? playerData.color : undefined,
        } as React.CSSProperties,
        tooltipPlacement: "bottom" as const,
      };
      const onClick = canBeFollowed
        ? () => studioCtx.setWatchPlayerId(playerId)
        : undefined;
      return playerData.type === "AnonUser" ? (
        <AnonymousAvatar {...styleOverrides} key={playerId} onClick={onClick} />
      ) : (
        <Avatar
          user={playerData.user}
          {...styleOverrides}
          key={playerId}
          onClick={onClick}
        />
      );
    };
    return (
      <div
        style={{ display: "flex", alignItems: "center", gap: 4 }}
        data-test-id="editor-collaborators"
      >
        {players.map(playerAvatar)}
        {extraPlayers.length > 0 && (
          <Popover
            placement="bottomRight"
            content={
              <div style={{ display: "flex", flexDirection: "column" }}>
                {extraPlayers.map(playerAvatar)}
              </div>
            }
          >
            <div className="Avatar AvatarPlayerSize">
              +{extraPlayers.length}
            </div>
          </Popover>
        )}
      </div>
    );
  },
);
