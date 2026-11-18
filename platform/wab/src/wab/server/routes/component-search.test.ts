import { componentSearch } from "@/wab/server/routes/component-search";
import express from "express";
import { AddressInfo } from "net";

const permissions = vi.hoisted(() => vi.fn());
vi.mock("@/wab/server/routes/util", () => ({
  getUser: () => ({ id: "user" }),
  userDbMgr: () => ({ checkProjectPerms: permissions }),
}));

it("checks access on sync and search and rejects an expired catalogue", async () => {
  const app = express();
  app.use(express.json());
  app.post("/projects/:projectId/component-search", async (req, res, next) => {
    Object.assign(req, { devflags: { enableComponentReuseAdvisory: true } });
    try {
      await componentSearch(req, res);
    } catch (error) {
      next(error);
    }
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const url =
      "http://127.0.0.1:" +
      (server.address() as AddressInfo).port +
      "/projects/project/component-search";
    const post = (body: unknown) =>
      fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    const sync = await post({ command: "sync", documents: [], unavailable: 0 });
    expect(sync.status).toBe(200);
    const { version } = await sync.json();
    const result = await post({
      command: "search",
      version,
      intent: "switch panels",
    });
    expect(await result.json()).toMatchObject({
      status: "completed",
      rows: [],
    });
    expect(
      (
        await post({
          command: "search",
          version: "0".repeat(64),
          intent: "switch panels",
        })
      ).status,
    ).toBe(409);
    permissions.mockRejectedValueOnce(
      Object.assign(new Error("Forbidden"), { status: 403 }),
    );
    expect(
      (await post({ command: "search", version, intent: "switch panels" }))
        .status,
    ).toBe(403);
    expect(permissions).toHaveBeenCalledTimes(4);
    expect(permissions).toHaveBeenCalledWith(
      "project",
      "viewer",
      "Review project components",
    );
  } finally {
    server.close();
  }
});
