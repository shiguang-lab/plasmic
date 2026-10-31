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
  assert.equal((await f.cache.store.files()).length, 0);
});

test("rejected downloads, HTML, wrong release and checksum mismatches are retryable and never cached", async t => {
  const f = await fixture(t);
  f.respond(() => new Response("Unauthorized", { status: 401 }));
  assert.equal((await f.cache.fetch(codeRequest())).status, 401);
  assert.equal((await f.cache.store.files()).length, 0);
  for (const response of [
    new Response("<html>Sign in</html>", { headers: { "Content-Type": "text/html" } }),
    scriptResponse(script, "2.0.0"),
    scriptResponse(script, "1.0.0", "other-pkg"),
    new Response(script, { headers: { "Content-Type": "application/javascript", "X-Plasmic-Library-Release": JSON.stringify({ pkgId: "pkg", version: "1.0.0", digest: "0".repeat(64) }) } }),
  ]) {
    f.respond(() => response);
    await assert.rejects(f.cache.fetch(codeRequest()));
    assert.equal((await f.cache.store.files()).length, 0);
  }
  f.respond(() => scriptResponse());
  assert.equal(await (await f.cache.fetch(codeRequest())).text(), script);
});

test("corrupt or missing cache files redownload the exact release", async t => {
  const f = await fixture(t);
  await f.cache.fetch(codeRequest());
  const [{ file }] = await f.cache.store.files();
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
  f.respond(() => modelResponse());
  assert.deepEqual(await (await f.cache.fetch(modelRequest())).json(), model1);
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
  assert.equal((await f.cache.store.files()).length, 0);
});

const model1 = { version: "schema-1", map: { root: { name: "Button" } } };
const model2 = { version: "schema-2", map: { root: { name: "Button", newProp: true } } };
const modelRequest = (id = "model-v1", init) => new Request(`${origin}/api/v1/dependency-models/${id}`, init);
const modelResponse = (id = "model-v1", model = model1) => {
  const body = JSON.stringify(model);
  return new Response(body, { headers: { "Content-Type": "application/json", "X-Plasmic-Model-Resource": JSON.stringify({ id, digest: hash(body) }) } });
};

