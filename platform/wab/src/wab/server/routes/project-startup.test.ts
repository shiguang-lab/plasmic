import { loadProjectStartup } from "@/wab/server/routes/project-startup";
import { toOpaque } from "@/wab/commons/types";
import type { Request } from "express";
import { mock } from "vitest-mock-extended";

const calls = vi.hoisted(() => ({ self: vi.fn(), app: vi.fn(), version: vi.fn(), hosts: vi.fn(), branches: vi.fn() }));
vi.mock("@/wab/server/auth/routes", () => ({ getSelfInfo: calls.self }));
vi.mock("@/wab/server/db/BundleMigrator", () => ({ getLastBundleVersion: calls.version }));
vi.mock("@/wab/server/routes/appctx", () => ({ getAppCtxData: calls.app }));
vi.mock("@/wab/server/routes/hosts", () => ({ getTrustedHostsData: calls.hosts }));
vi.mock("@/wab/server/routes/util", () => ({
  parseQueryParams: (req: Request) => Object.fromEntries(Object.entries(req.query).map(([key, value]) => [key, JSON.parse(String(value))])),
  userDbMgr: () => ({ listBranchesForProject: calls.branches }),
}));
beforeEach(() => {
  vi.resetAllMocks();
  calls.self.mockResolvedValue({ user: { id: "user" }, isAdmin: false });
  calls.app.mockResolvedValue({ teams: [], workspaces: [], perms: [] });
  calls.version.mockResolvedValue("version");
  calls.hosts.mockResolvedValue({ trustedHosts: [] });
  calls.branches.mockResolvedValue([{ id: "branch", name: "feature" }]);
});
it("starts context reads together while exposing branch resolution independently", async () => {
  let finish: (value: object) => void = () => undefined;
  calls.self.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const pending = loadProjectStartup(mock<Request>({ query: { branchName: JSON.stringify("feature") }, user: {} }), toOpaque("project"));
  expect(calls.app).toHaveBeenCalledOnce();
  expect(calls.hosts).toHaveBeenCalledOnce();
  expect(calls.branches).toHaveBeenCalledWith("project");
  expect(await pending.branches).toEqual([{ id: "branch", name: "feature" }]);
  finish({ user: { id: "user" }, isAdmin: false });
  expect(await pending.data).toMatchObject({ projectId: "project", branchName: "feature", latestBundleVersion: "version" });
  expect(await pending.data).not.toHaveProperty("projectData"); // Reused from the project read, never queried twice.
});
it("preserves anonymous startup and skips branch lookup for main", async () => {
  const pending = loadProjectStartup(mock<Request>({ user: undefined, query: { branchName: JSON.stringify("main") } }), toOpaque("project"));
  expect(await pending.data).toMatchObject({ selfInfo: null, branches: [] });
  expect(calls.self).not.toHaveBeenCalled();
  expect(calls.branches).not.toHaveBeenCalled();
});
it("propagates context failures instead of returning incomplete context", async () => {
  const error = new Error("Access denied");
  calls.app.mockRejectedValue(error);
  await expect(loadProjectStartup(mock<Request>({ query: {}, user: undefined }), toOpaque("project")).data).rejects.toBe(error);
});
