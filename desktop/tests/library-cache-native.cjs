// Real sandboxed Chromium: normal project GET + exact model resource GET.
// No production session, project or installed App is used.
const { app, BrowserWindow, session } = require("electron");
const { createServer } = require("node:http");
const { createHash } = require("node:crypto");
const { gzipSync } = require("node:zlib");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const { LibraryCache } = require("../src/library-cache.cjs");
const origin = "https://library-cache.test";
const sha = value => createHash("sha256").update(value).digest("hex");
let profile, server, win;
(async () => {
  profile = await fs.mkdtemp(path.join(os.tmpdir(), "library-cache-native-"));
  app.setPath("userData", profile); app.setPath("sessionData", profile);
  await app.whenReady();
  const model = { version: "schema-1", map: { root: { name: "Button" } } };
  const code = "window.nativeRegistration = (window.nativeRegistration || 0) + 1;";
  const hits = { project: 0, model: 0, code: 0, history: 0, writes: 0, failedModel: 0 };
  server = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Headers", "content-type,cache-control");
    if (req.method === "OPTIONS") { res.setHeader("Access-Control-Allow-Methods", "GET,POST"); res.writeHead(204).end(); return; }
    assert.equal(req.headers["x-plasmic-model-cache"], undefined);
    const url = new URL(req.url, origin);
    let body;
    res.setHeader("Content-Type", "application/json");
    if (url.pathname === "/api/v1/projects/project" && req.method === "GET") {
      assert.equal(url.searchParams.get("includeStartup"), "true");
      hits.project++;
      body = JSON.stringify({ startup: { projectId: "project" }, rev: { revision: hits.project, data: "current-project" }, depPkgs: [{ id: "release", modelResourceId: "snapshot-v1" }] });
    } else if (url.pathname === "/api/v1/dependency-models/snapshot-v1") {
      hits.model++; assert.equal(req.method, "GET");
      body = JSON.stringify(model);
      res.setHeader("X-Plasmic-Model-Resource", JSON.stringify({ id: "snapshot-v1", digest: sha(body) }));
    } else if (url.pathname === "/api/v1/dependency-models/denied") {
      hits.failedModel++;
      res.statusCode = 403;
      body = JSON.stringify({ error: "Forbidden" });
      await new Promise(resolve => setTimeout(resolve, 25));
    } else if (url.pathname.endsWith("/canvas")) {
      hits.code++; assert.equal(req.method, "GET"); body = code;
      res.setHeader("Content-Type", "application/javascript");
      res.setHeader("X-Plasmic-Library-Release", JSON.stringify({ pkgId: "pkg", version: "1.0.0", digest: sha(body) }));
    } else if (url.pathname.endsWith("/revs/unpublished")) {
      hits.history++; assert.equal(req.method, "GET"); body = JSON.stringify({ revisions: [] });
    } else {
      hits.writes++; assert.equal(url.pathname, "/api/v1/projects/project"); assert.equal(req.method, "POST");
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      assert.deepEqual(JSON.parse(Buffer.concat(chunks)), { newComponents: [] });
      body = JSON.stringify({ written: true });
    }
    const compressed = gzipSync(body);
    res.setHeader("Content-Encoding", "gzip"); res.setHeader("Content-Length", compressed.length); res.end(compressed);
  }).listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  const remote = `http://127.0.0.1:${server.address().port}`;
  const ses = session.fromPartition("persist:library-cache-native");
  const options = { directory: path.join(profile, "cache"), studioOrigin: origin, buildId: "renderer-build",
    identity: { epoch: 0, value: { user: { id: "account" } }, async read() { return this.value; } },
    remoteFetch: request => ses.fetch(request.url.replace(origin, remote), { method: request.method, headers: request.headers,
      ...(request.method === "POST" ? { body: request.body, duplex: "half" } : {}), bypassCustomProtocolHandlers: true }),
  };
  let cache = new LibraryCache(options);
  const scope = await cache.scope();
  for (let i = 0; i < 160; i++) await cache.store.write(scope, "model-resource", `/api/v1/dependency-models/unused-${i}`, Buffer.from('{}'), {}, () => cache.check(scope));
  await ses.protocol.handle("https", request => new URL(request.url).pathname === "/" ? new Response("<!doctype html><title>Cache test</title>", { headers: { "Content-Type": "text/html" } }) : cache.fetch(request));
  win = new BrowserWindow({ show: false, webPreferences: { session: ses, sandbox: true, contextIsolation: true, nodeIntegration: false } });
  for (let visit = 1; visit <= 2; visit++) {
    await win.loadURL(origin);
    const result = await win.webContents.executeJavaScript(`(async () => {
      const project = await (await fetch('/api/v1/projects/project?includeStartup=true')).json();
      await Promise.all(project.depPkgs.map(async pkg => { pkg.model = await (await fetch('/api/v1/dependency-models/'+pkg.modelResourceId)).json(); delete pkg.modelResourceId; }));
      const source = await (await fetch('/api/v1/hostless-libraries/antd6/canvas?version=1.0.0&pkgId=pkg')).text();
      const script = document.createElement('script'); script.textContent = source; document.head.appendChild(script);
      const history = await (await fetch('/api/v1/projects/project/revs/unpublished')).json();
      const write = await (await fetch('/api/v1/projects/project', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({newComponents:[]})})).json();
      return {project,history,write,registrations:window.nativeRegistration};
    })()`);
    assert.equal(result.project.startup.projectId, "project");
    assert.equal(result.project.rev.revision, visit);
    assert.deepEqual(result.project.depPkgs[0].model, model);
    assert.equal(result.registrations, 1);
    assert.deepEqual(result.history, { revisions: [] }); assert.deepEqual(result.write, { written: true });
    cache = new LibraryCache(options);
  }
  const failed = await win.webContents.executeJavaScript(`Promise.all([
    fetch('/api/v1/dependency-models/denied', {method:'HEAD'}),
    fetch('/api/v1/dependency-models/denied'),
    fetch('/api/v1/dependency-models/denied')
  ]).then(responses => Promise.all(responses.map(async response => ({status:response.status,body:await response.text()}))))`);
  assert.deepEqual(failed, [{status:403,body:''},{status:403,body:'{"error":"Forbidden"}'},{status:403,body:'{"error":"Forbidden"}'}]);
  assert.deepEqual(hits, { project: 2, model: 1, code: 1, history: 2, writes: 2, failedModel: 1 });
  console.log("PASS: single opening project GET, immutable model/code GET, zero warm resource network checks, no digest inventory or response cropping, 160 unrelated cached versions never uploaded, gzip and original writes preserved");
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  win?.destroy(); if (server) await new Promise(resolve => server.close(resolve));
  if (profile) await fs.rm(profile, { recursive: true, force: true }); app.exit(process.exitCode || 0);
});
