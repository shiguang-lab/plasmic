import { execFile } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";
import { randomUUID } from "crypto";
import { loadConfig } from "@/wab/server/config";
import { ensureDbConnection } from "@/wab/server/db/DbCon";
import { DbMgr, SUPER_USER } from "@/wab/server/db/DbMgr";
import { unbundlePkgVersion } from "@/wab/server/db/DbBundleLoader";
import { parseMasterPkg } from "@/wab/server/pkg-mgr";
import { Pkg } from "@/wab/server/entities/Entities";
import { HostlessLibraryVersion } from "@/wab/server/entities/CustomEntities";
import { Bundler } from "@/wab/shared/bundler";
import { PLUME_INSERTABLE_ID } from "@/wab/shared/insertables";
import { assert, ensure } from "@/wab/shared/common";

/** Run with tools/run.bash against a disposable plasmic_preview_test database. */
async function main() {
  const uri = loadConfig().databaseUri;
  assert(new URL(uri).pathname === "/plasmic_preview_test", "Use a disposable plasmic_preview_test database");
  const con = await ensureDbConnection(uri, "default");
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "library-publication-test-"));
  const exec = promisify(execFile);
  const name = `library-e2e-${randomUUID().slice(0, 8)}`;
  const packageName = "@preview-test/dynamic-library";
  try {
    await con.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await con.runMigrations({ transaction: "all" });
    // Seed the actual Plume metadata used by library upgrades, without IAM or app data.
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
    assert(!(await con.manager.findOne(Pkg, { name })), "Use a fresh database: library-e2e already exists");
    const source = path.join(temp, "source");
    await fs.mkdir(source);
    await fs.writeFile(path.join(source, "package.json"), JSON.stringify({ name: packageName, version: "1.0.0", main: "index.js" }));
    await fs.writeFile(path.join(source, "index.js"), `import {registerComponent} from "@plasmicapp/host"; import {Counter} from "./Counter.js"; export function registerAll(){registerComponent(Counter,{name:"dynamic-counter",props:{label:{type:"string",defaultValue:"Counter"}},importPath:"${packageName}/Counter",importName:"Counter"});}`);
    const configFile = path.join(temp, "library.json");
    const pack = async (label: string) => {
      await fs.writeFile(path.join(source, "Counter.js"), `export function Counter(){return ${JSON.stringify(label)};}`);
      const packed = await exec("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", temp], { cwd: source });
      const tarball = path.join(temp, JSON.parse(packed.stdout)[0].filename);
      await fs.writeFile(configFile, JSON.stringify({ name, packages: { [packageName]: `file:${tarball}` } }));
    };
    const publish = (...args: string[]) => exec("bash", ["tools/run.bash", "src/wab/server/db/publish-library.ts", configFile, ...args], {
      cwd: process.cwd(), env: { ...process.env, DATABASE_URI: uri, PREVIEW_ORIGIN: "https://preview.plasmic.shiguanglab.com" }, timeout: 120000,
    });
    await pack("fixed-v1");
    await publish();
    const pkg = ensure(await con.manager.findOne(Pkg, { name }), "Missing published library");
    const firstVersion = await db.getPkgVersion(pkg.id);
    const firstArtifact = ensure(await con.manager.findOne(HostlessLibraryVersion, { pkgVersionId: firstVersion.id }), "Missing first artifact").artifact;
    const firstDependency = await unbundlePkgVersion(db, new Bundler(), firstVersion);
    await pack("fixed-v2");
    await publish();
    const secondVersion = await db.getPkgVersion(pkg.id);
    assert(secondVersion.id !== firstVersion.id, "Code-only changes must publish a new library version");
    const secondArtifact = ensure(await con.manager.findOne(HostlessLibraryVersion, { pkgVersionId: secondVersion.id }), "Missing second artifact").artifact;
    const secondDependency = await unbundlePkgVersion(db, new Bundler(), secondVersion);
    assert(firstDependency.site.components[0].uuid === secondDependency.site.components[0].uuid, "Library updates must preserve component identity");
    const exportCode = (artifact: typeof firstArtifact) => Buffer.from(artifact.files[artifact.imports[`${packageName}/Counter`]], "base64").toString();
    assert(exportCode(firstArtifact).includes("fixed-v1"), "First code snapshot changed");
    assert(exportCode(secondArtifact).includes("fixed-v2"), "Second code snapshot missing");
    await publish();
    assert((await db.getPkgVersion(pkg.id)).id === secondVersion.id, "Identical code must not publish another version");
    let refused = false;
    try { await publish("--snapshot", firstVersion.version); } catch (error) { refused = error.stderr.includes("immutable"); }
    assert(refused, "Existing artifacts must not be overwritten");
    const persisted = ensure(await con.manager.findOne(HostlessLibraryVersion, { pkgVersionId: firstVersion.id }), "Original artifact disappeared");
    assert(persisted.artifact.digest === firstArtifact.digest, "Original artifact digest changed");
    console.log("PASS: npm tarball registration, code-only release, stable component identity, unchanged release deduplication and immutable old artifacts");
  } finally {
    await con.close();
    await fs.rm(temp, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
