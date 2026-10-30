const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { createHash } = require("node:crypto");
const {
  DesktopUnifiedLogin,
  AUTH_ORIGIN,
} = require("../src/unified-login.cjs");
const studioOrigin = "https://plasmic-studio.shiguanglab.com";
function fixture(options = {}) {
  const calls = [];
  const session = {
    cookies: { flushStore: async () => {} },
    fetch: async (url, init) => {
      calls.push({ url, init });
      if (url.endsWith("/oauth/token")) {
        if (options.tokenResponse) {
          return options.tokenResponse();
        }
        return Response.json({
          access_token: "ephemeral-access-token",
          token_type: "Bearer",
          refresh_token: "rotating-refresh-token",
          expires_in: 900,
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
    login: new DesktopUnifiedLogin({
      session,
      studioOrigin,
      request,
      credentials: options.credentials,
      now: options.now,
    }),
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
  if (options.error) {
    target.searchParams.set("error", options.error);
  } else {
    target.searchParams.set("code", code);
  }
  return login.acceptCallback(target.href);
}
test("HTTPS callback delivers a PKCE-bound code and establishes the IAM desktop session", async () => {
  const { login, calls } = fixture();
  const transitions = [];
  login.on("session-changed", () => transitions.push(login.signingIn));
  let authorization;
  const result = await login.start({
    returnUrl: studioOrigin + "/projects/example",
    openBrowser: async (url) => {
      authorization = new URL(url);
      assert.equal(authorization.origin, AUTH_ORIGIN);
      assert.equal(authorization.pathname, "/oauth/authorize");
      assert.equal(authorization.searchParams.get("client_id"), "plasmicapp");
      assert.equal(
        authorization.searchParams.get("scope"),
        "web:session offline_access",
      );
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
  assert.deepEqual(transitions, [true, false], "both sides of login invalidate native verification");
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

function storedCredentials(initial = "old-refresh") {
  let value = initial ? { refreshToken: initial } : undefined;
  const writes = [];
  return {
    read: () => value,
    write: (next) => {
      value = next;
      writes.push(next);
    },
    clear: () => {
      value = undefined;
    },
    writes,
  };
}
test("device refresh is shared by concurrent callers, persists rotation and restores cookies without navigation", async () => {
  const credentials = storedCredentials();
  const { login, calls } = fixture({
    credentials,
    location: studioOrigin + "/",
  });
  const results = await Promise.all([
    login.restore(),
    login.restore(),
    login.restore(),
  ]);
  assert.deepEqual(results, [true, true, true]);
  assert.equal(
    calls.filter((call) => call.url.endsWith("/oauth/token")).length,
    1,
  );
  const form = new URLSearchParams(calls[0].init.body);
  assert.equal(form.get("grant_type"), "refresh_token");
  assert.equal(form.get("refresh_token"), "old-refresh");
  assert.equal(form.get("client_id"), "plasmicapp");
  assert.equal(credentials.read().refreshToken, "rotating-refresh-token");
  await login.restore();
  assert.equal(
    calls.length,
    3,
    "fresh sessions do not refresh on every API request",
  );
});
test("only an explicit invalid_grant removes stored device authorization", async () => {
  for (const [status, error] of [
    [400, "invalid_grant"],
    [503, "temporarily_unavailable"],
  ]) {
    const credentials = storedCredentials();
    const { login } = fixture({
      credentials,
      tokenResponse: () => Response.json({ error }, { status }),
    });
    let changes = 0;
    login.on("session-changed", () => changes++);
    if (status === 400) {
      assert.equal(await login.restore(), false);
      assert.equal(credentials.read(), undefined);
      assert.equal(changes, 1, "device revocation invalidates native identity");
    } else {
      await assert.rejects(login.restore(), /503/);
      assert.equal(credentials.read().refreshToken, "old-refresh");
      assert.equal(changes, 0, "a temporary failure does not report a changed session");
    }
  }
  const credentials = storedCredentials();
  const { login } = fixture({
    credentials,
    tokenResponse: () => {
      throw new Error("Offline");
    },
  });
  await assert.rejects(login.restore(), /Offline/);
  assert.equal(credentials.read().refreshToken, "old-refresh");
});
test("a failed ticket exchange retains the rotated refresh credential", async () => {
  const credentials = storedCredentials();
  const { login } = fixture({ credentials, ticketStatus: 400 });
  await assert.rejects(login.restore(), /ticket was rejected/);
  assert.equal(credentials.read().refreshToken, "rotating-refresh-token");
});
test("idle background requests do not count as user activity; reopening restores a saved authorization", async () => {
  let now = 1_000_000;
  const credentials = storedCredentials();
  const { login, calls } = fixture({
    credentials,
    now: () => now,
    location: studioOrigin + "/",
  });
  assert.equal(login.isActive(), false);
  await login.noteActivity();
  assert.equal(login.isActive(), true);
  now += 61_000;
  assert.equal(login.isActive(), false);
  now += 20 * 60_000;
  assert.equal(
    calls.length,
    3,
    "no timer rotates credentials while the user is absent",
  );
  await login.noteActivity();
  assert.equal(calls.length, 6);
  const reopened = fixture({ credentials, location: studioOrigin + "/" });
  assert.equal(await reopened.login.noteActivity(), true);
  assert.equal(
    new URLSearchParams(reopened.calls[0].init.body).get("refresh_token"),
    "rotating-refresh-token",
  );
});
test("sign-out revokes the current refresh token and clears local authorization", async () => {
  const credentials = storedCredentials();
  const { login } = fixture({ credentials });
  const transitions = [];
  login.on("session-changed", () => transitions.push(login.signingOut));
  login.post = async (path, form) => {
    assert.equal(path, "/oauth/revoke");
    assert.deepEqual(form, { token: "old-refresh" });
    return {};
  };
  await login.signOut();
  assert.deepEqual(transitions, [true, false], "sign-out cannot retain verification from either side of revocation");
  assert.equal(credentials.read(), undefined);
  assert.equal(await login.restore(), false);
});

test("background restoration is explicitly marked inactive and returning to the App records real use", async () => {
  const credentials = storedCredentials();
  const { login, calls } = fixture({
    credentials,
    location: studioOrigin + "/",
  });
  await login.restore();
  assert.equal(
    new URLSearchParams(calls[0].init.body).get("user_activity"),
    "false",
  );
  await login.noteActivity();
  const rotations = calls.filter((call) => call.url.endsWith("/oauth/token"));
  assert.equal(rotations.length, 2);
  assert.equal(
    new URLSearchParams(rotations[1].init.body).get("user_activity"),
    "true",
  );
});

test("foreground use arriving during a background rotation records activity with the rotated credential", async () => {
  const credentials = storedCredentials();
  let finish;
  let rotations = 0;
  const { login, calls } = fixture({
    credentials,
    location: studioOrigin + "/",
    tokenResponse: () => {
      rotations++;
      const response = () =>
        Response.json({
          access_token: "access",
          token_type: "Bearer",
          refresh_token: "refresh-" + rotations,
          expires_in: 900,
        });
      if (rotations === 1) {
        return new Promise((resolve) => {
          finish = () => resolve(response());
        });
      }
      return response();
    },
  });
  const background = login.restore();
  const foreground = login.noteActivity();
  finish();
  assert.deepEqual(await Promise.all([background, foreground]), [true, true]);
  const forms = calls
    .filter((call) => call.url.endsWith("/oauth/token"))
    .map((call) => new URLSearchParams(call.init.body));
  assert.deepEqual(
    forms.map((form) => form.get("user_activity")),
    ["false", "true"],
  );
  assert.equal(forms[1].get("refresh_token"), "refresh-1");
  assert.equal(credentials.read().refreshToken, "refresh-2");
});
