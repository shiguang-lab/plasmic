const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { createHash } = require("node:crypto");
const {
  DesktopUnifiedLogin,
  AUTH_ORIGIN,
} = require("../src/unified-login.cjs");
const studioOrigin = "https://studio.plasmic.shiguanglab.com";
function fixture(options = {}) {
  const calls = [];
  const session = {
    cookies: { flushStore: async () => {} },
    fetch: async (url, init) => {
      calls.push({ url, init });
      if (url.endsWith("/oauth/token")) {
        if (options.tokenResponse) return options.tokenResponse();
        return Response.json({
          access_token: "ephemeral-access-token",
          token_type: "Bearer",
        });
      }
      if (url.endsWith("/oauth/web-session-ticket")) {
        return Response.json({
          url:
            options.ticketUrl ||
            AUTH_ORIGIN + "/oauth/web-session?ticket=one-use",
        });
      }
      throw new Error("Unexpected fetch");
    },
  };
  const request = (init) => {
    calls.push({ url: init.url, init });
    const client = new EventEmitter();
    client.abort = () =>
      client.emit("error", new Error("Redirect was cancelled"));
    client.end = () =>
      queueMicrotask(() => {
        if (options.ticketStatus && options.ticketStatus !== 302) {
          client.emit("response", { resume() {} });
        } else {
          client.emit(
            "redirect",
            302,
            "GET",
            options.location || studioOrigin + "/projects/example",
          );
        }
      });
    return client;
  };
  return {
    login: new DesktopUnifiedLogin({ session, studioOrigin, request }),
    calls,
  };
}

const code = "c".repeat(43);
function callback(login, authorization, options = {}) {
  const auth = new URL(authorization);
  const target = new URL("plasmic-desktop://oauth/callback");
  target.searchParams.set(
    "state",
    options.state ?? auth.searchParams.get("state"),
  );
  if (options.error) target.searchParams.set("error", options.error);
  else target.searchParams.set("code", code);
  return login.acceptCallback(target.href);
}
test("HTTPS callback delivers a PKCE-bound code and establishes the IAM desktop session", async () => {
  const { login, calls } = fixture();
  let authorization;
  const result = await login.start({
    returnUrl: studioOrigin + "/projects/example",
    openBrowser: async (url) => {
      authorization = new URL(url);
      assert.equal(authorization.origin, AUTH_ORIGIN);
      assert.equal(authorization.pathname, "/oauth/authorize");
      assert.equal(authorization.searchParams.get("client_id"), "plasmicapp");
      assert.equal(authorization.searchParams.get("scope"), "web:session");
      assert.equal(
        authorization.searchParams.get("redirect_uri"),
        AUTH_ORIGIN + "/auth/apps/plasmicapp/callback",
      );
      assert.equal(
        authorization.searchParams.get("code_challenge_method"),
        "S256",
      );
      assert.equal(callback(login, url), true);
      assert.equal(callback(login, url), false);
    },
  });
  assert.equal(result, studioOrigin + "/projects/example");
  const form = new URLSearchParams(calls[0].init.body);
  assert.equal(form.get("code"), code);
  assert.equal(
    createHash("sha256").update(form.get("code_verifier")).digest("base64url"),
    authorization.searchParams.get("code_challenge"),
  );
  assert.equal(
    form.get("redirect_uri"),
    authorization.searchParams.get("redirect_uri"),
  );
  assert.equal(
    calls[1].init.headers.Authorization,
    "Bearer ephemeral-access-token",
  );
  assert.equal(calls[2].init.redirect, "manual");
  assert.equal(calls[2].init.credentials, "include");
});
test("forged states, unrelated protocols and callbacks without pending login cannot authenticate", async () => {
  const { login } = fixture();
  assert.equal(
    login.acceptCallback(
      "plasmic-desktop://oauth/callback?code=" +
        code +
        "&state=" +
        "x".repeat(43),
    ),
    false,
  );
  await login.start({
    returnUrl: studioOrigin + "/projects/example",
    openBrowser: async (url) => {
      assert.equal(callback(login, url, { state: "x".repeat(43) }), false);
      assert.equal(callback(login, url, { state: "界".repeat(43) }), false);
      const state = new URL(url).searchParams.get("state");
      for (const prefix of [
        "https://oauth/callback",
        "plasmic-desktop://evil/callback",
        "plasmic-desktop://oauth/other",
        "plasmic-desktop://user@oauth/callback",
      ]) {
        assert.equal(
          login.acceptCallback(prefix + "?state=" + state + "&code=" + code),
          false,
        );
      }
      for (const extra of [
        "&state=" + state,
        "&code=" + code,
        "&error=access_denied",
        "&error=access_denied&error=access_denied",
      ]) {
        assert.equal(
          login.acceptCallback(
            "plasmic-desktop://oauth/callback?state=" +
              state +
              "&code=" +
              code +
              extra,
          ),
          false,
        );
      }
      assert.equal(callback(login, url), true);
    },
  });
});
test("cancelling clears the pending login and ignores late native callbacks", async () => {
  const { login, calls } = fixture();
  const abort = new AbortController();
  let auth;
  await assert.rejects(
    login.start({
      returnUrl: studioOrigin + "/",
      signal: abort.signal,
      openBrowser: async (url) => {
        auth = url;
        abort.abort();
      },
    }),
    /cancelled/,
  );
  assert.equal(calls.length, 0);
  assert.equal(callback(login, auth), false);
});
test("denied authorization reports an app error without exchanging credentials", async () => {
  const { login, calls } = fixture();
  await assert.rejects(
    login.start({
      returnUrl: studioOrigin + "/",
      openBrowser: async (url) => {
        assert.equal(callback(login, url, { error: "access_denied" }), true);
      },
    }),
    /cancelled/,
  );
  assert.equal(calls.length, 0);
});
for (const options of [
  { ticketUrl: "https://evil.example/oauth/web-session?ticket=x" },
  { ticketStatus: 400 },
  { location: "https://evil.example" },
]) {
  test(
    "rejects invalid session ticket: " + JSON.stringify(options),
    async () => {
      const { login } = fixture(options);
      await assert.rejects(
        login.start({
          returnUrl: studioOrigin + "/projects/example",
          openBrowser: async (url) => {
            callback(login, url);
          },
        }),
        /session ticket/,
      );
    },
  );
}
test("token exchange failures are surfaced to the app", async () => {
  const { login } = fixture({
    tokenResponse: () =>
      Response.json({ error: "invalid_grant" }, { status: 400 }),
  });
  await assert.rejects(
    login.start({
      returnUrl: studioOrigin + "/",
      openBrowser: async (url) => {
        callback(login, url);
      },
    }),
    /authorization returned 400/,
  );
});
test("rejects cross-origin return destinations before opening the browser", async () => {
  const { login } = fixture();
  await assert.rejects(
    login.start({
      returnUrl: "https://evil.example",
      openBrowser: () => assert.fail(),
    }),
    /destination/,
  );
});
