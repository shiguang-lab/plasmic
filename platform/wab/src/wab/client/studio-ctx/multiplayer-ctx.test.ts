import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { MultiplayerCtx } from "@/wab/client/studio-ctx/multiplayer-ctx";
import { ApiUser, ServerPlayerInfo, UserId } from "@/wab/shared/ApiSchema";
import { ensure } from "@/wab/shared/common";
import { mock, mockDeep } from "vitest-mock-extended";

function fixture() {
  const studio = mockDeep<StudioCtx>();
  const users = ["first", "replacement", "self"].map((name) =>
    mock<ApiUser>({ id: name as UserId, displayName: name }),
  );
  studio.appCtx.api.getUsersById.mockImplementation(async (ids) => ({
    users: ids.map((id) =>
      ensure(
        users.find((user) => user.id === id),
        "Unknown test user",
      ),
    ),
  }));
  const ctx = new MultiplayerCtx(studio);
  ctx.updateSelfId(1);
  return { ctx, api: studio.appCtx.api };
}
const player = (playerId = 2): ServerPlayerInfo => ({
  type: "AnonUser",
  playerId,
  viewInfo: {
    arenaInfo: { type: "page", uuidOrName: "page", focused: false },
    positionInfo: { left: 0, top: 0, width: 800, height: 600 },
    cursorInfo: { left: 10, top: 20 },
    selectionInfo: { selectableFrameUuid: "frame" },
  },
});

it("skips equal session updates and preserves per-player and field references", async () => {
  const f = fixture();
  const input = [player(), player(3)];
  await f.ctx.updateSessions(input);
  const before = f.ctx.store.getState();
  const notified = vi.fn();
  const off = f.ctx.store.subscribe(notified);
  for (let i = 0; i < 100; i++) {
    await f.ctx.updateSessions(structuredClone(input));
  }
  expect(f.ctx.store.getState()).toBe(before);
  expect(notified).not.toHaveBeenCalled();
  const next = structuredClone(input);
  if (!next[0].viewInfo?.cursorInfo) {
    throw new Error("Missing cursor fixture");
  }
  next[0].viewInfo.cursorInfo.left++;
  await f.ctx.updateSessions(next);
  const after = f.ctx.store.getState();
  expect(after.playerIds).toBe(before.playerIds);
  expect(after.players.get(3)).toBe(before.players.get(3));
  expect(after.players.get(2)?.viewInfo?.selectionInfo).toBe(
    before.players.get(2)?.viewInfo?.selectionInfo,
  );
  expect(after.players.get(2)?.viewInfo?.arenaInfo).toBe(
    before.players.get(2)?.viewInfo?.arenaInfo,
  );
  expect(after.players.get(2)?.viewInfo?.cursorInfo?.left).toBe(11);
  expect(before.players.get(2)?.viewInfo?.cursorInfo?.left).toBe(10);
  expect(notified).toHaveBeenCalledOnce();
  next[0].viewInfo.cursorInfo.left = 999;
  expect(after.players.get(2)?.viewInfo?.cursorInfo?.left).toBe(11);
  expect(f.api.getUsersById).not.toHaveBeenCalled();
  off();
});

it("fetches each missing user once and handles reconnects with a changed identity", async () => {
  const f = fixture();
  const userId = "first" as UserId;
  await f.ctx.updateSessions([
    { type: "NormalUser", playerId: 1, userId: "self" as UserId },
    { type: "NormalUser", playerId: 2, userId },
    { type: "NormalUser", playerId: 3, userId },
  ]);
  expect(f.api.getUsersById).toHaveBeenCalledExactlyOnceWith([userId]);
  expect(f.ctx.store.getState().playerIds).toEqual([2, 3]);
  const identity = f.ctx.store.getState().players.get(3)?.user;
  expect(f.ctx.store.getState().players.get(2)?.user).toBe(identity);
  await f.ctx.updateSessions([
    { type: "NormalUser", playerId: 2, userId: "replacement" as UserId },
  ]);
  expect(f.api.getUsersById).toHaveBeenLastCalledWith(["replacement"]);
  expect(f.ctx.getPlayerDataById(2)?.user?.id).toBe("replacement");
  expect(f.ctx.store.getState().playerIds).toEqual([2]);
  await f.ctx.updateSessions([player(2)]);
  expect(f.ctx.getPlayerDataById(2)?.type).toBe("AnonUser");
  expect(f.ctx.getPlayerDataById(2)?.user).toBeUndefined();
});

