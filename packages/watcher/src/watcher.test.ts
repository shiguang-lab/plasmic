import { describe, expect, it, vi } from "vitest";

const sockets: Array<{
  handlers: Record<string, (...args: any[]) => void>;
  emit: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  on: (event: string, cb: (...args: any[]) => void) => void;
}> = [];

vi.mock("socket.io-client", () => ({
  default: vi.fn(() => {
    const handlers: Record<string, (...args: any[]) => void> = {};
    const sock = {
      handlers,
      emit: vi.fn(),
      disconnect: vi.fn(),
      on: (event: string, cb: (...args: any[]) => void) => {
        handlers[event] = cb;
      },
    };
    sockets.push(sock);
    return sock;
  }),
}));

import { PlasmicRemoteChangeWatcher } from "./watcher";

describe("PlasmicRemoteChangeWatcher", () => {
  it("shares a single socket across synchronous subscriptions and disconnects on last unsubscribe", () => {
    sockets.length = 0;
    const watcher = new PlasmicRemoteChangeWatcher({
      projects: [{ id: "p1", token: "t1" }],
    });
    const updatesA: number[] = [];
    const updatesB: number[] = [];

    const unsubA = watcher.subscribe({
      onUpdate: (_id, rev) => updatesA.push(rev),
    });
    const unsubB = watcher.subscribe({
      onUpdate: (_id, rev) => updatesB.push(rev),
    });

    expect(sockets).toHaveLength(1);
    sockets[0].handlers.update?.({ projectId: "p1", revisionNum: 7 });
    expect(updatesA).toEqual([7]);
    expect(updatesB).toEqual([7]);

    unsubA();
    expect(sockets[0].disconnect).not.toHaveBeenCalled();

    unsubB();
    expect(sockets[0].disconnect).toHaveBeenCalledTimes(1);
  });

  it("disconnects immediately when subscribed and unsubscribed synchronously", () => {
    sockets.length = 0;
    const watcher = new PlasmicRemoteChangeWatcher({
      projects: [{ id: "p1", token: "t1" }],
    });
    const unsub = watcher.subscribe({});
    expect(sockets).toHaveLength(1);
    unsub();
    expect(sockets[0].disconnect).toHaveBeenCalledTimes(1);
  });
});
