import { expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ missing: false }));
vi.mock("@/wab/server/loader/resolve-projects", () => ({
  mkVersionToSync: (version: string) => ({ version, indirect: false }),
  resolveProjectDeps: async () => ({ library: { version: "1.2.3", indirect: true }, transitive: { version: "2.0.0", indirect: true } }),
}));
vi.mock("@/wab/server/db/DbBundleLoader", () => ({
  unbundlePkgVersion: async (_db: any, _bundler: any, version: any) => ({ site: { hostLessPackageInfo: version.id.startsWith("page") ? undefined : { name: version.id.split("@")[0] } } }),
}));
vi.mock("@/wab/server/entities/CustomEntities", () => ({ HostlessLibraryVersion: class {} }));
import { getProjectLibraryArtifacts } from "@/wab/server/loader/project-library-artifacts";

const db = () => ({
  getPkgByProjectId: async (id: string) => ({ id }),
  getPkgVersion: vi.fn(async (id: string, version: string) => ({ id: `${id}@${version}` })),
  getEntMgr: () => ({ findOne: async (_entity: any, where: any) => state.missing ? undefined : { artifact: { digest: where.pkgVersionId } } }),
});

it("collects exact direct and transitive Project library releases", async () => {
  state.missing = false;
  const manager = db();
  expect(await getProjectLibraryArtifacts(manager as any, "page", "3.4.5")).toEqual([{ digest: "library@1.2.3" }, { digest: "transitive@2.0.0" }]);
  expect(manager.getPkgVersion).toHaveBeenCalledWith("library", "1.2.3");
  expect(manager.getPkgVersion).toHaveBeenCalledWith("transitive", "2.0.0");
  expect(manager.getPkgVersion).toHaveBeenCalledWith("page", "3.4.5");
});

it("rejects missing artifacts without resolving a newer installed library", async () => {
  state.missing = true;
  await expect(getProjectLibraryArtifacts(db() as any, "page", "3.4.5")).rejects.toThrow("library@1.2.3 has no published code artifact");
  state.missing = false;
});
