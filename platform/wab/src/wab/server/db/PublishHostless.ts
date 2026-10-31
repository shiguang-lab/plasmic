import { updateHostlessPackage } from "@/wab/server/code-components/code-components";
import { DEFAULT_DATABASE_URI } from "@/wab/server/config";
import {
  getLastBundleVersion,
  getMigratedBundle,
} from "@/wab/server/db/BundleMigrator";
import {
  closeDbConnections,
  ensureDbConnections,
  getDefaultConnection,
} from "@/wab/server/db/DbCon";
import { DbMgr, SUPER_USER } from "@/wab/server/db/DbMgr";
import { unbundleSite } from "@/wab/server/db/bundle-migration-utils";
import { logger } from "@/wab/server/observability";
import { ensureDevFlags } from "@/wab/server/workers/worker-utils";
import { ProjectId } from "@/wab/shared/ApiSchema";
import { Bundler } from "@/wab/shared/bundler";
import { assert, ensure, spawn } from "@/wab/shared/common";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { Site, HostLessPackageInfo, ensureKnownProjectDependency } from "@/wab/shared/model/classes";
import { assertSiteInvariants } from "@/wab/shared/site-invariants";
import semver from "semver";
import { EntityManager } from "typeorm";
import { HostlessLibraryVersion } from "@/wab/server/entities/CustomEntities";
import { captureLibraryArtifact } from "@/wab/server/loader/library-artifacts";
import { externalizeSiteThumbnails } from "@/wab/server/loader/library-thumbnails";

const { Command } = require("commander");

async function publishHostlessProjects(
  em: EntityManager,
  selectedProjectId?: ProjectId,
  breaking = false,
) {
  const db = new DbMgr(em, SUPER_USER);
  await ensureDevFlags(db);
  const hostLessWorkspaceId = DEVFLAGS.hostLessWorkspaceId;
  if (!hostLessWorkspaceId) {
    logger().info("No hostless workspace ID");
    return;
  }
  const workspaceProjects = await db.getProjectsByWorkspaces([
    hostLessWorkspaceId,
  ]);
  const hostlessProjects = selectedProjectId
    ? workspaceProjects.filter((project) => project.id === selectedProjectId)
    : workspaceProjects;
  assert(hostlessProjects.length > 0, () =>
    selectedProjectId
      ? `Hostless project ${selectedProjectId} not found in workspace ${hostLessWorkspaceId}`
      : "No projects found for workspace " + hostLessWorkspaceId,
  );
  const plumeSite = await loadPlumeSite(db);

  const updatedProjects: string[] = [];

  for (const project of hostlessProjects) {
    const projectId = project.id;
    logger().info(`Updating project ${project.name} - ${projectId}`);

    if (DEVFLAGS.manuallyUpdatedHostLessProjectIds.includes(projectId)) {
      logger().info(
        `Skipping project ${project.name} - ${projectId} (marked for manual updating)`,
      );
      updatedProjects.push(project.name);
      continue;
    }

    if (await publishHostlessProject(db, projectId, { plumeSite, breaking })) {
      logger().info("Project updated");
      updatedProjects.push(project.name);
    } else {
      logger().info("No changes detected");
    }
  }
}

