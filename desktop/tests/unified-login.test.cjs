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

async function callback(url, state, code = "single-use-code") {
  const auth = new URL(url);
  const target = new URL(auth.searchParams.get("redirect_uri"));
  target.searchParams.set("state", state ?? auth.searchParams.get("state"));
  target.searchParams.set("code", code);
  return fetch(target);
}
test("PKCE loopback exchange uses IAM-issued session tickets and preserves the design URL", async () => {
  const { login, calls } = fixture();
  let authorization;
  let browserResponse;
  const result = await login.start({
    returnUrl: studioOrigin + "/projects/example",
    openBrowser: async (url) => {
      authorization = new URL(url);
      assert.equal(authorization.origin, AUTH_ORIGIN);
      assert.equal(authorization.pathname, "/oauth/authorize");
      assert.equal(authorization.searchParams.get("client_id"), "plasmicapp");
      assert.equal(authorization.searchParams.get("scope"), "web:session");
      assert.equal(
        authorization.searchParams.get("code_challenge_method"),
        "S256",
      );
      browserResponse = callback(url);
    },
  });
  assert.equal(result, studioOrigin + "/projects/example");
  const response = await browserResponse;
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  const html = await response.text();
  assert.match(html, /You're signed in/);
  assert.match(
    html,
    /<script>window.location.assign\("plasmic-desktop:\/\/login-complete"\);<\/script>/,
  );
  assert.match(html, /href="plasmic-desktop:\/\/login-complete"/);
  assert.ok(!html.includes("ephemeral-access-token"));
  assert.ok(!html.includes("single-use-code"));
  const script = html.match(/<script>(.*?)<\/script>/)[1];
  assert.ok(
    response.headers
      .get("content-security-policy")
      .includes(
        `'sha256-${createHash("sha256").update(script).digest("base64")}'`,
      ),
  );
  const tokenForm = new URLSearchParams(calls[0].init.body);
  assert.equal(
    createHash("sha256")
      .update(tokenForm.get("code_verifier"))
      .digest("base64url"),
    authorization.searchParams.get("code_challenge"),
  );
  assert.equal(
    tokenForm.get("redirect_uri"),
    authorization.searchParams.get("redirect_uri"),
  );
  assert.equal(
    calls[1].init.headers.Authorization,
    "Bearer ephemeral-access-token",
  );
  assert.equal(calls[2].init.redirect, "manual");
  assert.equal(calls[2].init.credentials, "include");
  await assert.rejects(fetch(authorization.searchParams.get("redirect_uri")));
});
test("forged and Unicode callback states are rejected without consuming the real callback", async () => {
  const { login } = fixture();
  let browserResponse;
  await login.start({
    returnUrl: studioOrigin + "/projects/example",
    openBrowser: async (url) => {
      assert.equal((await callback(url, "x".repeat(43))).status, 400);
      assert.equal((await callback(url, "界".repeat(43))).status, 400);
      browserResponse = callback(url);
    },
  });
  assert.equal((await browserResponse).status, 200);
});
test("browser success and automatic app launch wait for the desktop session exchange", async () => {
  let releaseToken, tokenStarted;
  const started = new Promise((resolve) => {
    tokenStarted = resolve;
  });
  const token = new Promise((resolve) => {
    releaseToken = resolve;
  });
  const { login } = fixture({
    tokenResponse: () => {
      tokenStarted();
      return token;
    },
  });
  let browserResponse,
    responded = false;
  const result = login.start({
    returnUrl: studioOrigin + "/projects/example",
    openBrowser: async (url) => {
      browserResponse = callback(url).then((response) => {
        responded = true;
        return response;
      });
    },
  });
  await started;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(responded, false);
  releaseToken(
    Response.json({
      access_token: "ephemeral-access-token",
      token_type: "Bearer",
    }),
  );
  await result;
  assert.equal((await browserResponse).status, 200);
});
test("cancel closes the listener and performs no credential exchange", async () => {
  const { login, calls } = fixture();
  const abort = new AbortController();
  let redirect;
  await assert.rejects(
    login.start({
      returnUrl: studioOrigin + "/",
      signal: abort.signal,
      openBrowser: async (url) => {
        redirect = new URL(url).searchParams.get("redirect_uri");
        abort.abort();
      },
    }),
    /cancelled/,
  );
  assert.equal(calls.length, 0);
  await assert.rejects(fetch(redirect));
});
for (const options of [
  { ticketUrl: "https://evil.example/oauth/web-session?ticket=x" },
  { ticketStatus: 400 },
  { location: "https://evil.example" },
]) {
  test(
    "rejects invalid ticket or destination: " + JSON.stringify(options),
    async () => {
      const { login } = fixture(options);
      let browserResponse;
      await assert.rejects(
        login.start({
          returnUrl: studioOrigin + "/projects/example",
          openBrowser: async (url) => {
            browserResponse = callback(url);
          },
        }),
        /session ticket/,
      );
      const response = await browserResponse;
      assert.equal(response.status, 502);
      const html = await response.text();
      assert.match(html, /Sign-in could not be completed/);
      assert.ok(
        !html.includes("<script>"),
        "failed login must not automatically open the app",
      );
    },
  );
}
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
