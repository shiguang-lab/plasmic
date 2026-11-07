import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { ServerPlayerInfo } from "@/wab/shared/ApiSchema";
import { waitFor } from "@testing-library/react";
import { createViewportFixture } from "@/wab/client/__testonly__/viewport";
import { ensure } from "@/wab/shared/common";
import { Pt } from "@/wab/shared/geom";

it("sends native viewport changes at a bounded cadence and cancels pending sends on socket shutdown", async () => {
  const { studioCtx, api } = fakeStudioCtx();
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  vi.spyOn(studioCtx, "canSendMultiplayerInfo").mockReturnValue(true);
  const viewport = ensure(createViewportFixture().viewportCtx, "Viewport");
  studioCtx.viewportCtx = viewport;
  let finishSocket: (event: undefined) => void = () => undefined;
  const waiting = new Promise<undefined>((resolve) => { finishSocket = resolve; });
  api.listenSocket.mockResolvedValueOnce({ eventName: "connect", data: undefined });
  api.listenSocket.mockImplementation(() => waiting);
  const listening = studioCtx.startListeningForSocketEvents();
  try {
    await waitFor(() => expect(api.emit).toHaveBeenCalledWith("view", expect.anything()));
    api.emit.mockClear();
    vi.useFakeTimers();
    viewport.setScroll(new Pt(10, 20));
    await vi.advanceTimersByTimeAsync(199);
    expect(api.emit).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(api.emit).toHaveBeenCalledExactlyOnceWith("view", expect.objectContaining({
      position: { left: 10, top: 20, width: 1000, height: 800, right: 1010, bottom: 820 },
    }));
    api.emit.mockClear();
    for (let i = 0; i < 100; i++) {viewport.setScroll(new Pt(10, 20));}
    await vi.advanceTimersByTimeAsync(400);
    expect(api.emit).not.toHaveBeenCalled();
    for (let i = 0; i < 8; i++) {
      viewport.setScroll(new Pt(100 + i, 200));
      await vi.advanceTimersByTimeAsync(50);
    }
    expect(api.emit).toHaveBeenCalledTimes(2);
    api.emit.mockClear();
    viewport.setScroll(new Pt(500, 600));
    await studioCtx.stopListeningForSocketEvents();
    await vi.advanceTimersByTimeAsync(400);
    expect(api.emit).not.toHaveBeenCalled();
  } finally {
    finishSocket(undefined);
    await studioCtx.stopListeningForSocketEvents();
    await listening;
    studioCtx.dispose();
    vi.useRealTimers();
    vi.restoreAllMocks();
  }
});

it("follows only position changes and releases the selected player on socket shutdown", async () => {
  const { studioCtx, api } = fakeStudioCtx();
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  vi.spyOn(studioCtx, "canSendMultiplayerInfo").mockReturnValue(false);
  const go = vi.spyOn(studioCtx, "goToPlayer").mockResolvedValue();
  let finishSocket: (event: undefined) => void = vi.fn();
  const waiting = new Promise<undefined>((resolve) => {
    finishSocket = resolve;
  });
  api.listenSocket.mockResolvedValueOnce({
    eventName: "connect",
    data: undefined,
  });
  api.listenSocket.mockImplementation(() => waiting);
  const listening = studioCtx.startListeningForSocketEvents();
  await waitFor(() => expect(api.listenSocket).toHaveBeenCalledTimes(2));
  const session: ServerPlayerInfo = {
    type: "AnonUser",
    playerId: 2,
    viewInfo: {
      arenaInfo: { type: "page", uuidOrName: "page", focused: false },
      positionInfo: { left: 0, top: 0, width: 800, height: 600 },
      cursorInfo: { left: 0, top: 0 },
    },
  };
  try {
    vi.useFakeTimers();
    await studioCtx.multiplayerCtx.updateSessions([session]);
    studioCtx.setWatchPlayerId(2);
    const subscribePosition = vi.spyOn(
      studioCtx.multiplayerCtx,
      "subscribePlayerPosition",
    );
    for (let i = 0; i < 100; i++) {studioCtx.setWatchPlayerId(2);}
    expect(subscribePosition).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    expect(go).toHaveBeenCalledExactlyOnceWith(2, true);
    go.mockClear();
    await studioCtx.multiplayerCtx.updateSessions([
      {
        ...session,
        viewInfo: { ...session.viewInfo, cursorInfo: { left: 100, top: 100 } },
      },
    ]);
    await vi.advanceTimersByTimeAsync(400);
    expect(go).not.toHaveBeenCalled();
    await studioCtx.multiplayerCtx.updateSessions([
      {
        ...session,
        viewInfo: {
          ...session.viewInfo,
          positionInfo: { left: 100, top: 100, width: 800, height: 600 },
        },
      },
    ]);
    await vi.advanceTimersByTimeAsync(199);
    expect(go).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(go).toHaveBeenCalledExactlyOnceWith(2, true);
    go.mockClear();
    // A stream must update at the existing cadence, not wait for movement to stop.
    for (let i = 0; i < 8; i++) {
      await studioCtx.multiplayerCtx.updateSessions([
        {
          ...session,
          viewInfo: {
            ...session.viewInfo,
            positionInfo: { left: 200 + i, top: 200, width: 800, height: 600 },
          },
        },
      ]);
      await vi.advanceTimersByTimeAsync(50);
    }
    expect(go).toHaveBeenCalledTimes(2);
    go.mockClear();
    await studioCtx.multiplayerCtx.updateSessions([
      {
        ...session,
        viewInfo: {
          ...session.viewInfo,
          positionInfo: { left: 200, top: 200, width: 800, height: 600 },
        },
      },
    ]);
    const replacement = { ...session, playerId: 3 };
    await studioCtx.multiplayerCtx.updateSessions([session, replacement]);
    studioCtx.setWatchPlayerId(3);
    await vi.advanceTimersByTimeAsync(200);
    expect(go).toHaveBeenCalledExactlyOnceWith(3, true);
    go.mockClear();
    await studioCtx.multiplayerCtx.updateSessions([
      session,
      {
        ...replacement,
        viewInfo: {
          ...replacement.viewInfo,
          positionInfo: { left: 1000, top: 0, width: 800, height: 600 },
        },
      },
    ]);
    await studioCtx.stopListeningForSocketEvents();
    await vi.advanceTimersByTimeAsync(400);
    expect(go).not.toHaveBeenCalled();
    finishSocket(undefined);
    await listening;
    await studioCtx.multiplayerCtx.updateSessions([session]);
    await vi.advanceTimersByTimeAsync(400);
    expect(go).not.toHaveBeenCalled();
  } finally {
    finishSocket(undefined);
    await studioCtx.stopListeningForSocketEvents();
    await listening;
    studioCtx.dispose();
    vi.useRealTimers();
    vi.restoreAllMocks();
  }
});
