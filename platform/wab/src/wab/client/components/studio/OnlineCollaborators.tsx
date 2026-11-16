import { AnonymousAvatar, Avatar } from "@/wab/client/components/studio/Avatar";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { CollaboratorAvatar } from "@/wab/client/studio-ctx/multiplayer-ctx";
import type { ApiUser } from "@/wab/shared/ApiSchema";
import { Avatar as AntAvatar } from "antd";
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

export function OnlineCollaborators({
  studioCtx,
  selfUser,
  includeSelf = false,
}: {
  studioCtx: StudioCtx;
  selfUser?: Pick<ApiUser, "displayName" | "email"> | null;
  includeSelf?: boolean;
}) {
  const avatars = useStore(
    studioCtx.multiplayerCtx.store,
    (state) => state.avatars,
  );
  if (!avatars.size && !includeSelf) {
    return null;
  }
  const rows = Array.from(avatars, ([key, avatar]) => (
    <PlayerAvatar studioCtx={studioCtx} avatar={avatar} key={key} />
  ));
  if (includeSelf) {
    rows.push(
      selfUser ? (
        <Avatar key="self" user={selfUser} />
      ) : (
        <AnonymousAvatar key="self" />
      ),
    );
  }
  return (
    <div
      data-test-id="editor-collaborators"
      style={{ display: "inline-flex", alignItems: "center" }}
    >
      <AntAvatar.Group className="editor-collaborator-group">
        {rows}
      </AntAvatar.Group>
    </div>
  );
}
