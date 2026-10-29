import { getMigratedBundle } from "@/wab/server/db/BundleMigrator";
import { DbMgr, NotFoundError, SUPER_USER } from "@/wab/server/db/DbMgr";
import { HostlessLibraryVersion } from "@/wab/server/entities/CustomEntities";
import { Project } from "@/wab/server/entities/Entities";
import { ensureDevFlags } from "@/wab/server/workers/worker-utils";
import type { BranchId, WorkspaceId } from "@/wab/shared/ApiSchema";
import { UnsafeBundle, parseBundle } from "@/wab/shared/bundles";
import { assert, ensure, ensureArray, mkShortUuid } from "@/wab/shared/common";
import { isRetiredHostlessLibrary } from "@/wab/shared/core/platform-libraries";
import {
  HostLessPackageInfo as CatalogPackage,
  DEVFLAGS,
} from "@/wab/shared/devflags";
import { IsNull, type EntityManager } from "typeorm";

/**
 * Platform component libraries are hostless projects in the
 * `hostLessWorkspaceId` workspace. The bundle migrator upgrades every project
 * importing an older version of one of them when that project is loaded. This
 * module selects those libraries, checks what an upgrade would change in
 * existing projects, enables the workspace and upgrades existing projects.
 */

export const PLATFORM_LIBRARY_WORKSPACE_NAME = "平台组件库";

export interface PlatformLibrary {
  name: string;
  projectId: string;
  pkgId: string;
  workspaceId: string | null;
  latestVersion: string;
  latestVersionId: string;
  versionCount: number;
  hasLatestArtifact: boolean;
}

export interface LibraryUpgrade {
  library: string;
  from: string;
  to: string;
}

export interface DroppedArg {
  component: string;
  param: string;
  count: number;
}

export interface ConsumerUpgrade {
  kind: "revision" | "version";
  /** ProjectRevision or PkgVersion id */
  id: string;
  projectId: string;
  branchId: string | null;
  name: string;
  /** Revision number or published version */
  label: string;
  upgrades: LibraryUpgrade[];
  /** Settings for library params the latest version no longer declares. */
  droppedArgs: DroppedArg[];
  /** Conditions under which the bundle migrator refuses the upgrade. */
  blockers: string[];
}

export interface PlatformLibraryReport {
  workspaceId: string | null;
  autoUpgradeHostless: boolean;
  libraries: PlatformLibrary[];
  retired: { name: string; projectId: string; latestVersion: string }[];
  /** Projects in the workspace that must not be upgraded automatically. */
  foreignWorkspaceProjects: { projectId: string; name: string; reason: string }[];
  /** Catalog entries whose `hasCodeArtifacts` differs from the stored code. */
  catalogMismatches: {
    codeName: string;
    projectId: string;
    hasCodeArtifacts: boolean;
    expected: boolean;
  }[];
  scanned: number;
  consumers: ConsumerUpgrade[];
  staleVersionIds: string[];
}

type Inst = { __type: string; [field: string]: any };
type Ref = { __ref: string } | { __xref: { uuid: string; iid: string } };

function deref(bundle: UnsafeBundle, ref: Ref | null | undefined) {
  return ref && "__ref" in ref
    ? (bundle.map[ref.__ref] as Inst | undefined)
    : undefined;
}

function rootSite(bundle: UnsafeBundle) {
  const root = bundle.map?.[bundle.root] as Inst | undefined;
  if (root?.__type === "ProjectDependency") {
    return deref(bundle, root.site);
  }
  return root?.__type === "Site" ? root : undefined;
}

function libraryName(bundle: UnsafeBundle): string | undefined {
  const site = rootSite(bundle);
  return site ? deref(bundle, site.hostLessPackageInfo)?.name : undefined;
}

interface ParamInfo {
  component: string;
  componentUuid: string;
  name: string;
  varUuid: string;
  slot: boolean;
}

