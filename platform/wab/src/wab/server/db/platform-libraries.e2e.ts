import { execFile } from "child_process";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";
import { loadConfig } from "@/wab/server/config";
import { unbundlePkgVersion, unbundleProjectFromData } from "@/wab/server/db/DbBundleLoader";
import { closeDbConnections, ensureDbConnections, getDefaultConnection } from "@/wab/server/db/DbCon";
import { DbMgr, SUPER_USER } from "@/wab/server/db/DbMgr";
import {
  analyzePlatformLibraries,
  enablePlatformLibraries,
  upgradePlatformLibraryConsumers,
} from "@/wab/server/db/platform-libraries";
import { Pkg, Project } from "@/wab/server/entities/Entities";
import { parseMasterPkg } from "@/wab/server/pkg-mgr";
import { $$$ } from "@/wab/shared/TplQuery";
import { getBaseVariant } from "@/wab/shared/Variants";
import { Bundler } from "@/wab/shared/bundler";
import { parseBundle } from "@/wab/shared/bundles";
import { assert, ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { codeLit, tryExtractJson } from "@/wab/shared/core/exprs";
import { createSite } from "@/wab/shared/core/sites";
import { flattenTpls, isTplComponent, mkTplComponentX } from "@/wab/shared/core/tpls";
import { PLUME_INSERTABLE_ID } from "@/wab/shared/insertables";
import { TplMgr } from "@/wab/shared/TplMgr";

/**
 * Run with tools/run.bash against a disposable plasmic_platform_libraries_test
 * database. Covers enabling automatic platform library upgrades for existing
 * projects, upgrading them, and upgrading them again on later releases.
 */
async function main() {
  const uri = loadConfig().databaseUri;
  assert(new URL(uri).pathname === "/plasmic_platform_libraries_test", "Use a disposable plasmic_platform_libraries_test database");
  await ensureDbConnections(uri);
  const con = await getDefaultConnection();
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "platform-libraries-test-"));
  const exec = promisify(execFile);
  const name = `platform-e2e-${randomUUID().slice(0, 8)}`;
  const packageName = "@platform-test/library";
  try {
    await con.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await con.runMigrations({ transaction: "all" });
    await con.transaction(async (em) => {
      if (await em.findOne(Pkg, { sysname: "plume" })) { return; }
      const db = new DbMgr(em, SUPER_USER);
      const { deps, master } = parseMasterPkg(PLUME_INSERTABLE_ID);
      for (const [id, bundle] of [...deps, master]) {
        const root = bundle.map[bundle.root];
        const { project, rev } = await db.createProject({ name: root.name, projectId: root.projectId, isPublic: true });
        await em.insert(Pkg, { id: root.pkgId, name: root.name, projectId: project.id, createdAt: new Date(), updatedAt: new Date(), sysname: id === master[0] ? "plume" : null });
        await db.insertPkgVersion(root.pkgId, root.version, JSON.stringify(bundle), [], "", rev.revision, undefined, id);
      }
    });
    const db = new DbMgr(con.manager, SUPER_USER);
    assert(!JSON.parse((await db.tryGetDevFlagOverrides())?.data ?? "{}").hostLessWorkspaceId, "Use a fresh database: platform libraries are already enabled");

    const source = path.join(temp, "source");
    await fs.mkdir(source);
    await fs.writeFile(path.join(source, "package.json"), JSON.stringify({ name: packageName, version: "1.0.0", main: "index.js" }));
    const release = async (libraryName: string, label: string, props: string[]) => {
      const propsMeta = props.map((p) => `${p}:{type:"string"}`).join(",");
      await fs.writeFile(path.join(source, "index.js"), `import {registerComponent} from "@plasmicapp/host"; import {Counter} from "./Counter.js"; export function registerAll(){registerComponent(Counter,{name:"platform-counter",props:{${propsMeta}},importPath:"${packageName}/Counter",importName:"Counter"});}`);
      await fs.writeFile(path.join(source, "Counter.js"), `export function Counter(props){return ${JSON.stringify(label)} + props.label;}`);
      const packed = await exec("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", temp], { cwd: source });
      const tarball = path.join(temp, JSON.parse(packed.stdout)[0].filename);
      const config = path.join(temp, `${libraryName}.json`);
      await fs.writeFile(config, JSON.stringify({ name: libraryName, packages: { [packageName]: `file:${tarball}` } }));
      await exec("bash", ["tools/run.bash", "src/wab/server/db/publish-library.ts", config], {
        cwd: process.cwd(), env: { ...process.env, DATABASE_URI: uri, PREVIEW_ORIGIN: "https://plasmic-preview.shiguanglab.com" }, timeout: 180000,
      });
      const pkg = ensure(await con.manager.findOne(Pkg, { name: libraryName }), "Missing published library");
      return db.getPkgVersion(pkg.id);
    };

    // A library and a project using it exist before automatic upgrades, like on NAS.
    const v1 = await release(name, "v1", ["label", "extra"]);
    const libraryProject = ensure(await con.manager.findOne(Project, { id: ensure(await con.manager.findOne(Pkg, { id: v1.pkgId }), "Pkg").projectId }), "Library project");
    assert(!libraryProject.workspaceId, "Existing libraries start outside any workspace");
    const bundler = new Bundler();
    const dependency = await unbundlePkgVersion(db, bundler, v1);
    const site = createSite();
    site.projectDependencies.push(dependency);
    const tplMgr = new TplMgr({ site });
    const consumerComponent = tplMgr.addComponent({ type: ComponentType.Plain, name: "Consumer" });
    const counter = ensure(dependency.site.components.find((c) => c.name === "platform-counter"), "Library component");
    $$$(consumerComponent.tplTree).append(mkTplComponentX({
      component: counter, baseVariant: getBaseVariant(consumerComponent),
      args: { label: codeLit("Kept"), extra: codeLit("Removed in v2") },
    }));
    const { project: consumer } = await db.createProjectAndSaveRev({ site, bundler, name: "Consumer project" });
    await db.publishProject(consumer.id, undefined, [], "");
    const v2 = await release(name, "v2", ["label"]);
    assert(v2.version !== v1.version, "v2 is a new library version");

    const before = await analyzePlatformLibraries(db);
    const consumers = before.consumers.filter((c) => c.projectId === consumer.id);
    assert(consumers.length === 2, `Expected the revision and the published version to need upgrades, got ${JSON.stringify(consumers)}`);
    for (const c of consumers) {
      assert(c.blockers.length === 0, `Unexpected blockers ${c.blockers}`);
      assert(JSON.stringify(c.droppedArgs) === JSON.stringify([{ component: "platform-counter", param: "extra", count: 1 }]), `Dropped args ${JSON.stringify(c.droppedArgs)}`);
      assert(c.upgrades[0].from === v1.version && c.upgrades[0].to === v2.version, "Upgrade versions");
    }

    let refused = false;
    try { await con.transaction((em) => enablePlatformLibraries(em)); } catch (error) { refused = String(error).includes("platform-counter.extra"); }
    assert(refused, "Enabling must refuse unreviewed dropped settings");
    assert(!JSON.parse((await db.tryGetDevFlagOverrides())?.data ?? "{}").hostLessWorkspaceId, "A refused enable must not change dev flags");

    const hostlessBefore = (await db.getHostlessVersion()).versionCount;
    const enabled = await con.transaction((em) => enablePlatformLibraries(em, { acceptDroppedArgs: true }));
    const overrides = JSON.parse(ensure(await db.tryGetDevFlagOverrides(), "Overrides").data);
    assert(overrides.hostLessWorkspaceId === enabled.workspaceId, "Workspace flag");
    assert((await db.getProjectById(libraryProject.id)).workspaceId === enabled.workspaceId, "Library moved into the workspace");
    assert(overrides.hostLessComponents.find((e: any) => e.codeName === name).hasCodeArtifacts === true, "Catalog code artifact flag");
    assert((await db.getHostlessVersion()).versionCount === hostlessBefore + 1, "Open Studio sessions are told to reload");

    const { results } = await upgradePlatformLibraryConsumers(db);
    const failures = results.filter((r) => r.status === "failed");
    assert(failures.length === 0, `Upgrade failures: ${JSON.stringify(failures)}`);
    const rev = await db.getLatestProjectRev(consumer.id);
    assert(parseBundle(rev).deps.includes(v2.id) && !parseBundle(rev).deps.includes(v1.id), "Revision imports v2");
    const consumerVersion = await db.getPkgVersion(ensure(await db.getPkgByProjectId(consumer.id), "Consumer pkg").id);
    assert(parseBundle(consumerVersion).deps.includes(v2.id), "Published consumer version imports v2");
    const upgradedSite = await unbundleProjectFromData(db, new Bundler(), rev);
    const instance = ensure(flattenTpls(ensure(upgradedSite.components.find((c) => c.name === "Consumer"), "Consumer").tplTree).find(isTplComponent), "Library instance");
    const args = Object.fromEntries(instance.vsettings[0].args.map((a) => [a.param.variable.name, tryExtractJson(a.expr)]));
    assert(JSON.stringify(args) === JSON.stringify({ label: "Kept" }), `Settings after upgrade ${JSON.stringify(args)}`);
    assert((await analyzePlatformLibraries(db)).consumers.length === 0, "Nothing left to upgrade");

    const again = await con.transaction((em) => enablePlatformLibraries(em));
    assert(again.workspaceId === enabled.workspaceId && again.moved.length === 0, "Enable is repeatable");

    // A later release reaches the project when it is next loaded, without a manual upgrade.
    const v3 = await release(name, "v3", ["label"]);
    assert((await db.getHostlessVersion()).versionCount > hostlessBefore + 2, "Each release bumps the hostless version");
    const reopened = await unbundleProjectFromData(db, new Bundler(), await db.getLatestProjectRev(consumer.id));
    assert(reopened.projectDependencies.some((d) => d.version === v3.version), "Project loads v3");
    assert(parseBundle(await db.getLatestProjectRev(consumer.id)).deps.includes(v3.id), "Loaded upgrade is saved");

    // Libraries registered after enabling join the workspace.
    const other = await release(`${name}-new`, "new", ["label"]);
    const otherProject = ensure(await con.manager.findOne(Pkg, { id: other.pkgId }), "Pkg").projectId;
    assert((await db.getProjectById(otherProject)).workspaceId === enabled.workspaceId, "New library is in the workspace");
    console.log("PASS: dropped-setting gate, enable, upgrade with preserved settings, repeatable enable, upgrade on next load, new libraries in workspace");
  } finally {
    await closeDbConnections();
    await fs.rm(temp, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