it("only sends follow notifications for the selected player's presence, arena or position", async () => {
  const f = fixture();
  await f.ctx.updateSessions([player(), player(3)]);
  const update = vi.fn();
  const off = f.ctx.subscribePlayerPosition(2, update);
  expect(update).toHaveBeenCalledOnce();
  update.mockClear();
  const next = [player(), player(3)];
  if (!next[0].viewInfo || !next[1].viewInfo) {
    throw new Error("Missing view fixture");
  }
  next[0].viewInfo.cursorInfo = { left: 40, top: 50 };
  next[0].viewInfo.selectionInfo = { selectableFrameUuid: "other-frame" };
  next[1].viewInfo.positionInfo = {
    left: 500,
    top: 600,
    width: 800,
    height: 600,
  };
  await f.ctx.updateSessions(next);
  expect(update).not.toHaveBeenCalled();
  next[0].viewInfo.positionInfo = { left: 5, top: 5, width: 800, height: 600 };
  await f.ctx.updateSessions(next);
  expect(update).toHaveBeenCalledOnce();
  update.mockClear();
  await f.ctx.updateSessions([player(3)]);
  expect(update).toHaveBeenCalledOnce();
  off();
  update.mockClear();
  await f.ctx.updateSessions([player()]);
  expect(update).not.toHaveBeenCalled();
});

it("removes the local player atomically and does not publish an unchanged self ID", async () => {
  const f = fixture();
  await f.ctx.updateSessions([player(), player(3)]);
  const before = f.ctx.store.getState();
  f.ctx.updateSelfId(1);
  expect(f.ctx.store.getState()).toBe(before);
  const notified = vi.fn();
  const off = f.ctx.store.subscribe(notified);
  f.ctx.updateSelfId(2);
  expect(f.ctx.store.getState().playerIds).toEqual([3]);
  expect(f.ctx.getPlayerDataById(2)).toBeUndefined();
  expect(f.ctx.getPlayerDataById(3)).toBe(before.players.get(3));
  expect(notified).toHaveBeenCalledOnce();
  off();
});

it("keeps independent project connection stores isolated", async () => {
  const first = fixture();
  const other = fixture();
  const before = other.ctx.store.getState();
  const notified = vi.fn();
  const off = other.ctx.store.subscribe(notified);
  await first.ctx.updateSessions([player()]);
  expect(other.ctx.store.getState()).toBe(before);
  expect(notified).not.toHaveBeenCalled();
  off();
});

it("uses the current connection identity when user lookup finishes after initServerInfo", async () => {
  const f = fixture();
  let finish: (users: ApiUser[]) => void = vi.fn();
  const pending = new Promise<ApiUser[]>((resolve) => {
    finish = resolve;
  });
  f.api.getUsersById.mockImplementationOnce(async () => ({
    users: await pending,
  }));
  const fetching = f.ctx.updateSessions([
    { type: "NormalUser", playerId: 2, userId: "first" as UserId },
  ]);
  f.ctx.updateSelfId(2);
  const current = f.ctx.store.getState();
  finish([mock<ApiUser>({ id: "first" as UserId })]);
  await fetching;
  expect(f.ctx.store.getState()).toBe(current);
  expect(f.ctx.getPlayerDataById(2)).toBeUndefined();
});

it("keeps follow selection independent of session packets, equal writes and other editors", async () => {
  const first = fixture().ctx;
  const second = fixture().ctx;
  const changed = vi.fn();
  const other = vi.fn();
  const off = first.followStore.subscribe(changed);
  const offOther = second.followStore.subscribe(other);
  first.setFollowedPlayer(2);
  for (let i = 0; i < 100; i++) {
    first.setFollowedPlayer(2);
    await first.updateSessions([
      { ...player(), viewInfo: { cursorInfo: { left: i, top: i } } },
    ]);
  }
  expect(changed).toHaveBeenCalledExactlyOnceWith(2, null);
  expect(other).not.toHaveBeenCalled();
  expect(second.followStore.getState()).toBeNull();
  off();
  offOther();
  changed.mockClear();
  first.setFollowedPlayer(null);
  expect(changed).not.toHaveBeenCalled();
});
