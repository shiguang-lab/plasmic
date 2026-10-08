import type { DbMgr } from "@/wab/server/db/DbMgr";
import { unbundlePkgVersion } from "@/wab/server/db/DbBundleLoader";
import { HostlessLibraryVersion } from "@/wab/server/entities/CustomEntities";
import type { LibraryArtifact } from "@/wab/server/loader/library-artifacts";
import { resolveProjectDeps, mkVersionToSync, type VersionToSync } from "@/wab/server/loader/resolve-projects";
import { BadRequestError } from "@/wab/shared/ApiErrors/errors";
import { Bundler } from "@/wab/shared/bundler";
import { ensure } from "@/wab/shared/common";

export async function getProjectLibraryArtifacts(db: DbMgr, projectId: string, version: string) {
  return getPublishedProjectLibraryArtifacts(db, { [projectId]: mkVersionToSync(version) });
}

export async function getPublishedProjectLibraryArtifacts(db: DbMgr, seeds: Record<string, VersionToSync>) {
  const projectVersions = {
    ...await resolveProjectDeps(db, seeds),
    ...seeds,
  };
  const artifacts: LibraryArtifact[] = [];
  const bundler = new Bundler();
  for (const [id, spec] of Object.entries(projectVersions)) {
    const pkg = ensure(await db.getPkgByProjectId(id), `Missing project package ${id}`);
    const pkgVersion = await db.getPkgVersion(pkg.id, spec.version);
    const dep = await unbundlePkgVersion(db, bundler, pkgVersion);
    if (!dep.site.hostLessPackageInfo) {
      continue;
    }
    const release = await db.getEntMgr().findOne(HostlessLibraryVersion, { pkgVersionId: pkgVersion.id });
    if (!release) {
      throw new BadRequestError(`Component library ${dep.site.hostLessPackageInfo.name}@${spec.version} has no published code artifact. Publish this library version before publishing the website.`);
    }
    artifacts.push(release.artifact);
  }
  return artifacts;
}
