import { execFile } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";
import semver from "semver";
import { loadConfig } from "@/wab/server/config";
import { ensureDbConnection } from "@/wab/server/db/DbCon";
import { DbMgr, SUPER_USER } from "@/wab/server/db/DbMgr";
import { publishHostlessProject } from "@/wab/server/db/PublishHostless";
import { unbundlePkgVersion } from "@/wab/server/db/DbBundleLoader";
import { HostlessLibraryVersion } from "@/wab/server/entities/CustomEntities";
import { buildLibraryRegistration, captureLibraryArtifact, librarySources, registrationEntry } from "@/wab/server/loader/library-artifacts";
import { Bundler } from "@/wab/shared/bundler";
import { assert, ensure, ensureArray } from "@/wab/shared/common";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { HostLessPackageInfo } from "@/wab/shared/model/classes";
import type { ProjectId } from "@/wab/shared/ApiSchema";

interface LibraryConfig {
  name: string;
  packages: Record<string, string>;
  moduleRoot?: string;
  projectId?: string;
  cssImport?: string[];
  deps?: string[];
  registerCalls?: string[];
  minimumReactVersion?: string;
  sectionLabel?: string;
  displayName?: string;
}

/** Administrator command. Library code is executed only during explicit registration. */
async function main() {
  const configPath = ensure(process.argv[2], "Usage: publish-library.ts <config.json> [--snapshot <version>]");
  const config: LibraryConfig = JSON.parse(await fs.readFile(configPath, "utf8"));
  assert(/^[a-z0-9][a-z0-9-]*$/.test(config.name), "Library name must be lowercase letters, digits and hyphens");
  assert(Object.keys(config.packages).length > 0, "Library packages are required");
  for (const [pkg, spec] of Object.entries(config.packages)) {
    assert(/^(@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/.test(pkg), `Invalid npm package name ${pkg}`);
    assert(!!semver.valid(spec) || spec.startsWith("file:") && path.isAbsolute(spec.slice(5)) && spec.endsWith(".tgz"), `Use an exact npm version or file:/absolute/path.tgz for ${pkg}`);
  }
  ensure(process.env.PREVIEW_ORIGIN, "Set PREVIEW_ORIGIN before publishing component libraries");
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-library-"));
  let con: Awaited<ReturnType<typeof ensureDbConnection>> | undefined;
  try {
    const moduleRoot = config.moduleRoot
      ? path.resolve(path.dirname(path.resolve(configPath)), config.moduleRoot)
      : path.join(temp, "source");
    if (!config.moduleRoot) {
      await fs.mkdir(moduleRoot, { recursive: true });
      await fs.writeFile(path.join(moduleRoot, "package.json"), JSON.stringify({ private: true, dependencies: config.packages }));
      await promisify(execFile)("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: moduleRoot, timeout: 300000 });
    }
    const info = new HostLessPackageInfo({
      name: config.name, npmPkg: Object.keys(config.packages),
      cssImport: config.cssImport ?? [], deps: config.deps ?? [],
      registerCalls: config.registerCalls ?? [], minimumReactVersion: config.minimumReactVersion ?? "18.0.0",
    });
    for (const [pkg, spec] of Object.entries(config.packages)) {
      const installed = JSON.parse(await fs.readFile(path.join(moduleRoot, "node_modules", pkg, "package.json"), "utf8"));
      assert(!semver.valid(spec) || installed.version === spec, `Installed ${pkg}@${installed.version} does not match configured ${spec}`);
    }
    // External React/Host imports in the registration bundle use the platform runtime.
    await fs.symlink(path.resolve(process.cwd(), "node_modules"), path.join(temp, "node_modules"));
    const serverFile = path.join(temp, `${config.name}.cjs`);
    const serverSource = await buildLibraryRegistration(
      registrationEntry({ hostLessPackageInfo: info }, true),
      moduleRoot, "node",
    );
    await fs.writeFile(serverFile, serverSource);
    con = await ensureDbConnection(loadConfig().databaseUri, "default");
    await con.transaction(async (em) => {
      await em.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`library:${config.name}`]);
      const db = new DbMgr(em, SUPER_USER);
      const flags = JSON.parse((await db.tryGetDevFlagOverrides())?.data ?? "{}");
      const catalog: NonNullable<typeof DEVFLAGS.hostLessComponents> = flags.hostLessComponents ?? DEVFLAGS.hostLessComponents ?? [];
      const existing = catalog.find((entry) => entry.codeName === config.name);
      const projectId = config.projectId ?? (existing && ensureArray(existing.projectId)[0]);
      const serverModules: Record<string, string> = { [config.name]: serverFile };
      for (const depName of info.deps) {
        const entry = ensure(catalog.find((lib) => lib.codeName === depName), `Missing dependency library ${depName}`);
        const pkg = ensure(await db.getPkgByProjectId(ensure(ensureArray(entry.projectId)[0], "Missing library project")), "Missing dependency package");
        const version = await db.getPkgVersion(pkg.id);
        const release = ensure(await em.findOne(HostlessLibraryVersion, { pkgVersionId: version.id }), `Publish a code artifact for dependency ${depName} first`);
        const filename = path.join(temp, `${depName}.cjs`);
        await fs.writeFile(filename, release.artifact.server);
        serverModules[depName] = filename;
      }
      await librarySources.run({ moduleRoot, serverModules }, async () => {
        const snapshotIndex = process.argv.indexOf("--snapshot");
        const bundler = new Bundler();
        let dependency;
        if (snapshotIndex >= 0) {
          const id = ensure(projectId, "Snapshot requires a projectId or registered library name");
          const pkg = ensure(await db.getPkgByProjectId(id), "Missing library package");
          const version = ensure(process.argv[snapshotIndex + 1], "Snapshot version is required");
          assert(!!semver.valid(version), "Snapshot requires an exact Plasmic library version");
          const pkgVersion = await db.getPkgVersion(pkg.id, version);
          dependency = await unbundlePkgVersion(db, bundler, pkgVersion);
          assert(dependency.site.hostLessPackageInfo?.name === config.name, "Snapshot library name does not match the selected version");
          assert(JSON.stringify([...ensure(dependency.site.hostLessPackageInfo, "Missing component library metadata").npmPkg].sort()) === JSON.stringify(Object.keys(config.packages).sort()), "Snapshot packages do not match the selected library version");
          const previous = await em.findOne(HostlessLibraryVersion, { pkgVersionId: pkgVersion.id });
          assert(!previous, "A library version artifact is immutable; publish a new version to change code");
          const artifact = await captureLibraryArtifact(dependency.site);
          await em.insert(HostlessLibraryVersion, { pkgVersionId: pkgVersion.id, artifact });
        } else if (projectId) {
          await publishHostlessProject(db, projectId as ProjectId, { hostLessPackageInfo: info });
          const pkg = ensure(await db.getPkgByProjectId(projectId), "Missing library package");
          dependency = await unbundlePkgVersion(db, bundler, await db.getPkgVersion(pkg.id));
        } else {
          dependency = await db.createHostLessProject(info, bundler);
        }
        await db.updateProject({ id: dependency.projectId, readableByPublic: true });
        flags.hostLessComponents = [
          ...catalog.filter((entry) => entry.codeName !== config.name),
          { type: "hostless-package", name: config.displayName ?? config.name,
            codeName: config.name, projectId: [dependency.projectId], hasCodeArtifacts: true,
            sectionLabel: config.sectionLabel ?? "Business components", isInstallOnly: true, isHeaderLess: true,
            items: [{ type: "hostless-component", componentName: `${config.name}-library`, displayName: config.displayName ?? config.name }],
          },
        ];
        await db.setDevFlagOverrides(JSON.stringify(flags));
        console.log(`Published ${config.name}@${dependency.version}; project ${dependency.projectId}`);
      });
    });
  } finally {
    await con?.close();
    await fs.rm(temp, { recursive: true, force: true });
  }
}

if (require.main === module) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