interface LibraryIndex {
  components: Map<string, { uuid: string; name: string }>;
  paramsByComponentUuid: Map<string, ParamInfo[]>;
  params: Map<string, ParamInfo>;
}

/** Same param identity rule as upgradeProjectDep() in project-deps.ts. */
function indexLibrary(bundle: UnsafeBundle): LibraryIndex {
  const index: LibraryIndex = {
    components: new Map(),
    paramsByComponentUuid: new Map(),
    params: new Map(),
  };
  for (const [iid, inst] of Object.entries(bundle.map) as [string, Inst][]) {
    if (inst.__type !== "Component") {
      continue;
    }
    index.components.set(iid, { uuid: inst.uuid, name: inst.name });
    const params: ParamInfo[] = [];
    for (const ref of inst.params ?? []) {
      const param = ensure(deref(bundle, ref), "Missing library param");
      const variable = deref(bundle, param.variable);
      const typeName = deref(bundle, param.type)?.name;
      const info: ParamInfo = {
        component: inst.name,
        componentUuid: inst.uuid,
        name: variable?.name,
        varUuid: variable?.uuid,
        slot: typeName === "renderable" || typeName === "renderFunc",
      };
      params.push(info);
      index.params.set(ref.__ref, info);
    }
    index.paramsByComponentUuid.set(inst.uuid, params);
  }
  return index;
}

/** Catalog entries may name upstream projects that do not exist here. */
async function tryGetProject(db: DbMgr, projectId: string) {
  return db
    .getEntMgr()
    .findOne(Project, { where: { id: projectId, deletedAt: IsNull() } });
}

async function readOverrides(db: DbMgr): Promise<Record<string, any>> {
  return JSON.parse((await db.tryGetDevFlagOverrides())?.data ?? "{}");
}

