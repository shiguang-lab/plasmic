const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { createSessionRecovery } = require("../src/session-recovery.cjs");
const { UnifiedAuthWindow, AUTH_PATH } = require("../src/unified-auth-window.cjs");
const studioOrigin = "https://studio.example";
const projectUrl = studioOrigin + "/projects/example?branch=main#page";

function fixture(fetch) {
  const window = new EventEmitter();
  window.url = projectUrl;
  window.loads = [];
  window.isDestroyed = () => false;
  window.webContents = { getURL: () => window.url, send: () => {}, isLoadingMainFrame: () => false };
  window.loadURL = async (url) => {
    window.loads.push(url);
    window.url = url;
  };
  const auth = new UnifiedAuthWindow(window, studioOrigin, () => {
    assert.fail("Session expiry must not open browser authorization");
  }, { start: async () => {} });
  let checks = 0;
  const recover = createSessionRecovery({
    auth,
    studioOrigin,
    session: { fetch: async (url, options) => {
      checks++;
      assert.equal(url, studioOrigin + "/api/auth/session");
      assert.equal(options.credentials, "include");
      assert.equal(options.bypassCustomProtocolHandlers, true);
      assert.equal(options.cache, "no-store");
      return fetch();
    } },
  });
  return { auth, window, recover, checks: () => checks };
}

test("concurrent expired-session errors open one sign-in page and preserve the project", async () => {
  let finish;
  const f = fixture(() => new Promise((resolve) => { finish = resolve; }));
  const responses = ["latest-bundle-version", "projects", "pkgs/example"].map(
    (path) => f.recover(new Response(null, { status: 401 }), studioOrigin + "/api/v1/" + path),
  );
  assert.equal(f.checks(), 1);
  finish(Response.json({ authenticated: false }, { status: 401 }));
  await Promise.all(responses);
  assert.deepEqual(f.window.loads, [studioOrigin + AUTH_PATH]);
  assert.equal(f.auth.returnUrl, projectUrl);
  assert.equal(f.auth.status.phase, "idle");
  await f.auth.begin();
  assert.equal(f.window.url, projectUrl);
});

test("a valid session keeps resource permission errors in the editor", async () => {
  const f = fixture(() => Response.json({ authenticated: true }));
  await f.recover(new Response(null, { status: 401 }), studioOrigin + "/api/v1/projects/private");
  assert.equal(f.checks(), 1);
  assert.deepEqual(f.window.loads, []);
});

test("network, server and malformed session responses never claim login expiry", async () => {
  for (const fetch of [
    () => { throw new Error("Offline"); },
    () => new Response(null, { status: 503 }),
    () => new Response("Unauthorized", { status: 401 }),
    () => Response.json({ error: "unauthorized" }, { status: 401 }),
  ]) {
    const f = fixture(fetch);
    await f.recover(new Response(null, { status: 401 }), studioOrigin + "/api/v1/projects");
    assert.deepEqual(f.window.loads, []);
  }
});

test("only Studio API 401 responses check the session", async () => {
  const f = fixture(() => assert.fail("No session check expected"));
  for (const [status, url] of [
    [200, studioOrigin + "/api/v1/projects"],
    [403, studioOrigin + "/api/v1/projects"],
    [500, studioOrigin + "/api/v1/projects"],
    [401, "https://external.example/api/v1/projects"],
    [401, studioOrigin + "/api/auth/session"],
  ]) await f.recover(new Response(null, { status }), url);
  f.window.url = studioOrigin + AUTH_PATH;
  await f.recover(new Response(null, { status: 401 }), studioOrigin + "/api/v1/projects");
  assert.equal(f.checks(), 0);
});

test("the login page cannot be reopened by requests finishing after navigation", async () => {
  let finish;
  const f = fixture(() => new Promise((resolve) => { finish = resolve; }));
  const pending = f.recover(new Response(null, { status: 401 }), studioOrigin + "/api/v1/projects");
  f.window.url = studioOrigin + AUTH_PATH;
  finish(Response.json({ authenticated: false }, { status: 401 }));
  await pending;
  assert.deepEqual(f.window.loads, []);
});
