const { app, net, session, BrowserWindow } = require("electron");
const { createServer } = require("node:http");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { consumeSessionTicket } = require("../src/session-ticket.cjs");
const { forwardRemoteRequest } = require("../src/remote-fetch.cjs");
const { createAssetHandler } = require("../src/asset-handler.cjs");
const { DesktopController } = require("../src/controller.cjs");
const { DesktopUnifiedLogin, AUTH_ORIGIN } = require("../src/unified-login.cjs");
const { IslandAccount } = require("../src/island-account.cjs");
const { DesktopIdentity } = require("../src/identity.cjs");
const { createDraftHandler } = require("../src/drafts.cjs");
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "plasmic-session-test-"));
app.setPath("userData", profile);
let destinationRequests = 0;
let identityRequests = 0;
let origin;
const refreshActivity = [];
let deviceRevoked = false;
let refreshToken = "native-device-secret";
const server = createServer(async (req, res) => {
  if (req.url === "/oauth/token") {
    let body = "";
    for await (const chunk of req) body += chunk;
    const form = new URLSearchParams(body);
    assert.equal(form.get("grant_type"), "refresh_token");
    assert.equal(form.get("refresh_token"), refreshToken);
    refreshActivity.push(form.get("user_activity"));
    res.setHeader("Content-Type", "application/json");
    if (deviceRevoked) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: "invalid_grant" }));
    } else {
      refreshToken = "rotated-" + refreshActivity.length;
      res.end(JSON.stringify({
        access_token: "fixture-access",
        token_type: "Bearer",
        refresh_token: refreshToken,
        expires_in: 900,
      }));
    }
    return;
  } else if (req.url === "/oauth/web-session-ticket") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ url: AUTH_ORIGIN + "/oauth/web-session?ticket=fixture" }));
    return;
  } else if (req.url === "/oauth/web-session?ticket=fixture") {
    res.writeHead(302, {
      "Set-Cookie": "fixture_session=issued-by-iam; Path=/; HttpOnly; SameSite=Lax",
      Location: origin + "/",
    });
  } else if (req.url.startsWith("/api/v1/")) {
    if (req.url === "/api/v1/auth/self") identityRequests++;
    res.setHeader("Content-Type", "application/json");
    if (req.headers.cookie !== "fixture_session=issued-by-iam") {
      res.writeHead(401);
      res.end(JSON.stringify({ error: "unauthorized" }));
    } else if (req.method === "POST") {
      assert.equal(req.headers.origin, origin);
      let body = "";
      for await (const chunk of req) body += chunk;
      res.end(body);
    } else {
      res.end(JSON.stringify(req.url.endsWith("/auth/self")
        ? { user: { id: "fixture-user", displayName: "Fixture" } }
        : req.url.endsWith("/app-ctx")
          ? { teams: [], workspaces: [] }
          : { projects: [] }));
    }
    return;
  } else if (req.url === "/origin-check") {
    res.writeHead(req.headers.origin === origin ? 200 : 403);
  } else if (req.url === "/page") {
    res.setHeader("Content-Type", "text/html");
    res.end("<html><body>Owned session fixture</body></html>");
    return;
  } else if (req.url === "/ticket") {
    res.writeHead(302, {
      "Set-Cookie":
        "fixture_session=issued-by-iam; Path=/; HttpOnly; SameSite=Lax",
      Location: origin + "/studio",
    });
  } else if (req.url === "/rejected") {
    res.writeHead(302, { Location: origin + "/untrusted" });
  } else if (req.url === "/invalid") {
    res.writeHead(400);
  } else if (req.url === "/cookie-check") {
    res.end(
      req.headers.cookie === "fixture_session=issued-by-iam"
        ? "authenticated"
        : "unauthenticated",
    );
    return;
  } else {
    destinationRequests++;
    res.writeHead(200);
  }
  res.end();
});
const timeout = setTimeout(() => app.exit(1), 30_000);
app
  .whenReady()
  .then(async () => {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
    const {
      createDeviceCredentials,
    } = require("../src/device-credentials.cjs");
    const credentialFile = path.join(profile, "device-session.json");
    const credentials = createDeviceCredentials({
      file: credentialFile,
    });
    credentials.write({ refreshToken: "native-device-secret" });
    assert.equal(
      fs
        .readFileSync(credentialFile)
        .includes(Buffer.from("native-device-secret")),
      true,
    );
    assert.deepEqual(
      createDeviceCredentials({ file: credentialFile }).read(),
      { refreshToken: "native-device-secret" },
    );
    credentials.clear();
    const ses = session.fromPartition("session-ticket-fixture");
    await assert.rejects(
      ses.fetch(origin + "/ticket", {
        redirect: "manual",
        credentials: "include",
      }),
      /Redirect was cancelled/,
    );
    await ses.clearStorageData();
    const options = {
      session: ses,
      returnUrl: origin + "/studio",
      request: net.request,
    };
    await consumeSessionTicket({ ...options, url: origin + "/ticket" });
    assert.equal(
      await (
        await ses.fetch(origin + "/cookie-check", { credentials: "include" })
      ).text(),
      "authenticated",
    );
    await assert.rejects(
      consumeSessionTicket({ ...options, url: origin + "/rejected" }),
      /ticket was rejected/,
    );
    await assert.rejects(
      consumeSessionTicket({ ...options, url: origin + "/invalid" }),
      /ticket was rejected/,
    );
    const aborted = new AbortController();
    aborted.abort();
    await assert.rejects(
      consumeSessionTicket({
        ...options,
        url: origin + "/ticket",
        signal: aborted.signal,
      }),
      /cancelled/,
    );
    assert.equal(
      destinationRequests,
      0,
      "Neither accepted nor untrusted destinations should be requested",
    );
    ses.protocol.handle("http", (request) =>
      forwardRemoteRequest(ses, request),
    );
    const win = new BrowserWindow({
      show: false,
      webPreferences: { session: ses },
    });
    await win.loadURL(origin + "/page");
    assert.equal(
      await win.webContents.executeJavaScript(
        "fetch('/origin-check', {method: 'POST', credentials: 'include'}).then(r => r.status)",
      ),
      200,
    );
    let now = 1_000_000;
    credentials.write({ refreshToken });
    const login = new DesktopUnifiedLogin({
      studioOrigin: origin,
      credentials,
      now: () => now,
      session: {
        cookies: ses.cookies,
        fetch: (url, init) => ses.fetch(url.replace(AUTH_ORIGIN, origin), init),
      },
      request: (init) => net.request({
        ...init,
        session: ses,
        url: init.url.replace(AUTH_ORIGIN, origin),
      }),
    });
    const controller = new DesktopController(() => win, { studioOrigin: origin });
    const identity = new DesktopIdentity({
      session: ses, studioOrigin: origin, now: () => now,
      prepare: () => login.restore(),
      fetchIdentity: () => controller.requestStudio("/api/v1/auth/self"),
    });
    login.on("session-changed", () => identity.invalidate());
    const account = new IslandAccount(() => identity.read(), request => controller.requestStudio(request), () => {}, () => now);
    const drafts = createDraftHandler({
      store: { list: async () => [], read: async () => ({ id: "draft" }) }, origin,
      trustedSender: () => true, projectId: url => new URL(url).pathname.split("/")[2],
      currentUser: async () => (await identity.read()).user?.id,
    });
    identity.on("changed", () => drafts.invalidate());
    const draftEvent = { senderFrame: { url: origin + "/projects/fixture" } };
    ses.protocol.unhandle("http");
    ses.protocol.handle("http", createAssetHandler({
      root: profile,
      studioOrigin: origin,
      canvasOrigin: "http://canvas.example",
      remoteFetch: async (request) => {
        await login.restore();
        return forwardRemoteRequest(ses, request);
      },
    }));
    await ses.cookies.remove(origin, "fixture_session");
    await account.refresh();
    assert.equal(account.snapshot().status, "ready", "expired cookies restore silently before the island checks the account");
    assert.equal(account.snapshot().user.id, "fixture-user");
    assert.deepEqual(refreshActivity, ["false"], "background reads must not extend device inactivity");
    assert.equal(credentials.read().refreshToken, refreshToken);
    const sharedReads = identityRequests;
    const { handle } = await drafts.command(draftEvent, "open", { userId: "fixture-user", projectId: "fixture" });
    assert.equal(identityRequests, sharedReads, "draft opening reuses the island's verified identity without another HTTP request");
    await Promise.all([controller.requestStudio("/api/v1/auth/self"), controller.requestStudio("/api/v1/app-ctx")]);
    assert.equal(refreshActivity.length, 1, "fresh cookies reuse the restored session");
    now += 16 * 60_000;
    await ses.cookies.remove(origin, "fixture_session");
    account.invalidate(false);
    await Promise.all([account.refresh(), controller.requestStudio("/api/v1/auth/self")]);
    assert.equal(account.snapshot().status, "ready", "a second cookie expiry stays signed in");
    assert.deepEqual(refreshActivity, ["false", "false"]);
    assert.equal(login.isActive(), false);
    assert.equal(credentials.read().refreshToken, refreshToken);
    const restoredReads = identityRequests;
    assert.equal((await drafts.command(draftEvent, "read", { handle, id: "draft" })).id, "draft");
    assert.equal(identityRequests, restoredReads, "a same-account cookie rotation reauthorizes the existing draft handle from the restored identity");
    assert.deepEqual(await controller.requestStudio("/api/v1/teams", { name: "Fixture team" }), { name: "Fixture team" }, "native writes retain their body, cookies and Origin through the shared handler");
    deviceRevoked = true;
    now += 16 * 60_000;
    await ses.cookies.remove(origin, "fixture_session");
    account.invalidate(false);
    await account.refresh();
    assert.equal(account.snapshot().status, "signed-out", "rejected device authorization still requires sign-in");
    assert.equal(credentials.read(), undefined);
    await assert.rejects(drafts.command(draftEvent, "read", { handle, id: "draft" }), /401|Invalid draft session/);
    assert.equal(win.webContents.getURL(), origin + "/page", "account polling never navigates the editor");
    assert.equal(controller.activity.keepExpanded(), false, "account polling stays outside MCP activity");
    account.dispose();
    identity.dispose();
    controller.close();
    win.destroy();
    clearTimeout(timeout);
    server.close();
    console.log(
      "Native credentials, session tickets, request Origin and island silent restoration across cookie expiry and device revocation passed",
    );
    app.exit(0);
  })
  .catch((error) => {
    console.error(error);
    server.close();
    app.exit(1);
  });