/** Read-only. Safe to run against the production database. */
export async function analyzePlatformLibraries(
  db: DbMgr,
): Promise<PlatformLibraryReport> {
  const overrides = await readOverrides(db);
  const workspaceId: string | null = overrides.hostLessWorkspaceId ?? null;
  const catalog: CatalogPackage[] =
    overrides.hostLessComponents ?? DEVFLAGS.hostLessComponents ?? [];
  const candidateIds = new Set(
    catalog
      .filter((entry) => entry.type === "hostless-package")
      .flatMap((entry) => ensureArray(entry.projectId ?? [])),
  );
  if (workspaceId) {
    for (const project of await db.getProjectsByWorkspaces([
      workspaceId as WorkspaceId,
    ])) {
      candidateIds.add(project.id);
    }
  }

  const report: PlatformLibraryReport = {
    workspaceId,
    autoUpgradeHostless:
      overrides.autoUpgradeHostless ?? DEVFLAGS.autoUpgradeHostless,
    libraries: [],
    retired: [],
    foreignWorkspaceProjects: [],
    catalogMismatches: [],
    scanned: 0,
    consumers: [],
    staleVersionIds: [],
  };
  const latestVersionIds = new Map<string, PlatformLibrary>();
  const staleVersions = new Map<
    string,
    { library: PlatformLibrary; version: string }
  >();
  for (const projectId of candidateIds) {
    const project = await tryGetProject(db, projectId);
    if (!project) {
      continue;
    }
    const inWorkspace = !!workspaceId && project.workspaceId === workspaceId;
    const pkg = await db.getPkgByProjectId(projectId);
    const latest = pkg && (await db.tryGetPkgVersion(pkg.id));
    const name = latest && libraryName(parseBundle(latest));
    if (!pkg || !latest || !name) {
      if (inWorkspace) {
        report.foreignWorkspaceProjects.push({
          projectId,
          name: project.name,
          reason: "not a published code component library",
        });
      }
      continue;
    }
    if (isRetiredHostlessLibrary(name)) {
      report.retired.push({ name, projectId, latestVersion: latest.version });
      if (inWorkspace) {
        report.foreignWorkspaceProjects.push({
          projectId,
          name: project.name,
          reason: "retired library",
        });
      }
      continue;
    }
    const versions = await db.listPkgVersions(pkg.id);
    const library: PlatformLibrary = {
      name,
      projectId,
      pkgId: pkg.id,
      workspaceId: project.workspaceId,
      latestVersion: latest.version,
      latestVersionId: latest.id,
      versionCount: versions.length,
      hasLatestArtifact: !!(await db
        .getEntMgr()
        .findOne(HostlessLibraryVersion, { pkgVersionId: latest.id })),
    };
    report.libraries.push(library);
    latestVersionIds.set(latest.id, library);
    for (const version of versions) {
      if (version.id !== latest.id) {
        staleVersions.set(version.id, { library, version: version.version });
      }
    }
  }
  report.staleVersionIds = [...staleVersions.keys()];

  const libraryByProject = new Map(
    report.libraries.map((lib) => [lib.projectId, lib]),
  );
  for (const entry of catalog) {
    for (const projectId of ensureArray(entry.projectId ?? [])) {
      const library = libraryByProject.get(projectId);
      if (
        library &&
        entry.type === "hostless-package" &&
        !!entry.hasCodeArtifacts !== library.hasLatestArtifact
      ) {
        report.catalogMismatches.push({
          codeName: entry.codeName ?? library.name,
          projectId,
          hasCodeArtifacts: !!entry.hasCodeArtifacts,
          expected: library.hasLatestArtifact,
        });
      }
    }
  }

  const indexes = new Map<string, Promise<LibraryIndex>>();
  const getIndex = (pkgVersionId: string) => {
    let index = indexes.get(pkgVersionId);
    if (!index) {
      index = db
        .getPkgVersionById(pkgVersionId)
        .then((version) => indexLibrary(parseBundle(version)));
      indexes.set(pkgVersionId, index);
    }
    return index;
  };
  const libraryOf = (pkgVersionId: string) =>
    staleVersions.get(pkgVersionId)?.library ??
    latestVersionIds.get(pkgVersionId);

  const analyze = async (
    bundle: UnsafeBundle,
    consumer: Omit<ConsumerUpgrade, "upgrades" | "droppedArgs" | "blockers">,
  ) => {
    report.scanned++;
    const staleDeps = (bundle.deps ?? []).filter((id) => staleVersions.has(id));
    if (staleDeps.length === 0) {
      return;
    }
    const upgrades = staleDeps.map((id) => {
      const { library, version } = ensure(staleVersions.get(id), "Stale");
      return { library: library.name, from: version, to: library.latestVersion };
    });
    const blockers: string[] = [];
    const directLibraries = new Set(
      ((rootSite(bundle)?.projectDependencies ?? []) as Ref[])
        .map((ref) => ("__xref" in ref ? libraryOf(ref.__xref.uuid) : undefined))
        .filter((lib): lib is PlatformLibrary => !!lib),
    );
    for (const id of staleDeps) {
      const { library, version } = ensure(staleVersions.get(id), "Stale");
      if (!directLibraries.has(library)) {
        blockers.push(
          `${library.name}@${version} is used only through another dependency`,
        );
      }
    }
    const dropped = new Map<string, DroppedArg>();
    const removedComponents = new Set<string>();
    for (const inst of Object.values(bundle.map) as Inst[]) {
      const ref =
        inst.__type === "TplComponent"
          ? inst.component?.__xref
          : inst.__type === "Arg"
            ? inst.param?.__xref
            : undefined;
      const stale = ref && staleVersions.get(ref.uuid);
      if (!stale) {
        continue;
      }
      const [oldIndex, newIndex] = await Promise.all([
        getIndex(ref.uuid),
        getIndex(stale.library.latestVersionId),
      ]);
      if (inst.__type === "TplComponent") {
        const component = oldIndex.components.get(ref.iid);
        if (component && !newIndex.paramsByComponentUuid.has(component.uuid)) {
          removedComponents.add(`${stale.library.name} component ${component.name} was removed`);
        }
        continue;
      }
      const param = oldIndex.params.get(ref.iid);
      if (!param) {
        continue;
      }
      const kept = (
        newIndex.paramsByComponentUuid.get(param.componentUuid) ?? []
      ).some(
        (p) =>
          (p.varUuid === param.varUuid || p.name === param.name) &&
          p.slot === param.slot,
      );
      if (!kept) {
        const key = `${param.component}\u0000${param.name}`;
        const entry = dropped.get(key) ?? {
          component: param.component,
          param: param.name,
          count: 0,
        };
        entry.count++;
        dropped.set(key, entry);
      }
    }
    report.consumers.push({
      ...consumer,
      upgrades,
      droppedArgs: [...dropped.values()],
      blockers: [...blockers, ...removedComponents],
    });
  };

  const libraryPkgIds = new Set(report.libraries.map((lib) => lib.pkgId));
  const retiredProjectIds = new Set(report.retired.map((lib) => lib.projectId));
  for (const project of await db.listAllProjects()) {
    if (
      libraryByProject.has(project.id) ||
      retiredProjectIds.has(project.id)
    ) {
      continue;
    }
    const branches = await db.listBranchesForProject(project.id);
    for (const branchId of [undefined, ...branches.map((b) => b.id)]) {
      let rev;
      try {
        rev = await db.getLatestProjectRev(project.id, { branchId });
      } catch (error) {
        if (error instanceof NotFoundError) {
          continue;
        }
        throw error;
      }
      await analyze(parseBundle(rev), {
        kind: "revision",
        id: rev.id,
        projectId: project.id,
        branchId: branchId ?? null,
        name: project.name,
        label: `revision ${rev.revision}`,
      });
    }
  }
  for (const pkg of await db.listAllPkgs()) {
    if (libraryPkgIds.has(pkg.id) || retiredProjectIds.has(pkg.projectId)) {
      continue;
    }
    if (!(await tryGetProject(db, pkg.projectId))) {
      continue;
    }
    const version = await db.tryGetPkgVersion(pkg.id);
    if (version) {
      await analyze(parseBundle(version), {
        kind: "version",
        id: version.id,
        projectId: pkg.projectId,
        branchId: null,
        name: pkg.name,
        label: `version ${version.version}`,
      });
    }
  }
  return report;
}