export async function publishHostlessProject(
  db: DbMgr,
  projectId: ProjectId,
  opts?: {
    plumeSite?: Site;
    hostLessPackageInfo?: HostLessPackageInfo;
    /** Mark nested prop-schema or runtime behavior changes that remove no top-level param. */
    breaking?: boolean;
  },
) {
  const project = await db.getProjectById(projectId);
  const plumeSite = opts?.plumeSite ?? (await loadPlumeSite(db));

  const pkgId = ensure(
    await db.getPkgByProjectId(projectId),
    () =>
      "Expected pkgId to exist - should manually publish the first version of hostless projects",
  ).id;
  const latestVersion = await db.getPkgVersion(pkgId);
  const bundler = new Bundler();
  const bundle = await getMigratedBundle(latestVersion);
  const { siteOrProjectDep } = await unbundleSite(
    bundler,
    bundle,
    db,
    latestVersion,
  );
  const site = ensureKnownProjectDependency(siteOrProjectDep).site;
  if (opts?.hostLessPackageInfo) {
    const { name, npmPkg, cssImport, deps, registerCalls, minimumReactVersion } = opts.hostLessPackageInfo;
    Object.assign(ensure(site.hostLessPackageInfo, "Expected component library"), {
      name, npmPkg, cssImport, deps, registerCalls, minimumReactVersion,
    });
  }
  // Params the new registrations no longer declare make this a breaking release.
  const removedParams = await updateHostlessPackage(
    site,
    project.name,
    plumeSite,
  );
  const hasBreakingParamRemoval = Object.keys(removedParams).length > 0;
  if (process.env.PREVIEW_ORIGIN) { await externalizeSiteThumbnails(site); }
  const newBundle = bundler.bundle(
    siteOrProjectDep,
    latestVersion.id,
    await getLastBundleVersion(),
  );

  const previousArtifact = process.env.PREVIEW_ORIGIN
    ? await db.getEntMgr().findOne(HostlessLibraryVersion, { pkgVersionId: latestVersion.id })
    : undefined;
  const currentArtifact = process.env.PREVIEW_ORIGIN ? await captureLibraryArtifact(site) : undefined;
  if (JSON.stringify(bundle) === JSON.stringify(newBundle) &&
      (!currentArtifact || previousArtifact?.artifact.digest === currentArtifact.digest)) {
    return false;
  }

  // Make sure the new bundle isn't broken
  assertSiteInvariants(site);
  logger().info("Saving new version and publishing...");
  // Make sure we're able to identify whether the project changed or not
  await updateHostlessPackage(site, project.name, plumeSite);
  if (process.env.PREVIEW_ORIGIN) { await externalizeSiteThumbnails(site); }
  const newBundle2 = bundler.bundle(
    siteOrProjectDep,
    latestVersion.id,
    await getLastBundleVersion(),
  );

  assert(
    JSON.stringify(newBundle) === JSON.stringify(newBundle2),
    () => "Re-applying the changes resulted in a different bundle!",
  );

  const projectBundle = bundler.bundle(
    site,
    // We use the pkgVersion id because that's what we used to unbundle
    latestVersion.id,
    await getLastBundleVersion(),
  );

  const rev = await db.getLatestProjectRev(projectId);
  await db.saveProjectRev({
    projectId,
    data: JSON.stringify(projectBundle),
    revisionNum: rev.revision + 1,
  });

  await db.publishProject(
    projectId,
    semver.inc(
      latestVersion.version,
      hasBreakingParamRemoval || opts?.breaking ? "major" : "minor",
    ) ?? undefined,
    [],
    "",
  );
  return true;
}

async function loadPlumeSite(db: DbMgr) {
  const plumePkgVersion = await db.getPlumePkgVersion();
  const plumeSite = ensureKnownProjectDependency(
    (
      await unbundleSite(
        new Bundler(),
        await getMigratedBundle(plumePkgVersion),
        db,
        plumePkgVersion,
      )
    ).siteOrProjectDep,
  ).site;
  return plumeSite;
}

async function main() {
  logger().info("Start script...");
  const opts = new Command("custom-script")
    .option("-db, --dburi <dburi>", "Database uri", DEFAULT_DATABASE_URI)
    .option("--project-id <projectId>", "Publish only this hostless project")
    .option("--breaking", "Publish changed libraries as a major version")
    .parse(process.argv)
    .opts();
  await ensureDbConnections(opts.dburi, {
    useEnvPassword: true,
  });
  const con = await getDefaultConnection();

  try {
    await con.transaction(async (em) => {
      await publishHostlessProjects(em, opts.projectId, opts.breaking);
    });
  } finally {
    await closeDbConnections();
  }
}

if (require.main === module) {
  spawn(
    main().catch((err) => {
      logger().error("Hostless publication failed", {
        error: String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      process.exit(1);
    }),
  );
}
