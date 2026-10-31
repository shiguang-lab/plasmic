import { getProjectRev } from "@/wab/server/routes/projects";
import type { Request, Response } from "express";
import { MigrationExecutor } from "typeorm";
import { mock } from "vitest-mock-extended";

const calls = vi.hoisted(() => ({
  startup: vi.fn(), project: vi.fn(), branch: vi.fn(), revision: vi.fn(),
  permissions: vi.fn(), dependencies: vi.fn(),
}));
vi.mock("@/wab/server/routes/project-startup", () => ({ loadProjectStartup: calls.startup }));
vi.mock("@/wab/server/db/DbBundleLoader", async importOriginal => ({
  ...await importOriginal<typeof import("@/wab/server/db/DbBundleLoader")>(), loadDepPackages: calls.dependencies,
}));
vi.mock("@/wab/server/db/BundleMigrator", async importOriginal => ({
  ...await importOriginal<typeof import("@/wab/server/db/BundleMigrator")>(), getMigratedBundle: vi.fn(async () => ({})),
}));
vi.mock("@/wab/server/routes/util", async importOriginal => ({
  ...await importOriginal<typeof import("@/wab/server/routes/util")>(),
  userDbMgr: () => ({
    getProjectById: calls.project, getBranchById: calls.branch,
    getLatestProjectRev: calls.revision, getPermissionsForProject: calls.permissions,
    getHostlessVersion: async () => ({ versionCount: 0 }),
    tryGetLatestRevisionSynced: async () => undefined,
    getPublicAppAuthConfig: async () => undefined,
    tryGetNormalActorId: () => undefined,
  }),
}));
function request(query: Request["query"] = {}, projectBranchId = "project") {
  return { params: { projectBranchId }, query, noTxMgr: { connection: { options: {}, driver: { options: {}, buildTableName: (name: string) => name } } }, promLabels: {}, analytics: { track: vi.fn() } } as unknown as Request;
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(MigrationExecutor.prototype, "getExecutedMigrations").mockResolvedValue([]);
  calls.project.mockResolvedValue({ id: "project", name: "Example", workspace: null });
  calls.permissions.mockResolvedValue([]);
  calls.revision.mockResolvedValue({ id: "revision", revision: 1, data: "{}" });
  calls.dependencies.mockResolvedValue([{ id: "library", model: {} }]);
  calls.branch.mockResolvedValue({ id: "feature-id", name: "feature" });
  calls.startup.mockReturnValue({ branches: Promise.resolve([]), data: Promise.resolve({ projectId: "project", branchName: "main" }) });
});
afterEach(() => vi.restoreAllMocks());
it("reads the model while context is pending, returns both once, and reuses project permissions", async () => {
  let finish: (value: object) => void = () => undefined;
  calls.startup.mockReturnValue({ branches: Promise.resolve([]), data: new Promise(resolve => { finish = resolve; }) });
  const res = mock<Response>();
  const pending = getProjectRev(request({ includeStartup: "true", branchName: JSON.stringify("main") }), res);
  await vi.waitFor(() => expect(calls.revision).toHaveBeenCalledOnce());
  expect(res.json).not.toHaveBeenCalled();
  finish({ projectId: "project", branchName: "main" });
  await pending;
  expect(calls.project).toHaveBeenCalledOnce();
  expect(calls.permissions).toHaveBeenCalledOnce();
  expect(res.json).toHaveBeenCalledOnce();
  const packet = res.json.mock.calls[0][0];
  expect(packet.startup.projectData).toEqual({ projects: [packet.project], perms: packet.perms });
  expect(packet.rev.id).toBe("revision");
});
it("resolves a named branch before fetching its revision without a separate client request", async () => {
  calls.startup.mockReturnValue({ branches: Promise.resolve([{ id: "feature-id", name: "feature" }]), data: Promise.resolve({ projectId: "project", branchName: "feature" }) });
  await getProjectRev(request({ includeStartup: "true", branchName: JSON.stringify("feature") }), mock<Response>());
  expect(calls.branch).toHaveBeenCalledWith("feature-id");
  expect(calls.revision).toHaveBeenCalledWith("project", { branchId: "feature-id" });
});
it("does not fetch main revision for an unknown branch", async () => {
  await expect(getProjectRev(request({ includeStartup: "true", branchName: JSON.stringify("missing") }), mock<Response>())).rejects.toMatchObject({ statusCode: 400, message: "Branch not found" });
  expect(calls.revision).not.toHaveBeenCalled();
});
it("ordinary project refresh preserves branch routing without reading startup context", async () => {
  const res = mock<Response>();
  await getProjectRev(request({}, "project@feature-id"), res);
  expect(calls.startup).not.toHaveBeenCalled();
  expect(calls.revision).toHaveBeenCalledWith("project", { branchId: "feature-id" });
  expect(res.json.mock.calls[0][0]).not.toHaveProperty("startup");
});
it("project permission failure returns no partial context or model", async () => {
  calls.project.mockRejectedValue(new Error("Access denied"));
  const res = mock<Response>();
  await expect(getProjectRev(request({ includeStartup: "true" }), res)).rejects.toThrow("Access denied");
  expect(res.json).not.toHaveBeenCalled();
});
