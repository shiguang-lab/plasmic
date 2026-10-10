import { OnlineCollaborators } from "@/wab/client/components/studio/OnlineCollaborators";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { MultiplayerCtx } from "@/wab/client/studio-ctx/multiplayer-ctx";
import { cleanup, fireEvent, render } from "@testing-library/react";
import * as React from "react";
import { mock } from "vitest-mock-extended";

afterEach(cleanup);
it("preserves following a collaborator after moving avatars into the top bar", () => {
  const ctx = mock<StudioCtx>();
  const multiplayer = mock<MultiplayerCtx>();
  Object.defineProperty(ctx, "multiplayerCtx", { value: multiplayer });
  multiplayer.getAllPlayerData.mockReturnValue([
    [12, { type: "AnonUser", color: "#8E4EC6" }],
  ]);
  const { container } = render(<OnlineCollaborators studioCtx={ctx} />);
  const avatar = container.querySelector(".AvatarPlayer");
  expect(avatar).toBeTruthy();
  if (avatar) {
    fireEvent.click(avatar);
  }
  expect(ctx.setWatchPlayerId).toHaveBeenCalledWith(12);
});
it("does not leave an empty toolbar slot without collaborators", () => {
  const ctx = mock<StudioCtx>();
  const multiplayer = mock<MultiplayerCtx>();
  Object.defineProperty(ctx, "multiplayerCtx", { value: multiplayer });
  multiplayer.getAllPlayerData.mockReturnValue([]);
  const { container } = render(<OnlineCollaborators studioCtx={ctx} />);
  expect(container.childElementCount).toBe(0);
});
