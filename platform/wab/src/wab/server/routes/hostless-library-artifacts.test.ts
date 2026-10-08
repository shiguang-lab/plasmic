import { expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ perms: vi.fn(), versions: vi.fn(async (_id: string, version?: string) => ({ id: version ?? "latest" })), missing: false }));
vi.mock("@/wab/server/entities/CustomEntities", () => ({ HostlessLibraryVersion: class {} }));
vi.mock("@/wab/shared/devflags", () => ({ DEVFLAGS: { hostLessComponents: [{ codeName: "new-library", projectId: ["library-project"], hasCodeArtifacts: true }] } }));
vi.mock("@/wab/server/routes/util", () => ({ userDbMgr: () => ({
  tryGetDevFlagOverrides: async () => undefined, checkProjectPerms: state.perms,
  getPkgByProjectId: async () => ({ id: "library-package" }), getPkgVersion: state.versions,
  getEntMgr: () => ({ findOne: async (_entity: any, where: any) => state.missing ? undefined : { artifact: { canvas: `registration-${where.pkgVersionId}`, server: "private server code" } } }),
}) }));
import { getHostlessLibraryCanvas } from "@/wab/server/routes/hostless-library-artifacts";

it("serves only the requested version's browser registration after checking access", async () => {
  state.perms.mockReset(); state.versions.mockClear(); state.missing = false;
  const res = { setHeader: vi.fn(), send: vi.fn() };
  await getHostlessLibraryCanvas({ params: { name: "new-library" }, query: { version: "1.2.3" } } as any, res as any);
  expect(state.perms).toHaveBeenCalledWith("library-project", "viewer", "read component library code");
  expect(state.versions).toHaveBeenCalledWith("library-package", "1.2.3");
  expect(res.send).toHaveBeenCalledWith("registration-1.2.3");
  state.perms.mockRejectedValueOnce(new Error("Forbidden"));
  await expect(getHostlessLibraryCanvas({ params: { name: "new-library" }, query: {} } as any, res as any)).rejects.toThrow("Forbidden");
});

it("does not substitute a missing version with the latest registration", async () => {
  state.missing = true;
  await expect(getHostlessLibraryCanvas({ params: { name: "new-library" }, query: { version: "0.1.0" } } as any, {} as any)).rejects.toThrow("no code artifact");
  state.missing = false;
});