test("project, package, history, bootstrap and write requests are always passed through unchanged", async t => {
  const f = await fixture(t);
  f.respond(() => Response.json({ ok: true }));
  for (const route of ["editor-bootstrap/project", "projects/project", "projects/project/updates", "projects/project/revs/unpublished", "projects/project/revs/revision-id", "pkgs/pkg", "pkgs/projectId/project"]) {
    for (const method of ["GET", "POST"]) {
      const request = new Request(`${origin}/api/v1/${route}?branchId=%22branch%22`, { method, ...(method === "POST" ? { body: '{"newComponents":[]}' } : {}) });
      await f.cache.fetch(request);
      assert.equal(f.requests.at(-1), request);
      assert.equal(f.requests.at(-1).method, method);
      assert.equal(f.requests.at(-1).headers.has("X-Plasmic-Model-Cache"), false);
    }
  }
  assert.equal((await f.cache.store.files()).length, 0);
});
test("exact model resources persist across restarts; warm GET/HEAD perform zero network checks", async t => {
  const f = await fixture(t);
  f.respond(() => modelResponse());
  assert.deepEqual(await (await f.cache.fetch(modelRequest())).json(), model1);
  assert.deepEqual(await (await new LibraryCache(f.options).fetch(modelRequest())).json(), model1);
  assert.equal(await (await f.cache.fetch(modelRequest("model-v1", { method: "HEAD" }))).text(), "");
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].method, "GET");
  assert.equal(await f.requests[0].clone().text(), "");
});
test("many unrelated versions are never uploaded and changing one resource downloads only that resource", async t => {
  const f = await fixture(t);
  const scope = await f.cache.scope();
  for (let i = 0; i < 160; i++) await f.cache.store.write(scope, "model-resource", `/api/v1/dependency-models/unused-${i}`, Buffer.from('{}'), {}, () => f.cache.check(scope));
  f.respond(() => modelResponse());
  await f.cache.fetch(modelRequest());
  f.respond(() => modelResponse("model-v2", model2));
  assert.deepEqual(await (await f.cache.fetch(modelRequest("model-v2"))).json(), model2);
  assert.deepEqual(await (await new LibraryCache(f.options).fetch(modelRequest())).json(), model1);
  assert.equal(f.requests.length, 2);
  assert(f.requests.every(request => request.method === "GET" && !request.headers.has("X-Plasmic-Model-Cache")));
  assert.deepEqual(await Promise.all(f.requests.map(request => request.clone().text())), ["", ""]);
});
test("different projects reuse the same model resource without replaying project data", async t => {
  const f = await fixture(t);
  f.respond(request => request.url.includes('/dependency-models/') ? modelResponse() : Response.json({ depPkgs: [{ modelResourceId: 'model-v1' }] }));
  for (const project of ['first', 'another']) {
    const response = await (await new LibraryCache(f.options).fetch(new Request(`${origin}/api/v1/projects/${project}`))).json();
    assert.deepEqual(await (await new LibraryCache(f.options).fetch(modelRequest(response.depPkgs[0].modelResourceId))).json(), model1);
  }
  assert.deepEqual(f.requests.map(request => new URL(request.url).pathname), ['/api/v1/projects/first', '/api/v1/dependency-models/model-v1', '/api/v1/projects/another']);
});
test("concurrent model misses and HEAD share the same GET download", async t => {
  const f = await fixture(t);
  let finish;
  f.respond(() => new Promise(resolve => { finish = resolve; }));
  const get = f.cache.fetch(modelRequest()), head = f.cache.fetch(modelRequest("model-v1", { method: "HEAD" }));
  while (!finish) await new Promise(resolve => setImmediate(resolve));
  finish(modelResponse());
  assert.deepEqual(await (await get).json(), model1);
  assert.equal(await (await head).text(), "");
  assert.equal(f.requests.length, 1);
});
test("corrupt and missing model files redownload the same immutable resource", async t => {
  const f = await fixture(t);
  f.respond(() => modelResponse());
  await f.cache.fetch(modelRequest());
  const [{ file }] = await f.cache.store.files();
  await fs.writeFile(file, "damaged");
  assert.deepEqual(await (await f.cache.fetch(modelRequest())).json(), model1);
  await fs.rm(file);
  await f.cache.fetch(modelRequest());
  assert.equal(f.requests.length, 3);
});
test("wrong model identity, checksum, HTML and revoked authorization never enter cache", async t => {
  const f = await fixture(t);
  for (const response of [modelResponse("other-id"), new Response('{}', { headers: { "Content-Type": "application/json", "X-Plasmic-Model-Resource": JSON.stringify({ id: "model-v1", digest: "0".repeat(64) }) } }), new Response('<html>', { headers: { "Content-Type": "text/html" } })]) {
    f.respond(() => response);
    await assert.rejects(f.cache.fetch(modelRequest()));
    assert.equal((await f.cache.store.files()).length, 0);
  }
  f.respond(() => new Response("Forbidden", { status: 403 }));
  assert.equal((await f.cache.fetch(modelRequest())).status, 403);
  assert.equal((await f.cache.store.files()).length, 0);
});
test("model resources remain isolated by account and fence an account change during download", async t => {
  const f = await fixture(t);
  f.respond(() => modelResponse());
  await f.cache.fetch(modelRequest());
  f.identity.value = { user: { id: "user-2" } }; f.identity.invalidate();
  await f.cache.fetch(modelRequest());
  assert.equal(f.requests.length, 2);
  f.respond(() => { f.identity.invalidate(); return modelResponse("model-v2", model2); });
  await assert.rejects(f.cache.fetch(modelRequest("model-v2")), /account changed/);
});

for (const status of [401, 403, 404, 500, 503]) {
  test(`concurrent failed model GET/HEAD reads preserve independent HTTP ${status} responses and remain retryable`, async t => {
    const f = await fixture(t);
    let finish;
    f.respond(() => new Promise(resolve => { finish = resolve; }));
    const pending = [
      f.cache.fetch(modelRequest("model-v1", { method: "HEAD" })),
      f.cache.fetch(modelRequest()),
      f.cache.fetch(modelRequest()),
    ];
    while (!finish) await new Promise(resolve => setImmediate(resolve));
    finish(Response.json({ error: "Unavailable" }, { status, headers: { "Retry-After": "1" } }));
    const responses = await Promise.all(pending);
    assert(responses.every(response => response.status === status && response.headers.get("retry-after") === "1"));
    assert.deepEqual(await Promise.all(responses.map(response => response.text())), ["", '{"error":"Unavailable"}', '{"error":"Unavailable"}']);
    assert.equal(f.requests.length, 1);
    assert.equal((await f.cache.store.files()).length, 0);
    f.respond(() => modelResponse());
    assert.deepEqual(await (await f.cache.fetch(modelRequest())).json(), model1);
    assert.equal(f.requests.length, 2);
  });
}
