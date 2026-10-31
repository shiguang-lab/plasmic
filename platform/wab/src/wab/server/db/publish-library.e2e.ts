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
import { getHostlessLibraryCanvas, getHostlessLibraryRelease } from "@/wab/server/routes/hostless-library-artifacts";
import { getDependencyModelResource, withDependencyModelResources } from "@/wab/server/routes/dependency-model-resources";
import { getPkgVersionByProjectId } from "@/wab/server/routes/projects";
import { DEVFLAGS } from "@/wab/shared/devflags";
import express from "express";
import { runInNewContext } from "vm";
import { checkShiguangOrigin } from "@/wab/server/auth/shiguang";
const { LibraryCache } = require("../../../../../../desktop/src/library-cache.cjs");

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
      const additionalProps = label === "fixed-v2" ? ',extra:{type:"string"},children:{type:"slot"}' : "";
      await fs.writeFile(path.join(source, "index.js"), `import {registerComponent} from "@plasmicapp/host"; import {Counter} from "./Counter.js"; export function registerAll(){registerComponent(Counter,{name:"dynamic-counter",props:{label:{type:"string",defaultValue:"Counter"}${additionalProps}},importPath:"${packageName}/Counter",importName:"Counter"});}`);
      await fs.writeFile(path.join(source, "Counter.js"), `export function Counter(){return ${JSON.stringify(label)};}`);
      const packed = await exec("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", temp], { cwd: source });
      const tarball = path.join(temp, JSON.parse(packed.stdout)[0].filename);
      await fs.writeFile(configFile, JSON.stringify({ name, packages: { [packageName]: `file:${tarball}` } }));
    };
    const publish = (...args: string[]) => exec("bash", ["tools/run.bash", "src/wab/server/db/publish-library.ts", configFile, ...args], {
      cwd: process.cwd(), env: { ...process.env, DATABASE_URI: uri, PREVIEW_ORIGIN: "https://plasmic-preview.shiguanglab.com" }, timeout: 120000,
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
    assert(!firstDependency.site.components[0].params.some(p => p.variable.name === "extra"), "Old definition changed");
    assert(secondDependency.site.components[0].params.some(p => p.variable.name === "extra"), "New prop definition missing");
    assert(secondDependency.site.components[0].params.some(p => p.variable.name === "children"), "New slot definition missing");
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
    // Exercise the real publication -> authorized HTTP -> Desktop cache path.
    const app = express();
    const flags = { ...DEVFLAGS, ...JSON.parse((await db.tryGetDevFlagOverrides())?.data ?? "{}") };
    app.use((req, _res, next) => {
      Object.assign(req, { con, noTxMgr: con?.manager, cookies: {}, devflags: flags, shiguangIdentity: { roles: [] }, config: { host: origin } });
      next();
    });
    app.use(checkShiguangOrigin);
    app.use(express.json());
    app.use((req, _res, next) => { req.body ??= {}; next(); });
    app.get("/api/v1/hostless-libraries/:name/canvas", (req, res, next) => getHostlessLibraryCanvas(req, res).catch(next));
    app.get("/api/v1/hostless-libraries/:name/release", (req, res, next) => getHostlessLibraryRelease(req, res).catch(next));
    app.get("/api/v1/pkgs/projectId/:projectId", withDependencyModelResources(getPkgVersionByProjectId));
    app.get("/api/v1/dependency-models/:resourceId", (req, res, next) => getDependencyModelResource(req, res).catch(next));
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    const address = server.address();
    assert(address && typeof address !== "string", "Missing test HTTP port");
    const origin = `http://127.0.0.1:${address.port}`;
    const identity = { epoch: 0, value: { user: { id: "test-account" } }, async read() { return this.value; } };
    const requests: { path: string; responseBytes: number; transferredModels: number }[] = [];
    const options = {
      directory: path.join(temp, "desktop-cache"), studioOrigin: origin,
      buildId: "one-unchanged-renderer", identity,
      remoteFetch: async (request: Request) => {
        const response = await fetch(request);
        const body = await response.clone().text();
        const json = response.headers.get("content-type")?.includes("application/json") ? JSON.parse(body) : undefined;
        requests.push({ path: new URL(request.url).pathname, responseBytes: Buffer.byteLength(body), transferredModels: new URL(request.url).pathname.includes("/dependency-models/") ? 1 : [json?.pkg, ...(json?.depPkgs ?? [])].filter(entry => entry?.model).length });
        return response;
      },
    };
    try {
      // Two real first reads must publish one committed resource identity.
      const openingUrl = `${origin}/api/v1/pkgs/projectId/${pkg.projectId}?version=${encodeURIComponent(JSON.stringify(firstVersion.version))}`;
      const openings = await Promise.all([fetch(openingUrl), fetch(openingUrl)]);
      assert(openings.every(response => response.status === 200), "Concurrent first package reads failed");
      const packets = await Promise.all(openings.map(response => response.json()));
      assert(packets[0].pkg.modelResourceId === packets[1].pkg.modelResourceId, "Concurrent reads emitted different resource identities");
      assert(packets.every(packet => packet.pkg.modelResourceId && !packet.pkg.model), "First responses must contain resource references");
      const rows = await con.query('SELECT count(*)::int AS n FROM dependency_model_resource WHERE "pkgVersionId"=$1', [firstVersion.id]);
      assert(rows[0].n === 1, "Concurrent first reads created duplicate model resources");
      const firstResource = await fetch(`${origin}/api/v1/dependency-models/${packets[0].pkg.modelResourceId}`);
      assert(firstResource.status === 200, "Resource must be downloadable immediately after its reference is returned");
      await firstResource.arrayBuffer();
      const load = async (version: string, label: string, hasExtra: boolean) => {
        const cache = new LibraryCache(options); // Simulate a process restart.
        const response = await cache.fetch(new Request(`${origin}/api/v1/pkgs/projectId/${pkg.projectId}?version=${encodeURIComponent(JSON.stringify(version))}`));
        assert(response.ok, `Package HTTP ${response.status}`);
        const data = await response.json();
        await Promise.all([data.pkg, ...data.depPkgs].map(async entry => {
          if (entry.modelResourceId) {
            const resource = await cache.fetch(new Request(`${origin}/api/v1/dependency-models/${entry.modelResourceId}`));
            assert(resource.ok, `Model resource HTTP ${resource.status}`);
            entry.model = await resource.json();
            delete entry.modelResourceId;
          }
        }));
        const resolved = version === "latest" ? secondVersion.version : version;
        assert(data.pkg.version === resolved, "Model latest/exact release selection disagrees with code");
        const dependency = await unbundlePkgVersion(db, new Bundler(), { ...data.pkg, model: JSON.stringify(data.pkg.model) });
        assert(dependency.site.components[0].params.some(p => p.variable.name === "extra") === hasExtra, "Cached model belongs to another release");
        const code = await cache.fetch(new Request(`${origin}/api/v1/hostless-libraries/${name}/canvas?version=${resolved}&pkgId=${pkg.id}`));
        const frame = { window: { __Sub: {} } } as any;
        runInNewContext(await code.text(), frame);
        const registered = frame.__PlasmicComponentRegistry[0];
        assert(registered.component() === label, "Cached implementation belongs to another release");
        assert(!!registered.meta.props.extra === hasExtra, "Registration and model props disagree");
        assert(!!registered.meta.props.children === hasExtra, "Registration and model slots disagree");
      };
      await load(firstVersion.version, "fixed-v1", false);
      await load(firstVersion.version, "fixed-v1", false);
      await load("latest", "fixed-v2", true);
      await load(firstVersion.version, "fixed-v1", false); // Undo/manual old-version selection.
      const codeRequests = requests.filter(request => request.path.endsWith("/canvas"));
      const modelRequests = requests.filter(request => request.path.includes("/pkgs/"));
      assert(codeRequests.length === 2, "Each code release should download only once across restarts");
      assert(modelRequests.length === 4, "Current package permissions and version must still be checked");
      assert(modelRequests.every(request => request.transferredModels === 0), "Package responses should contain only model resource references");
      assert(requests.filter(request => request.path.includes("/dependency-models/")).length === 2, "Only two distinct model resources should download across reopen and undo");
      const metadataUrl = `${origin}/api/v1/pkgs/projectId/${pkg.projectId}?version=${encodeURIComponent(JSON.stringify(firstVersion.version))}`;
      const metadata = await fetch(metadataUrl);
      const etag = ensure(metadata.headers.get("etag"), "Missing metadata ETag");
      assert(etag.includes("model-resource-v1-"), "Resource references need a distinct representation ETag");
      const oldRepresentation = await fetch(metadataUrl, { headers: { "If-None-Match": etag.replace("model-resource-v1-", "") } });
      assert(oldRepresentation.status === 200 && (await oldRepresentation.json()).pkg.modelResourceId, "Old inline-model ETags must not suppress resource references");
      const unchanged = await fetch(metadataUrl, { headers: { "If-None-Match": etag } });
      assert(unchanged.status === 304, "Current metadata ETags should retain normal conditional GET semantics");
      console.log(`CACHE HTTP EVIDENCE: ${JSON.stringify(requests)}`);
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
    console.log("PASS: tarball publication, stable component identity, immutable releases, latest model selection, code/Props/Slots alignment, persistent cache, zero warm code requests and zero warm model bodies");
  } finally {
    await con.close();
    await fs.rm(temp, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
