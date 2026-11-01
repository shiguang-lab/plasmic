import type { Config } from "@/wab/server/config";
import { ANON_USER, DbMgr, normalActor } from "@/wab/server/db/DbMgr";
import { Project } from "@/wab/server/entities/Entities";
import { ProjectsSocket } from "@/wab/server/routes/projects-socket";
import { UserId } from "@/wab/shared/ApiSchema";
import type { BroadcastPayload } from "@/wab/shared/api/socket";
import { Connection, EntityManager } from "typeorm";
import { mockDeep } from "vitest-mock-extended";

const state = vi.hoisted(() => ({
  transaction: vi.fn(),
  query: vi.fn(),
  fetchSockets: vi.fn(),
}));
vi.mock("typeorm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("typeorm")>()),
  getConnection: () => ({ transaction: state.transaction, query: state.query }),
}));
vi.mock("socket.io", () => ({
  Server: class {
    use() {}
    on() {}
    in() {
      return { fetchSockets: state.fetchSockets };
    }
  },
}));
vi.mock("prom-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("prom-client")>()),
  Gauge: class {},
}));

beforeEach(() => {
  const manager = new EntityManager(mockDeep<Connection>());
  state.transaction.mockImplementation(async (callback) => callback(manager));
  state.query.mockResolvedValue([
    { projectId: "private-project", seq: 1, payload: {} },
  ]);
  vi.spyOn(
    DbMgr.prototype as any,
    "_getActorAccessLevelToProject",
  ).mockResolvedValue("blocked");
  vi.spyOn(DbMgr.prototype as any, "describeActor").mockResolvedValue(
    "Signed-in user",
  );
});

test.each([ANON_USER, normalActor("user" as UserId)])(
  "a $type denied access is disconnected without broadcasting or rejecting the notification",
  async (actor) => {
    vi.spyOn(DbMgr.prototype, "tryGetProjectById").mockResolvedValue(
      Object.assign(new Project(), {
        id: "private-project",
        createdById: "owner",
        inviteOnly: true,
        defaultAccessLevel: "blocked",
      }),
    );
    const socket = {
      handshake: { user: { actor } },
      disconnect: vi.fn(),
      emit: vi.fn(),
    };
    state.fetchSockets.mockResolvedValue([socket]);
    const server = new ProjectsSocket({} as Config, "permission-test");
    await expect(
      server.broadcast({
        type: "aiChat",
        message: { projectId: "private-project", seq: 1 },
      } as BroadcastPayload),
    ).resolves.toBeUndefined();
    expect(socket.disconnect).toHaveBeenCalledExactlyOnceWith(true);
    expect(socket.emit).not.toHaveBeenCalled();
  },
);

test("a public project can still deliver permitted events to anonymous sockets", async () => {
  vi.spyOn(DbMgr.prototype, "tryGetProjectById").mockResolvedValue(
    Object.assign(new Project(), {
      id: "private-project",
      createdById: "owner",
      inviteOnly: false,
      defaultAccessLevel: "viewer",
    }),
  );
  const socket = {
    handshake: { user: { actor: ANON_USER } },
    disconnect: vi.fn(),
    emit: vi.fn(),
  };
  state.fetchSockets.mockResolvedValue([socket]);
  const server = new ProjectsSocket({} as Config, "permission-test");
  await server.broadcast({
    type: "aiChat",
    message: { projectId: "private-project", seq: 1 },
  } as BroadcastPayload);
  expect(socket.disconnect).not.toHaveBeenCalled();
  expect(socket.emit).toHaveBeenCalledExactlyOnceWith("aiChat", {
    projectId: "private-project",
    seq: 1,
  });
});
