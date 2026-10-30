const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { createHash } = require("node:crypto");
const { LibraryCache } = require("../src/library-cache.cjs");
const hash = value => createHash("sha256").update(value).digest("hex");
const origin = "https://studio.example";
const script = "window.component = 'v1';";
const scriptResponse = (body = script, version = "1.0.0", pkgId = "pkg") => new Response(body, { headers: {
  "Content-Type": "application/javascript",
  "X-Plasmic-Library-Release": JSON.stringify({ pkgId, version, digest: hash(body) }),
} });
const codeRequest = (version = "1.0.0", init) => new Request(`${origin}/api/v1/hostless-libraries/antd6/canvas?version=${version}&pkgId=pkg`, init);
async function fixture(t, overrides = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "library-cache-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const identity = { epoch: 0, value: { user: { id: "user-1" } }, async read() { return this.value; }, invalidate() { this.epoch++; } };
  const requests = [];
  let responder = request => scriptResponse(script, new URL(request.url).searchParams.get("version"));
  const options = { directory, studioOrigin: origin, buildId: "renderer-sha-1", identity,
    remoteFetch: async request => { requests.push(request); return responder(request); }, ...overrides };
  return { cache: new LibraryCache(options), options, identity, requests, respond(fn) { responder = fn; } };
}

test("pinned releases survive process restart, GET/HEAD hits make zero remote requests", async t => {
  const f = await fixture(t);
  assert.equal(await (await f.cache.fetch(codeRequest())).text(), script);
  const restarted = new LibraryCache(f.options);
  assert.equal(await (await restarted.fetch(codeRequest())).text(), script);
  const head = await restarted.fetch(codeRequest("1.0.0", { method: "HEAD" }));
  assert.equal(await head.text(), "");
  assert.equal(head.headers.get("content-length"), String(Buffer.byteLength(script)));
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].headers.has("if-none-match"), false);
});

test("concurrent misses and HEAD share one body download; versions stay independent and undo reuses older bytes", async t => {
  const f = await fixture(t);
  let finish;
  f.respond(() => new Promise(resolve => { finish = resolve; }));
  const first = f.cache.fetch(codeRequest()), second = f.cache.fetch(codeRequest("1.0.0", { method: "HEAD" }));
  while (!finish) await new Promise(resolve => setImmediate(resolve));
  finish(scriptResponse());
  assert.equal(await (await first).text(), script);
  assert.equal(await (await second).text(), "");
  assert.equal(f.requests.length, 1);
  f.respond(() => scriptResponse("window.component = 'v2';", "2.0.0"));
  assert.match(await (await f.cache.fetch(codeRequest("2.0.0"))).text(), /v2/);
  assert.equal(await (await f.cache.fetch(codeRequest())).text(), script);
  assert.equal(f.requests.length, 2);
});

test("a newly verified auth epoch downloads independently while the old download is pending", async t => {
  const f = await fixture(t);
  const downloads = [];
  const started = Promise.withResolvers();
  const freshStarted = Promise.withResolvers();
  f.respond(() => new Promise(resolve => {
    downloads.push(resolve); started.resolve();
    if (downloads.length === 2) freshStarted.resolve();
  }));
  const old = f.cache.fetch(codeRequest());
  const rejected = assert.rejects(old, /account changed/);
  await started.promise;
  f.identity.invalidate();
  f.identity.value = { user: { id: "user-1" } };
  const fresh = f.cache.fetch(codeRequest());
  // Observe failures immediately while checking the independently pending requests.
  const result = fresh.then(response => response.text(), error => error);
  let timeout;
  try {
    await Promise.race([freshStarted.promise, new Promise(resolve => { timeout = setTimeout(resolve, 1000); })]);
    assert.equal(f.requests.length, 2, "new authorization must not join an old generation's task");
    downloads[1](scriptResponse());
    assert.equal(await result, script);
  } finally {
    clearTimeout(timeout);
    downloads.forEach(resolve => resolve(scriptResponse()));
    await rejected;
    await result;
  }
});

test("account, origin and real renderer build identity isolate cached resources", async t => {
  const f = await fixture(t);
  await f.cache.fetch(codeRequest());
  f.identity.value = { user: { id: "user-2" } }; f.identity.invalidate();
  await f.cache.fetch(codeRequest());
  await new LibraryCache({ ...f.options, buildId: "renderer-sha-2" }).fetch(codeRequest());
  await new LibraryCache({ ...f.options, studioOrigin: "https://other.example" }).fetch(new Request(codeRequest().url.replace(origin, "https://other.example")));
  assert.equal(f.requests.length, 4);
  f.identity.value = { user: { id: "user-1" } }; f.identity.invalidate();
  await f.cache.fetch(codeRequest());
  assert.equal(f.requests.length, 4);
});

