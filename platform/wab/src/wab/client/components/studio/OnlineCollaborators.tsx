import { AnonymousAvatar, Avatar } from "@/wab/client/components/studio/Avatar";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { CollaboratorAvatar } from "@/wab/client/studio-ctx/multiplayer-ctx";
import { Popover } from "antd";
import * as React from "react";
import { useStore } from "zustand";

const PlayerAvatar = React.memo(function PlayerAvatar({
  studioCtx,
  avatar,
}: {
  studioCtx: StudioCtx;
  avatar: CollaboratorAvatar;
}) {
  const { playerId, user, color, focused } = avatar;
  const props = {
    className: "AvatarPlayer",
    style: {
      borderColor: focused ? undefined : color,
    } as React.CSSProperties,
    tooltipPlacement: "bottom" as const,
    onClick:
      playerId !== undefined && !focused
        ? () => studioCtx.setWatchPlayerId(playerId)
        : undefined,
  };
  return user ? (
    <Avatar user={user} {...props} />
  ) : (
    <AnonymousAvatar {...props} />
  );
});

export function OnlineCollaborators({ studioCtx }: { studioCtx: StudioCtx }) {
  const avatars = useStore(
    studioCtx.multiplayerCtx.store,
    (state) => state.avatars,
  );
  if (!avatars.size) {
    return null;
  }
  const rows = Array.from(avatars, ([key, avatar]) => (
    <PlayerAvatar studioCtx={studioCtx} avatar={avatar} key={key} />
  ));
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 4 }}
      data-test-id="editor-collaborators"
    >
      {rows.slice(0, 3)}
      {rows.length > 3 && (
        <Popover
          placement="bottomRight"
          content={
            <div style={{ display: "flex", flexDirection: "column" }}>
              {rows.slice(3)}
            </div>
          }
        >
          <div className="Avatar AvatarPlayerSize">+{rows.length - 3}</div>
        </Popover>
      )}
    </div>
  );
}
