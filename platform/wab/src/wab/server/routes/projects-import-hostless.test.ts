import { writeable } from "@/wab/shared/core/sites";
import { Bundler } from "@/wab/shared/bundler";
import { createSite } from "@/wab/shared/core/sites";
import { mkComponent, ComponentType } from "@/wab/shared/core/components";
import { mkTplTagX, mkTplComponentX, trackComponentRoot, trackComponentSite } from "@/wab/shared/core/tpls";
import { HostLessPackageInfo, ProjectDependency, isKnownTplComponent } from "@/wab/shared/model/classes";
import type { DbMgr } from "@/wab/server/db/DbMgr";
import type { Project, ProjectRevision } from "@/wab/server/entities/Entities";
import { mock } from "vitest-mock-extended";

vi.mock("@/wab/server/db/BundleMigrator", () => ({
  getLastBundleVersion: async () => "test-model", getMigrationsToExecute: async () => [],
  getMigratedBundle: async (entity: { model: string }) => JSON.parse(entity.model),
}));
const resolver = vi.hoisted(() => ({ resolve: vi.fn() }));
vi.mock("@/wab/server/db/imported-hostless-deps", () => ({ resolveImportedHostlessDeps: resolver.resolve }));
import { doImportProject } from "@/wab/server/routes/projects";

it("imports a business project using published library references without persisting cloned dependencies", async () => {
  const library = mkComponent({ name: "Button", type: ComponentType.Plain, tplTree: () => mkTplTagX("button") });
  const librarySite = createSite(); librarySite.components.push(library);
  writeable(librarySite).hostLessPackageInfo = new HostLessPackageInfo({ name: "antd6", npmPkg: [], deps: [], cssImport: [], registerCalls: [], minimumReactVersion: undefined });
  const dep = new ProjectDependency({ name: "antd6", uuid: "dep", pkgId: "original-pkg", projectId: "original-library", version: "3.0.0", site: librarySite });
  const page = mkComponent({ name: "Customers", type: ComponentType.Plain, tplTree: baseVariant => mkTplComponentX({ component: library, baseVariant }) });
  const site = createSite(); site.components.push(page); site.projectDependencies.push(dep);
  trackComponentRoot(page); trackComponentSite(page, site);
  const source = new Bundler();
  const depBundle = source.bundle(dep, "original-version", "test-model");
  const siteBundle = source.bundle(site, "original-project", "test-model");
  const target = new Bundler();
  const published = target.unbundle(depBundle, "published-version") as ProjectDependency;
  resolver.resolve.mockResolvedValue(new Map([["original-version", published]]));
  const db = mock<DbMgr>();
  const project = mock<Project>({ id: "business-copy" as Project["id"] });
  const rev = mock<ProjectRevision>({ revision: 1 });
  db.createProject.mockResolvedValue({ project, rev });
  db.getProjectById.mockResolvedValue(project);
  db.getLatestProjectRev.mockResolvedValue(rev);
  db.saveProjectRev.mockResolvedValue(rev);
  await doImportProject([["original-version", depBundle], ["original-project", siteBundle]], db, target, { projectName: "Customers copy" });
  expect(db.createProject).toHaveBeenCalledTimes(1);
  expect(db.createPkgByProjectId).not.toHaveBeenCalled();
  expect(db.insertPkgVersion).not.toHaveBeenCalled();
  const saved = JSON.parse(db.saveProjectRev.mock.calls[0][0].data);
  expect(saved.deps).toContain("published-version");
  expect(saved.deps).not.toContain("original-version");
  const reopened = new Bundler(); reopened.unbundle(depBundle, "published-version");
  const restored = reopened.unbundle(saved, "business-copy") as typeof site;
  expect(restored.projectDependencies[0].pkgId).toBe("original-pkg");
  const instance = restored.components[0].tplTree;
  expect(isKnownTplComponent(instance) && instance.component).toBe(restored.projectDependencies[0].site.components[0]);
});