test("mutable addresses and unrelated requests never enter permanent resource cache", async t => {
  const f = await fixture(t);
  for (const url of [
    `${origin}/api/v1/hostless-libraries/antd6/canvas`,
    `${origin}/api/v1/hostless-libraries/antd6/canvas?version=latest&pkgId=pkg`,
    `${origin}/api/v1/hostless-libraries/antd6/canvas?version=1.0.0`,
    `${origin}/api/v1/hostless-libraries/antd6/canvas?version=1.0.0&pkgId=pkg&other=1`,
    `${origin}/api/v1/auth/self`,
    `https://external.example/api/v1/hostless-libraries/antd6/canvas?version=1.0.0&pkgId=pkg`,
  ]) {
    await f.cache.fetch(new Request(url)); await f.cache.fetch(new Request(url));
  }
  assert.equal(f.requests.length, 12);
  assert.equal((await f.cache.files()).length, 0);
});

test("rejected downloads, HTML, wrong release and checksum mismatches are retryable and never cached", async t => {
  const f = await fixture(t);
  for (const response of [
    new Response("Unauthorized", { status: 401 }),
    new Response("<html>Sign in</html>", { headers: { "Content-Type": "text/html" } }),
    scriptResponse(script, "2.0.0"),
    scriptResponse(script, "1.0.0", "other-pkg"),
    new Response(script, { headers: { "Content-Type": "application/javascript", "X-Plasmic-Library-Release": JSON.stringify({ pkgId: "pkg", version: "1.0.0", digest: "0".repeat(64) }) } }),
  ]) {
    f.respond(() => response);
    await assert.rejects(f.cache.fetch(codeRequest()));
    assert.equal((await f.cache.files()).length, 0);
  }
  f.respond(() => scriptResponse());
  assert.equal(await (await f.cache.fetch(codeRequest())).text(), script);
});

test("corrupt or missing cache files redownload the exact release", async t => {
  const f = await fixture(t);
  await f.cache.fetch(codeRequest());
  const [{ file }] = await f.cache.files();
  await fs.writeFile(file, "damaged");
  assert.equal(await (await f.cache.fetch(codeRequest())).text(), script);
  await fs.rm(file);
  await f.cache.fetch(codeRequest());
  assert.equal(f.requests.length, 3);
});

test("an unavailable disk cache does not block authorized code or project models", async t => {
  const f = await fixture(t);
  const warnings = t.mock.method(console, "warn", () => {});
  await fs.rm(f.options.directory, { recursive: true });
  await fs.writeFile(f.options.directory, "not a cache directory");
  assert.equal(await (await f.cache.fetch(codeRequest())).text(), script);
  f.respond(request => modelResponse(request, model1));
  const project = await (await f.cache.fetch(projectRequest("first"))).json();
  assert.deepEqual(project.depPkgs[0].model, model1);
  assert.equal(warnings.mock.callCount(), 2);
});

test("session changes fence in-flight downloads and logout erases the previous user's cache", async t => {
  const f = await fixture(t);
  await f.cache.fetch(codeRequest());
  let finish;
  f.respond(() => new Promise(resolve => { finish = resolve; }));
  const pending = f.cache.fetch(codeRequest("2.0.0"));
  const rejected = assert.rejects(pending, /account changed/);
  while (!finish) await new Promise(resolve => setImmediate(resolve));
  await new LibraryCache(f.options).clear();
  finish(scriptResponse(script, "2.0.0"));
  await rejected;
  assert.equal((await f.cache.files()).length, 0);
});

const model1 = { version: "schema-1", map: { root: { name: "Button" } } };
const model2 = { version: "schema-2", map: { root: { name: "Button", newProp: true } } };
const modelHash = model => hash(JSON.stringify(model));
async function modelResponse(request, model, revision = 1, omit = false) {
  const digest = modelHash(model);
  const known = (await request.clone().json()).modelDigests;
  return Response.json({ rev: { data: "mutable-project", revision }, perms: ["editor"],
    depPkgs: [{ id: "release-id", pkgId: "pkg", version: "1.0.0", ...(omit || known?.includes(digest) ? {} : { model }) }],
    modelSnapshots: { "release-id": digest },
  }, { headers: { "X-Plasmic-Model-Cache": "1" } });
}
const projectRequest = project => new Request(`${origin}/api/v1/projects/${project}`);