export function describeDroppedArgs(report: PlatformLibraryReport) {
  return report.consumers.flatMap((consumer) =>
    consumer.droppedArgs.map(
      (arg) =>
        `${consumer.name} (${consumer.label}): ${arg.component}.${arg.param} ×${arg.count}`,
    ),
  );
}

export function describeBlockers(report: PlatformLibraryReport) {
  return report.consumers.flatMap((consumer) =>
    consumer.blockers.map(
      (blocker) => `${consumer.name} (${consumer.label}): ${blocker}`,
    ),
  );
}

/**
 * Moves the platform libraries into the platform library workspace and turns
 * on automatic upgrades. Runs in the caller's transaction; repeatable.
 */
export async function enablePlatformLibraries(
  em: EntityManager,
  opts: { acceptDroppedArgs?: boolean; workspaceName?: string } = {},
) {
  const db = new DbMgr(em, SUPER_USER);
  const report = await analyzePlatformLibraries(db);
  assert(
    report.libraries.length > 0,
    "No published code component library found in the catalog",
  );
  assert(
    report.autoUpgradeHostless,
    "autoUpgradeHostless is disabled in the dev flag overrides",
  );
  assert(
    report.foreignWorkspaceProjects.length === 0,
    () =>
      `Remove these projects from the platform library workspace first: ${report.foreignWorkspaceProjects
        .map((p) => `${p.name} (${p.projectId}, ${p.reason})`)
        .join("; ")}`,
  );
  const blockers = describeBlockers(report);
  assert(
    blockers.length === 0,
    () => `These projects cannot be upgraded:\n${blockers.join("\n")}`,
  );
  const dropped = describeDroppedArgs(report);
  assert(
    dropped.length === 0 || !!opts.acceptDroppedArgs,
    () =>
      `Upgrading removes settings of params the latest libraries no longer declare. Review them and rerun with --accept-dropped-args:\n${dropped.join("\n")}`,
  );

  const overrides = await readOverrides(db);
  let workspaceId = overrides.hostLessWorkspaceId as WorkspaceId | undefined;
  if (workspaceId) {
    await db.getWorkspaceById(workspaceId);
  } else {
    const name = opts.workspaceName ?? PLATFORM_LIBRARY_WORKSPACE_NAME;
    const team = await db.createSystemTeam(name);
    workspaceId = (
      await db.createWorkspaceWithId({
        id: mkShortUuid<WorkspaceId>(),
        name,
        description: "Code component libraries upgraded in every project",
        teamId: team.id,
      })
    ).id;
  }
  const moved: string[] = [];
  for (const library of report.libraries) {
    if (library.workspaceId !== workspaceId) {
      await db.updateProject({ id: library.projectId, workspaceId });
      moved.push(library.name);
    }
  }
  const libraryByProject = new Map(
    report.libraries.map((lib) => [lib.projectId, lib]),
  );
  if (overrides.hostLessComponents) {
    overrides.hostLessComponents = (
      overrides.hostLessComponents as CatalogPackage[]
    ).map((entry) => {
      const library = ensureArray(entry.projectId ?? [])
        .map((id) => libraryByProject.get(id))
        .find((lib) => !!lib);
      return library && entry.type === "hostless-package"
        ? { ...entry, hasCodeArtifacts: library.hasLatestArtifact }
        : entry;
    });
  }
  overrides.hostLessWorkspaceId = workspaceId;
  await db.setDevFlagOverrides(JSON.stringify(overrides));
  // Open Studio sessions reload, and stale saves are refused.
  await db.bumpHostlessVersion();
  return { workspaceId, moved, report };
}

