const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { randomBytes, createHash } = require("node:crypto");
const { DesktopGoogleLogin, CALLBACK } = require("../src/google-login.cjs");
const studioOrigin = "https://plasmic.studio.publib.cn";
function fixture(t) {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "plasmic-oauth-"));
  t.after(() => fs.rmSync(userData, { recursive: true, force: true }));
  const calls = [];
  const options = {
    userData,
    studioOrigin,
    session: {
      fetch: async (url, input) => {
        calls.push({ url, input });
        assert.equal(input.credentials, "include");
        assert.equal(input.bypassCustomProtocolHandlers, true);
        return Response.json(
          url.endsWith("/csrf") ? { csrf: "csrf" } : { status: true },
        );
      },
    },
  };
  return { login: new DesktopGoogleLogin(options), options, calls };
}
function callback(auth, code = randomBytes(32).toString("base64url")) {
  const url = new URL(CALLBACK);
  url.searchParams.set("state", new URL(auth).searchParams.get("desktopState"));
  url.searchParams.set("code", code);
  return url;
}
test("HTTPS authorization completes through an exact app deep link with state and PKCE", async (t) => {
  const { login, calls } = fixture(t);
  let auth;
  const returnUrl = studioOrigin + "/projects/example";
  const finished = login.start({
    returnUrl,
    openBrowser: async (url) => {
      auth = url;
    },
  });
  assert.equal(new URL(auth).searchParams.has("redirectUri"), false);
  const wrong = callback(auth);
  wrong.searchParams.set("state", randomBytes(32).toString("base64url"));
  await assert.rejects(login.handle(wrong.toString()), /does not match/);
  assert.equal(calls.length, 0);
  const link = callback(auth);
  assert.equal(await login.handle(link.toString()), returnUrl);
  assert.equal(await finished, returnUrl);
  const request = calls[1];
  assert.equal(
    request.url,
    studioOrigin + "/api/v1/auth/desktop/google/exchange",
  );
  assert.equal(request.input.headers["X-CSRF-Token"], "csrf");
  assert.equal(request.input.headers.Origin, studioOrigin);
  const body = JSON.parse(request.input.body);
  assert.equal(body.code, link.searchParams.get("code"));
  assert.equal(
    createHash("sha256").update(body.verifier).digest("base64url"),
    new URL(auth).searchParams.get("challenge"),
  );
  assert.equal(fs.existsSync(login.file), false);
  await assert.rejects(login.handle(link.toString()), /expired/);
});
test("pending PKCE flow survives app restart and expires safely", async (t) => {
  const { login, options } = fixture(t);
  let auth;
  const controller = new AbortController();
  const finished = login.start({
    returnUrl: studioOrigin + "/projects/example",
    signal: controller.signal,
    openBrowser: async (url) => {
      auth = url;
    },
  });
  assert.equal(fs.statSync(login.file).mode & 0o777, 0o600);
  controller.abort("window-closed");
  await assert.rejects(finished, /cancelled/);
  const restarted = new DesktopGoogleLogin(options);
  assert.equal(
    await restarted.handle(callback(auth).toString()),
    studioOrigin + "/projects/example",
  );
  assert.equal(fs.existsSync(login.file), false);
});
test("user cancellation clears the pending handoff", async (t) => {
  const { login } = fixture(t);
  const controller = new AbortController();
  const finished = login.start({
    returnUrl: studioOrigin + "/",
    signal: controller.signal,
    openBrowser: async () => controller.abort(),
  });
  await assert.rejects(finished, /cancelled/);
  assert.equal(fs.existsSync(login.file), false);
});
test("failed Google authorization cannot create a desktop session", async (t) => {
  const { login, calls } = fixture(t);
  let auth;
  const finished = login.start({
    returnUrl: studioOrigin + "/",
    openBrowser: async (url) => {
      auth = url;
    },
  });
  const link = callback(auth);
  link.searchParams.delete("code");
  link.searchParams.set("error", "authentication_failed");
  await assert.rejects(login.handle(link.toString()), /incomplete/);
  await assert.rejects(finished, /incomplete/);
  assert.equal(calls.length, 0);
});
test("invalid callback destinations and expired pending flows cannot exchange a code", async (t) => {
  const { login, calls, options } = fixture(t);
  let auth;
  const controller = new AbortController();
  const finished = login.start({
    returnUrl: studioOrigin + "/",
    signal: controller.signal,
    openBrowser: async (url) => {
      auth = url;
    },
  });
  for (const url of [
    "https://evil.test/google/callback",
    "plasmic-desktop://oauth/other",
    "plasmic-desktop://user@oauth/google/callback",
  ]) {
    await assert.rejects(login.handle(url), /Invalid/);
  }
  controller.abort("window-closed");
  await assert.rejects(finished);
  const pending = JSON.parse(fs.readFileSync(login.file));
  pending.expiresAt = Date.now() - 1;
  fs.writeFileSync(login.file, JSON.stringify(pending));
  const restarted = new DesktopGoogleLogin(options);
  await assert.rejects(restarted.handle(callback(auth).toString()), /expired/);
  assert.equal(calls.length, 0);
});
