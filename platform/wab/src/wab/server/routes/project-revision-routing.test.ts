import { addMainAppServerRoutes } from "@/wab/server/AppServer";
import type { Config } from "@/wab/server/config";
import express from "express";
import type { AddressInfo } from "net";

// Keep actual route registration and write authentication middleware; stub the
// database-backed operations so dispatch regressions never mutate a project.
vi.mock("@/wab/server/routes/projects", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/wab/server/routes/projects")>();
  const handler = (name: string) => vi.fn(async (req: express.Request, res: express.Response) => {
    res.json({ handler: name, params: req.params, query: req.query, body: req.body });
  });
  return {
    ...actual,
    getProjectRev: handler("project"),
    getModelUpdates: handler("updates"),
    getProjectRevision: handler("revision"),
    getPkgVersion: handler("package"),
    getPkgVersionByProjectId: handler("project-package"),
    listUnpublishedProjectRevisions: handler("unpublished"),
    updateProjectData: handler("write"),
  };
});

let server: import("http").Server;
let origin: string;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    Object.assign(req, { cookies: {}, con: { transaction: async (fn: (manager: object) => Promise<unknown>) => fn({}) }, noTxMgr: {} });
    next();
  });
  addMainAppServerRoutes(app, { production: false } as Config);
  app.use((err: { statusCode?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.statusCode ?? 500).json({ error: "denied" });
  });
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
});

it.each([
  ["projects/project@branch", "project", { projectBranchId: "project@branch" }],
  ["projects/project/updates", "updates", { projectId: "project" }],
  ["projects/project/revs/revision-id", "revision", { projectId: "project", revisionId: "revision-id" }],
  ["pkgs/package-id", "package", { pkgId: "package-id" }],
  ["pkgs/projectId/project", "project-package", { projectId: "project" }],
])("keeps %s as GET and removes cache-negotiation POST routes", async (path, handler, params) => {
  const query = '?branchId=%22branch%22&revisionNumGt=6&version=%221.0.0%22';
  const regular = await fetch(`${origin}/api/v1/${path}${query}`);
  expect(regular.status).toBe(200);
  const get = await regular.json();
  expect(get.handler).toBe(handler);
  expect(get.params).toEqual(params);
  const negotiated = await fetch(`${origin}/api/v1/model-cache/${path}${query}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
  });
  expect(negotiated.status).toBe(404);
});

it("keeps unpublished history as GET and removes old cache-only POST routes", async () => {
  const list = await fetch(`${origin}/api/v1/projects/project/revs/unpublished?revisionNumGt=6`);
  expect(list.status).toBe(200);
  expect(await list.json()).toMatchObject({ handler: "unpublished", query: { revisionNumGt: "6" } });
  for (const path of ["projects/project/revs/unpublished", "projects/project/revs/revision-id", "projects/project/updates", "pkgs/package-id", "pkgs/projectId/project"]) {
    const response = await fetch(`${origin}/api/v1/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"modelDigests":[]}' });
    expect(response.status).toBe(404);
  }
});

it("preserves the original project POST write handler, body and API authentication", async () => {
  const body = { projectIdsAndTokens: [], newComponents: [{ name: "Example" }] };
  const response = await fetch(`${origin}/api/v1/projects/project`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ handler: "write", params: { projectId: "project" }, query: {}, body });
  const denied = await fetch(`${origin}/api/v1/projects/project`, { method: "POST", headers: { "Content-Type": "application/json" }, body: '{}' });
  expect(denied.status).toBe(401);
});

it("removes the dedicated bootstrap endpoint and accepts startup context on the project GET", async () => {
  expect((await fetch(`${origin}/api/v1/editor-bootstrap/project`)).status).toBe(404);
  const response = await fetch(`${origin}/api/v1/projects/project?includeStartup=true&branchName=%22feature%22`);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ handler: "project", query: { includeStartup: "true", branchName: '"feature"' } });
});
