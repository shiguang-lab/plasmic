import { writeable } from "@/wab/shared/core/sites";
import { Bundler } from "@/wab/shared/bundler";
import { createSite } from "@/wab/shared/core/sites";
import { HostLessPackageInfo, ProjectDependency } from "@/wab/shared/model/classes";
import { mock } from "vitest-mock-extended";
import type { DbMgr } from "@/wab/server/db/DbMgr";
import type { Pkg, PkgVersion } from "@/wab/server/entities/Entities";

const deps = vi.hoisted(() => ({ flags: vi.fn(), unbundle: vi.fn() }));
vi.mock("@/wab/server/db/appconfig", () => ({ getDevFlagsMergedWithOverrides: deps.flags }));
vi.mock("@/wab/server/db/DbBundleLoader", () => ({ unbundlePkgVersion: deps.unbundle }));
import { resolveImportedHostlessDeps } from "@/wab/server/db/imported-hostless-deps";

it("resolves an imported library copy to its authorized published model instead of creating a new package", async () => {
  const site = createSite();
  writeable(site).hostLessPackageInfo = new HostLessPackageInfo({ name: "antd6", npmPkg: [], deps: [], cssImport: [], registerCalls: [], minimumReactVersion: undefined });
  const old = new ProjectDependency({ name: "Imported Dep", uuid: "dep", pkgId: "copy", projectId: "copy-project", version: "0.0.1", site });
  const bundler = new Bundler();
  const bundle = bundler.bundle(old, "old-version", "latest-model");
  const db = mock<DbMgr>();
  db.getPkgByProjectId.mockResolvedValue(mock<Pkg>({ id: "published-pkg" as Pkg["id"] }));
  const version = mock<PkgVersion>({ id: "published-version" as PkgVersion["id"], version: "3.16.0" });
  db.getPkgVersion.mockResolvedValue(version);
  deps.flags.mockResolvedValue({ autoUpgradeHostless: true, hostLessComponents: [{ codeName: "antd6", projectId: "published-project", hasCodeArtifacts: true }] });
  const published = { ...old, pkgId: "published-pkg", version: "3.16.0" };
  deps.unbundle.mockResolvedValue(published);
  const result = await resolveImportedHostlessDeps([["old-version", bundle]], db, bundler);
  expect(result.get("old-version")).toBe(published);
  expect(db.checkProjectPerms).toHaveBeenCalledWith("published-project", "viewer", "import component library");
  expect(db.getPkgVersion).toHaveBeenCalledWith("published-pkg", undefined);
  expect(db.createProject).not.toHaveBeenCalled();
  expect(db.insertPkgVersion).not.toHaveBeenCalled();
  db.checkProjectPerms.mockRejectedValueOnce(new Error("Forbidden"));
  await expect(resolveImportedHostlessDeps([["old-version", bundle]], db, bundler)).rejects.toThrow("Forbidden");
});