test("all cached models are reused after restart, across projects, and beyond 64 entries", async t => {
  const f = await fixture(t);
  const models = Array.from({ length: 65 }, (_, i) => ({ ...model1, library: i }));
  const sent = [];
  f.respond(async request => {
    const known = (await request.clone().json()).modelDigests;
    const deps = new URL(request.url).pathname.endsWith("/all") ? models : [models[0]];
    const depPkgs = deps.map(model => {
      const digest = modelHash(model), transfer = !known.includes(digest);
      sent.push(transfer);
      return { id: String(model.library), ...(transfer ? { model } : {}) };
    });
    return Response.json({ depPkgs, modelSnapshots: Object.fromEntries(deps.map(model => [String(model.library), modelHash(model)])) }, { headers: { "X-Plasmic-Model-Cache": "1" } });
  });
  await f.cache.fetch(projectRequest("all"));
  assert.equal((await f.cache.files()).length, 65);
  sent.length = 0;
  const restarted = new LibraryCache(f.options);
  const full = await (await restarted.fetch(projectRequest("all"))).json();
  assert.deepEqual(full.depPkgs.map(dep => dep.model), models);
  assert.equal(sent.filter(Boolean).length, 0, "cached models must not be silently omitted from negotiation");
  sent.length = 0;
  assert.deepEqual((await (await restarted.fetch(projectRequest("another"))).json()).depPkgs[0].model, models[0]);
  assert.deepEqual(sent, [false]);
});

test("model snapshots restore the complete API response; reopen and cross-project loads transfer no cached model", async t => {
  const f = await fixture(t);
  let revision = 1;
  const wire = [];
  f.respond(async request => { const response = await modelResponse(request, model1, revision++); wire.push(await response.clone().json()); return response; });
  for (const [index, project] of ["first", "first", "another"].entries()) {
    const body = await (await new LibraryCache(f.options).fetch(projectRequest(project))).json();
    assert.deepEqual(body.depPkgs[0].model, model1);
    assert.equal(body.rev.revision, index + 1);
    assert.deepEqual(body.perms, ["editor"]);
    assert.equal(body.modelSnapshots, undefined);
  }
  assert.deepEqual(wire[0].depPkgs[0].model, model1);
  assert.equal(wire[1].depPkgs[0].model, undefined);
  assert.equal(wire[2].depPkgs[0].model, undefined);
  assert.equal(f.requests.length, 3, "every project load still checks current permissions and revision");
  assert(f.requests.every(request => request.method === "POST" && request.headers.get("Cache-Control") === "no-cache" && request.cache === "no-store"));
  assert(f.requests.every(request => request.headers.get("X-Plasmic-Model-Cache") === "1" && request.headers.get("Origin") === origin));
});

test("migration changes under the same semver download new content and exact old snapshot remains reusable", async t => {
  const f = await fixture(t);
  for (const model of [model1, model2, model1]) {
    f.respond(request => modelResponse(request, model));
    assert.deepEqual((await (await f.cache.fetch(projectRequest("first"))).json()).depPkgs[0].model, model);
  }
  assert.equal((await f.cache.files()).length, 2);
});

test("model negotiation preserves explicit and referrer origins and original query parameters", async t => {
  const f = await fixture(t);
  f.respond(request => modelResponse(request, model1));
  const url = origin + "/api/v1/projects/branch?revisionNum=7&dontMigrateProject=true";
  for (const init of [
    { headers: { Origin: "https://explicit.example" }, referrer: origin + "/page" },
    { referrer: "https://referrer.example/page" },
  ]) {
    await f.cache.fetch(new Request(url, init));
    const forwarded = f.requests.at(-1);
    assert.equal(forwarded.url, url);
    assert.equal(forwarded.headers.get("Origin"), init.headers?.Origin ?? "https://referrer.example");
  }
});

test("cache deletion/corruption after hints causes one fresh authorized model response", async t => {
  const f = await fixture(t);
  f.respond(request => modelResponse(request, model1));
  await f.cache.fetch(projectRequest("first"));
  const [{ file }] = await f.cache.files();
  await fs.writeFile(file, "corrupted");
  const body = await (await f.cache.fetch(projectRequest("first"))).json();
  assert.deepEqual(body.depPkgs[0].model, model1);
  assert.equal(f.requests.length, 3);
  assert.deepEqual((await f.requests[1].clone().json()).modelDigests, [modelHash(model1)]);
  assert.deepEqual((await f.requests[2].clone().json()).modelDigests, []);
});

test("bad model responses, revoked permission and account changes cannot supply cached project data", async t => {
  const f = await fixture(t);
  f.respond(request => modelResponse(request, model1));
  await f.cache.fetch(projectRequest("first"));
  f.respond(() => new Response("Forbidden", { status: 403 }));
  assert.equal((await f.cache.fetch(projectRequest("first"))).status, 403);
  f.respond(request => modelResponse(request, model2, 1, true));
  await assert.rejects(f.cache.fetch(projectRequest("first")), /snapshot is missing/);
  f.respond(request => { f.identity.invalidate(); return modelResponse(request, model1); });
  await assert.rejects(f.cache.fetch(projectRequest("first")), /account changed/);
});

test("bounded cache evicts unused older versions and can download them again", async t => {
  const f = await fixture(t, { maxBytes: 800 });
  await f.cache.fetch(codeRequest());
  await new Promise(resolve => setTimeout(resolve, 10));
  await f.cache.fetch(codeRequest("2.0.0"));
  assert.equal((await f.cache.files()).length, 1);
  await f.cache.fetch(codeRequest());
  assert.equal(f.requests.length, 3);
});
