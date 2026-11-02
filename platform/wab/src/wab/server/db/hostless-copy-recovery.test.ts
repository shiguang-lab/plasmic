import { writeable } from "@/wab/shared/core/sites";
import { Bundler } from "@/wab/shared/bundler";
import { createSite } from "@/wab/shared/core/sites";
import { mkComponent, ComponentType } from "@/wab/shared/core/components";
import { mkTplTagX, mkTplComponentX, trackComponentRoot, trackComponentSite } from "@/wab/shared/core/tpls";
import { HostLessPackageInfo, ProjectDependency, isKnownTplComponent } from "@/wab/shared/model/classes";
import { DEVFLAGS } from "@/wab/shared/devflags";
import type { PkgVersion, ProjectRevision } from "@/wab/server/entities/Entities";

vi.mock("@/wab/server/db/BundleMigrator", () => ({ getMigratedBundle: async (v: { model: string }) => JSON.parse(v.model) }));
vi.mock("@/wab/server/db/DbMgr", () => ({ DbMgr: class {}, SUPER_USER: {} }));
vi.mock("@/wab/server/workers/worker-utils", () => ({ ensureDevFlags: async () => undefined }));
vi.mock("@/wab/server/code-components/code-components", () => ({ updateHostlessPackage: vi.fn() }));
import { DbMgr } from "@/wab/server/db/DbMgr";
import { bundleHasStaleHostlessDeps, upgradeHostlessProject } from "@/wab/server/db/bundle-migration-utils";

it.each(["copied-pkg", "published-pkg"])("upgrades %s with both dependency model and component references pointing to the official release", async (oldPkgId) => {
  const before = DEVFLAGS.hostLessWorkspaceId;
  DEVFLAGS.hostLessWorkspaceId = "platform-workspace" as typeof DEVFLAGS.hostLessWorkspaceId;
  const librarySite = createSite();
  const button = mkComponent({ name: "Button", type: ComponentType.Plain, tplTree: () => mkTplTagX("button") });
  librarySite.components.push(button);
  writeable(librarySite).hostLessPackageInfo = new HostLessPackageInfo({ name: "antd6", npmPkg: [], deps: [], cssImport: [], registerCalls: [], minimumReactVersion: undefined });
  const old = new ProjectDependency({ name: "Imported Dep", uuid: "old-dep", pkgId: oldPkgId, projectId: "copied-project", version: "0.0.1", site: librarySite });
  const source = new Bundler();
  const oldBundle = source.bundle(old, "copied-version", "model");
  const owner = mkComponent({ name: "Customers", type: ComponentType.Plain, tplTree: baseVariant => mkTplComponentX({ component: button, baseVariant }) });
  const site = createSite(); site.components.push(owner); site.projectDependencies.push(old);
  trackComponentRoot(owner); trackComponentSite(owner, site);
  const bundle = source.bundle(site, "business", "model");
  const canonical = new Bundler();
  const published = canonical.unbundle(oldBundle, "temporary") as ProjectDependency;
  writeable(published).pkgId = "published-pkg"; writeable(published).projectId = "published-project"; writeable(published).version = "3.16.0";
  const latestBundle = new Bundler().bundle(published, "published-version", "model");
  const latest = { id: "published-version", pkgId: "published-pkg", version: "3.16.0", model: JSON.stringify(latestBundle) } as PkgVersion;
  const copied = { id: "copied-version", pkgId: oldPkgId, model: JSON.stringify(oldBundle) } as PkgVersion;
  const db = Object.assign(new DbMgr(undefined as never, undefined as never), {
    getProjectsByWorkspaces: async () => [{ id: "published-project" }],
    getPkgByProjectId: async () => ({ id: "published-pkg" }),
    getPkgVersion: async () => latest,
    listPkgVersions: async () => oldPkgId === "published-pkg" ? [copied, latest] : [latest],
    getHostlessVersion: async () => ({ versionCount: oldPkgId === "published-pkg" ? 2 : 1 }),
    getPkgVersionById: async (id: string) => {
      if (id === latest.id) { return latest; }
      if (id === copied.id) { return copied; }
      throw new Error("Missing library model");
    },
  });
  try {
    expect(await bundleHasStaleHostlessDeps(bundle, db)).toBe(true);
    await upgradeHostlessProject(bundle, { id: "business" } as ProjectRevision, db);
    expect(bundle.deps).toEqual(["published-version"]);
    const reopened = new Bundler(); reopened.unbundle(latestBundle, "published-version");
    const restored = reopened.unbundle(bundle, "business") as typeof site;
    expect(restored.projectDependencies[0].pkgId).toBe("published-pkg");
    const instance = restored.components[0].tplTree;
    expect(isKnownTplComponent(instance) && instance.component).toBe(restored.projectDependencies[0].site.components[0]);
    expect(await bundleHasStaleHostlessDeps(bundle, db)).toBe(false);
    await expect(bundleHasStaleHostlessDeps({ ...bundle, deps: ["missing"] }, db)).rejects.toThrow("Missing library model");
  } finally { DEVFLAGS.hostLessWorkspaceId = before; }
});
