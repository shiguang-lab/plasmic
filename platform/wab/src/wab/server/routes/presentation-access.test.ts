import { presentationAccess } from "@/wab/server/routes/presentation-access";
import { PRESENTATION_BRANCH_HEADER, PRESENTATION_CODE_HEADER } from "@/wab/shared/presentation-access";
import type { Request, Response } from "express";

const mocks = vi.hoisted(() => ({ find: vi.fn(), deps: vi.fn(), revision: vi.fn(), branch: vi.fn() }));
vi.mock("@/wab/server/routes/presentations", () => ({ findPresentationProject: mocks.find }));
vi.mock("@/wab/server/db/DbBundleLoader", () => ({ loadDepPackages: mocks.deps }));
vi.mock("@/wab/server/db/DbMgr", () => ({
  ANON_USER: { type: "AnonUser" },
  DbMgr: class {
    projectIdsAndTokens;
    constructor(_req, _actor, opts) { this.projectIdsAndTokens = opts.projectIdsAndTokens; }
    getLatestProjectRev = mocks.revision;
    getProjectBranchByName = mocks.branch;
  },
}));
vi.mock("@/wab/server/routes/util", () => ({ parseProjectIdsAndTokensHeader: () => undefined }));

function request(path: string, method = "GET") {
  return { path, method, headers: { [PRESENTATION_CODE_HEADER]: "0123456789" }, body: {} } as unknown as Request;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.find.mockResolvedValue({ id: "project", projectApiToken: "read-token" });
  mocks.revision.mockResolvedValue({ data: JSON.stringify({ deps: ["library-version"] }) });
  mocks.branch.mockResolvedValue({ id: "branch-id" });
  mocks.deps.mockImplementation(async mgr => {
    mgr.projectIdsAndTokens.push({ projectId: "library", projectApiToken: "library-read-token" });
  });
});

it.each(["/api/v1/projects/project", "/api/v1/projects", "/api/v1/projects/project/branches"])("authorizes only the presentation project for %s", async path => {
  const req = request(path), next = vi.fn();
  await presentationAccess(req, {} as Response, next);
  expect(req.body.projectIdsAndTokens).toEqual([{ projectId: "project", projectApiToken: "read-token" }]);
  expect(mocks.deps).not.toHaveBeenCalled();
  expect(next).toHaveBeenCalledWith();
});

it.each(["/api/v1/dependency-models/model", "/api/v1/hostless-libraries/antd/canvas", "/api/v1/hostless-libraries/antd/release", "/api/v1/pkgs/library"])("authorizes transitive dependencies from the selected draft for %s", async path => {
  const req = request(path), next = vi.fn();
  req.headers[PRESENTATION_BRANCH_HEADER] = encodeURIComponent("设计分支");
  await presentationAccess(req, {} as Response, next);
  expect(mocks.branch).toHaveBeenCalledWith("project", "设计分支");
  expect(mocks.revision).toHaveBeenCalledWith("project", { branchId: "branch-id" });
  expect(mocks.deps).toHaveBeenCalledWith(expect.anything(), { deps: ["library-version"] }, { extendTokens: true, dontMigrateBundle: true });
  expect(req.body.projectIdsAndTokens).toEqual([
    { projectId: "project", projectApiToken: "read-token" },
    { projectId: "library", projectApiToken: "library-read-token" },
  ]);
  expect(next).toHaveBeenCalledWith();
});

it.each([
  ["POST", "/api/v1/projects/project"], ["DELETE", "/api/v1/projects/project"],
  ["GET", "/api/v1/projects/project/preview-publication"], ["GET", "/api/v1/teams/team"],
  ["GET", "/api/v1/comments/project"], ["GET", "/api/v1/project-data/project"],
])("does not grant presentation access to %s %s", async (method, path) => {
  const req = request(path, method), next = vi.fn();
  await presentationAccess(req, {} as Response, next);
  expect(mocks.find).not.toHaveBeenCalled();
  expect(req.body).toEqual({});
  expect(next).toHaveBeenCalledWith();
});

it("does not attach credentials when the presentation or dependencies fail to resolve", async () => {
  const error = new Error("Missing presentation");
  mocks.find.mockRejectedValueOnce(error);
  const req = request("/api/v1/dependency-models/model"), next = vi.fn();
  await presentationAccess(req, {} as Response, next);
  expect(next).toHaveBeenCalledWith(error);
  expect(req.body).toEqual({});
});
