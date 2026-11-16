import { OnlineCollaborators } from "@/wab/client/components/studio/OnlineCollaborators";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { MultiplayerCtx } from "@/wab/client/studio-ctx/multiplayer-ctx";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import * as React from "react";
import { mock } from "vitest-mock-extended";

afterEach(cleanup);
async function fixture() {
  const ctx = mock<StudioCtx>();
  const multiplayer = new MultiplayerCtx(ctx);
  Object.defineProperty(ctx, "multiplayerCtx", { value: multiplayer });
  multiplayer.updateSelfId(1);
  return { ctx, multiplayer };
}
it("preserves following a collaborator after moving avatars into the top bar", async () => {
  const { ctx, multiplayer } = await fixture();
  await multiplayer.updateSessions([{ type: "AnonUser", playerId: 12 }]);
  const { container } = render(<OnlineCollaborators studioCtx={ctx} />);
  const avatar = container.querySelector(".AvatarPlayer");
  expect(avatar).toBeTruthy();
  if (avatar) {
    fireEvent.click(avatar);
  }
  expect(ctx.setWatchPlayerId).toHaveBeenCalledWith(12);
});
it("does not leave an empty toolbar slot without collaborators", async () => {
  const { ctx } = await fixture();
  const { container } = render(<OnlineCollaborators studioCtx={ctx} />);
  expect(container.childElementCount).toBe(0);
});
it("does not commit avatars for cursor, selection or viewport movement", async () => {
  const { ctx, multiplayer } = await fixture();
  const session = {
    type: "AnonUser" as const,
    playerId: 12,
    viewInfo: {
      arenaInfo: { type: "page" as const, uuidOrName: "page", focused: false },
      cursorInfo: { left: 0, top: 0 },
      positionInfo: { left: 0, top: 0, width: 800, height: 600 },
    },
  };
  await multiplayer.updateSessions([session]);
  const commits = vi.fn();
  const { container } = render(
    <React.Profiler id="presence" onRender={commits}>
      <OnlineCollaborators studioCtx={ctx} />
    </React.Profiler>,
  );
  commits.mockClear();
  for (let i = 1; i <= 30; i++) {
    await act(async () => {
      await multiplayer.updateSessions([
        {
          ...session,
          viewInfo: {
            ...session.viewInfo,
            cursorInfo: { left: i, top: i },
            selectionInfo: { selectableFrameUuid: "frame-" + i },
            positionInfo: { left: i, top: i, width: 800, height: 600 },
          },
        },
      ]);
    });
  }
  expect(commits).not.toHaveBeenCalled();
  await act(async () => {
    await multiplayer.updateSessions([
      {
        ...session,
        viewInfo: {
          ...session.viewInfo,
          arenaInfo: { ...session.viewInfo.arenaInfo, focused: true },
        },
      },
    ]);
  });
  expect(commits).toHaveBeenCalledOnce();
  const avatar = container.querySelector(".AvatarPlayer");
  if (!avatar) {
    throw new Error("Missing collaborator avatar");
  }
  fireEvent.click(avatar);
  expect(ctx.setWatchPlayerId).not.toHaveBeenCalled();
});

it("renders all collaborators and self in an overlapping Antd Avatar.Group without a count cap", async () => {
  const { ctx, multiplayer } = await fixture();
  await multiplayer.updateSessions([
    { type: "AnonUser", playerId: 11 },
    { type: "AnonUser", playerId: 12 },
    { type: "AnonUser", playerId: 13 },
    { type: "AnonUser", playerId: 14 },
  ]);
  const { container, getByText } = render(
    <OnlineCollaborators
      studioCtx={ctx}
      selfUser={{ displayName: "Me User", email: "me@example.com" }}
      includeSelf
    />,
  );
  const group = container.querySelector(".ant-avatar-group.editor-collaborator-group");
  expect(group).toBeTruthy();
  expect(group!.querySelectorAll(".AvatarPlayer")).toHaveLength(4);
  expect(group!.querySelectorAll(".Avatar")).toHaveLength(5);
  expect(getByText("ME")).toBeTruthy();
  expect(group!.textContent).not.toContain("+1");
});

it("renders self avatar inside Avatar.Group when no collaborators are online", async () => {
  const { ctx } = await fixture();
  const { container, rerender } = render(
    <OnlineCollaborators
      studioCtx={ctx}
      selfUser={{ displayName: "Alice", email: "alice@example.com" }}
      includeSelf
    />,
  );
  const group = container.querySelector(".ant-avatar-group.editor-collaborator-group");
  expect(group).toBeTruthy();
  expect(group!.querySelectorAll(".Avatar")).toHaveLength(1);
  expect(group!.textContent).toBe("AL");

  rerender(<OnlineCollaborators studioCtx={ctx} selfUser={null} includeSelf />);
  expect(container.querySelectorAll(".ant-avatar-group .Avatar")).toHaveLength(1);
});
