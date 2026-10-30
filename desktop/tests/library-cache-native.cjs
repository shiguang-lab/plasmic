// Real Chromium protocol interception, response decompression and process-local
// cache reconstruction. No production session, project or installed App is used.
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
  app.setPath("userData", profile);
  app.setPath("sessionData", profile);
  await app.whenReady();
  const model = { version: "schema-1", map: { root: { name: "Button" } } };
  const modelDigest = sha(JSON.stringify(model));
  const code = "window.nativeRegistration = (window.nativeRegistration || 0) + 1;";
  const hits = { code: 0, model: 0, modelBodies: 0 };
  let largestRequestBody = 0;
  server = createServer(async (req, res) => {
    // The fixture remaps the original HTTPS request to a local HTTP server.
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Headers", "content-type,x-plasmic-model-cache,cache-control");
    res.setHeader("Access-Control-Expose-Headers", "x-plasmic-model-cache,x-plasmic-library-release");
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Methods", "GET,POST");
      res.writeHead(204).end();
      return;
    }
    const url = new URL(req.url, origin);
    let body;
    if (url.pathname.endsWith("/canvas")) {
      hits.code++;
      res.setHeader("Content-Type", "application/javascript");
      res.setHeader("X-Plasmic-Library-Release", JSON.stringify({ pkgId: "pkg", version: "1.0.0", digest: sha(code) }));
      body = code;
    } else {
      hits.model++;
      assert.equal(req.method, "POST");
      assert.equal(req.headers.origin, origin);
      assert.equal(req.headers["x-plasmic-model-cache"], "1");
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const requestBody = Buffer.concat(chunks);
      largestRequestBody = Math.max(largestRequestBody, requestBody.length);
      // Even an incorrectly cacheable upstream must not freeze project data.
      res.setHeader("Cache-Control", "private, max-age=3600");
      const known = JSON.parse(requestBody).modelDigests.includes(modelDigest);
      if (!known) hits.modelBodies++;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("X-Plasmic-Model-Cache", "1");
      body = JSON.stringify({ rev: { revision: hits.model, data: "current-project" }, depPkgs: [
        { id: "release", pkgId: "pkg", version: "1.0.0", ...(known ? {} : { model }) },
      ], modelSnapshots: { release: modelDigest } });
    }
    const compressed = gzipSync(body);
    res.setHeader("Content-Encoding", "gzip");
    res.setHeader("Content-Length", compressed.length);
    res.end(compressed);
  }).listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  const remote = `http://127.0.0.1:${server.address().port}`;
  const ses = session.fromPartition("persist:library-cache-native");
  const identity = { epoch: 0, value: { user: { id: "account" } }, async read() { return this.value; } };
  const options = { directory: path.join(profile, "cache"), studioOrigin: origin, buildId: "one-renderer-build", identity,
    remoteFetch: async request => ses.fetch(request.url.replace(origin, remote), {
      method: request.method, headers: request.headers,
      ...(request.method === "POST" ? { body: await request.text() } : {}),
      bypassCustomProtocolHandlers: true,
    }),
  };
  let cache = new LibraryCache(options);
  // Exceed a typical HTTP header budget without enlarging any request header.
  const scope = await cache.scope();
  for (let i = 0; i < 160; i++) {
    const body = Buffer.from(JSON.stringify({ unusedLibrary: i }));
    await cache.write(scope, "model", sha(body), body);
  }
  await ses.protocol.handle("https", request => {
    if (new URL(request.url).pathname === "/") return new Response("<!doctype html><title>Cache test</title>", { headers: { "Content-Type": "text/html" } });
    return cache.fetch(request);
  });
  win = new BrowserWindow({ show: false, webPreferences: { session: ses, sandbox: true, contextIsolation: true, nodeIntegration: false } });
  for (let visit = 1; visit <= 2; visit++) {
    await win.loadURL(origin);
    const result = await win.webContents.executeJavaScript(`(async () => {
      const model = await (await fetch('/api/v1/projects/project')).json();
      const source = await (await fetch('/api/v1/hostless-libraries/antd6/canvas?version=1.0.0&pkgId=pkg')).text();
      const script = document.createElement('script'); script.textContent = source; document.head.appendChild(script);
      return {model, registrations: window.nativeRegistration};
    })()`);
    assert.deepEqual(result.model.depPkgs[0].model, model);
    assert.equal(result.model.rev.revision, visit);
    assert.equal(result.registrations, 1);
    assert.equal(result.model.modelSnapshots, undefined);
    cache = new LibraryCache(options); // Drop every in-memory cache object.
  }
  assert.deepEqual(hits, { code: 1, model: 2, modelBodies: 1 });
  assert(largestRequestBody > 8192);
  console.log("PASS: sandboxed Chromium, gzip responses, POST digest inventory over 8 KiB, disk cache across new instances/documents, one code download, fresh project revisions and no repeated model body");
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  win?.destroy();
  if (server) await new Promise(resolve => server.close(resolve));
  if (profile) await fs.rm(profile, { recursive: true, force: true });
  app.exit(process.exitCode || 0);
});
