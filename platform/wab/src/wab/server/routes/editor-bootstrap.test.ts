import { getEditorBootstrap } from "@/wab/server/routes/editor-bootstrap";
import type { Request, Response } from "express";
import { mock } from "vitest-mock-extended";

const calls = vi.hoisted(() => ({
  self: vi.fn(),
  app: vi.fn(),
  version: vi.fn(),
  projects: vi.fn(),
  hosts: vi.fn(),
  branches: vi.fn(),
}));
vi.mock("@/wab/server/auth/routes", () => ({ getSelfInfo: calls.self }));
vi.mock("@/wab/server/db/BundleMigrator", () => ({
  getLastBundleVersion: calls.version,
}));
vi.mock("@/wab/server/routes/appctx", () => ({ getAppCtxData: calls.app }));
vi.mock("@/wab/server/routes/projects", () => ({
  getProjectsData: calls.projects,
}));
vi.mock("@/wab/server/routes/hosts", () => ({
  getTrustedHostsData: calls.hosts,
}));
vi.mock("@/wab/server/routes/util", () => ({
  parseQueryParams: (req: Request) =>
    Object.fromEntries(
      Object.entries(req.query).map(([key, value]) => [
        key,
        JSON.parse(String(value)),
      ]),
    ),
  userDbMgr: () => ({ listBranchesForProject: calls.branches }),
}));

beforeEach(() => {
  vi.resetAllMocks();
  calls.self.mockResolvedValue({ user: { id: "user" }, isAdmin: false });
  calls.app.mockResolvedValue({ teams: [], workspaces: [], perms: [] });
  calls.version.mockResolvedValue("version");
  calls.projects.mockResolvedValue({
    projects: [{ id: "project" }],
    perms: [],
  });
  calls.hosts.mockResolvedValue({ trustedHosts: [] });
  calls.branches.mockResolvedValue([{ id: "branch", name: "feature" }]);
});

it("starts authorized startup reads together and returns one uncached response", async () => {
  let finish: (value: object) => void = () => {};
  calls.self.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const req = mock<Request>({
    params: { projectId: "project" },
    query: { branchName: JSON.stringify("feature") },
    user: {},
  });
  const res = mock<Response>();
  const pending = getEditorBootstrap(req, res);
  expect(calls.app).toHaveBeenCalledOnce();
  expect(calls.projects).toHaveBeenCalledWith(req, {
    query: "byIds",
    projectIds: ["project"],
  });
  expect(calls.branches).toHaveBeenCalledWith("project");
  expect(res.json).not.toHaveBeenCalled();
  finish({ user: { id: "user" }, isAdmin: false });
  await pending;
  expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({
      projectId: "project",
      branchName: "feature",
      latestBundleVersion: "version",
      projectData: { projects: [{ id: "project" }], perms: [] },
    }),
  );
});

it("preserves anonymous public-project startup and skips the main-branch lookup", async () => {
  const res = mock<Response>();
  await getEditorBootstrap(
    mock<Request>({
      params: { projectId: "project" },
      user: undefined,
      query: { branchName: JSON.stringify("main") },
    }),
    res,
  );
  expect(calls.self).not.toHaveBeenCalled();
  expect(calls.branches).not.toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({ selfInfo: null, branches: [] }),
  );
});

it("propagates denied project access without returning a partial bootstrap", async () => {
  const error = new Error("Access denied");
  calls.projects.mockRejectedValue(error);
  const res = mock<Response>();
  await expect(
    getEditorBootstrap(
      mock<Request>({
        params: { projectId: "project" },
        user: undefined,
        query: {},
      }),
      res,
    ),
  ).rejects.toBe(error);
  expect(res.json).not.toHaveBeenCalled();
});
