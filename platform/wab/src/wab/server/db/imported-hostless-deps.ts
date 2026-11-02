import { isRetiredHostlessLibrary } from "@/wab/shared/core/platform-libraries";
import { getDevFlagsMergedWithOverrides } from "@/wab/server/db/appconfig";
import { unbundlePkgVersion } from "@/wab/server/db/DbBundleLoader";
import type { DbMgr } from "@/wab/server/db/DbMgr";
import { Bundler, Bundle } from "@/wab/shared/bundler";
import { ensure, ensureArray } from "@/wab/shared/common";
import { ProjectDependency } from "@/wab/shared/model/classes";

/** Resolve published libraries before importing any business projects. */
export async function resolveImportedHostlessDeps(depBundles: [string, Bundle][], mgr: DbMgr, bundler: Bundler) {
  const flags = await getDevFlagsMergedWithOverrides(mgr);
  const managedDeps = new Map<string, ProjectDependency>();
  for (const [id, dep] of depBundles) {
    const root = dep.map[dep.root];
    const siteRef = root.site as { __ref: string };
    const infoRef = dep.map[siteRef?.__ref]?.hostLessPackageInfo as { __ref: string } | undefined;
    const name = infoRef && dep.map[infoRef.__ref]?.name;
    if (typeof name !== "string") { continue; }
    const entry = flags.hostLessComponents?.find(candidate => candidate.codeName === name && candidate.hasCodeArtifacts);
    if (!entry) { continue; }
    const libraryProjectId = ensure(ensureArray(entry.projectId)[0], "Missing library project");
    await mgr.checkProjectPerms(libraryProjectId, "viewer", "import component library");
    const pkg = ensure(await mgr.getPkgByProjectId(libraryProjectId), "Missing library package");
    const version = await mgr.getPkgVersion(pkg.id, flags.autoUpgradeHostless && !isRetiredHostlessLibrary(name) ? undefined : root.version as string);
    managedDeps.set(id, await unbundlePkgVersion(mgr, bundler, version));
  }
  return managedDeps;
}