/**
 * Upgrades the latest revision of every project and branch, and the latest
 * published version of every project, through the regular bundle migrator.
 * Requires both database pools, and the platform libraries to be enabled.
 */
export async function upgradePlatformLibraryConsumers(
  db: DbMgr,
  log?: (message: string) => void,
) {
  await ensureDevFlags(db);
  assert(
    DEVFLAGS.autoUpgradeHostless && !!DEVFLAGS.hostLessWorkspaceId,
    "Enable the platform library workspace first",
  );
  const report = await analyzePlatformLibraries(db);
  const stale = new Set(report.staleVersionIds);
  const results: (ConsumerUpgrade & { status: "upgraded" | "failed"; error?: string })[] = [];
  for (const consumer of report.consumers) {
    try {
      const entity =
        consumer.kind === "revision"
          ? await db.getLatestProjectRev(consumer.projectId, {
              branchId: (consumer.branchId ?? undefined) as BranchId | undefined,
            })
          : await db.getPkgVersionById(consumer.id);
      const bundle = await getMigratedBundle(entity);
      const remaining = bundle.deps.filter((id) => stale.has(id));
      assert(
        remaining.length === 0,
        `Still imports old library versions ${remaining.join(", ")}`,
      );
      results.push({ ...consumer, status: "upgraded" });
      log?.(`upgraded ${consumer.name} (${consumer.label})`);
    } catch (error) {
      results.push({
        ...consumer,
        status: "failed",
        error: error instanceof Error ? error.stack ?? error.message : String(error),
      });
      log?.(`FAILED ${consumer.name} (${consumer.label}): ${String(error)}`);
    }
  }
  return { report, results };
}
