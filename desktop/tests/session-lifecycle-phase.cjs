// Runs only in the separately packaged acceptance app and isolated profile.
const electron = require("electron");
require("./src/runtime-security.cjs").configureProductionRuntime(electron.app);
const Module = require("node:module");
const load = Module._load;
const guardedElectron = new Proxy(electron, {
  get(target, key) {
    if (key === "safeStorage") throw new Error("Login must not access Electron safeStorage");
    return Reflect.get(target, key);
  },
});
// Electron's exports are non-configurable; intercept fixture imports instead.
Module._load = function (request, ...args) {
  return request === "electron" ? guardedElectron : load.call(this, request, ...args);
};
const { app, BrowserWindow, session, net } = guardedElectron;
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { createServer } = require("node:http");
const { createDeviceCredentials } = require("./src/device-credentials.cjs");
const { DesktopUnifiedLogin, AUTH_ORIGIN } = require("./src/unified-login.cjs");
const { MacUpdater, acknowledgeMacUpdate } = require("./src/mac-updater.cjs");
const profile = process.env.PLASMIC_DESKTOP_PROFILE;
assert(profile, "Acceptance requires an isolated profile");
app.setPath("userData", profile);
app.setPath("sessionData", profile);
const { phase } = JSON.parse(fs.readFileSync(path.join(profile, "control.json")));
const timeout = setTimeout(() => { console.error(`Timed out: ${phase}`); app.exit(1); }, 25000);
let server, win;
async function finish(extra = {}) {
  const result = { status: "PASS", phase, version: app.getVersion(), ...extra };
  fs.writeFileSync(path.join(profile, `${phase}.json`), JSON.stringify(result));
  if (phase === "upgraded_startup") await acknowledgeMacUpdate(app);
  win?.destroy();
  server?.close();
  clearTimeout(timeout);
  app.quit();
}
app.whenReady().then(async () => {
  await acknowledgeMacUpdate(app, false);
  let origin;
  server = createServer((req, res) => {
    if (req.url === "/ticket") {
      res.writeHead(302, { "Set-Cookie": "fixture_session=owned-authenticated; Path=/; HttpOnly; Max-Age=3600; SameSite=Lax", Location: origin + (phase === "login" ? "/studio" : "/") });
      res.end();
    } else if (req.url === "/cookie-check") {
      res.end(req.headers.cookie?.includes("fixture_session=owned-authenticated") ? "authenticated" : "unauthenticated");
    } else if (req.url === "/updates/latest-mac.yml") {
      const archive = fs.readFileSync(path.join(profile, "upgrade.zip"));
      res.end(JSON.stringify({ version: "1.0.2", files: [{ url: `Plasmic-1.0.2-mac-${process.arch}.zip`, size: archive.length, sha512: createHash("sha512").update(archive).digest("base64") }] }));
    } else if (req.url.startsWith("/updates/Plasmic-")) {
      fs.createReadStream(path.join(profile, "upgrade.zip")).pipe(res);
    } else {
      res.setHeader("Content-Type", "text/html");
      res.end("<html><body>Owned login lifecycle fixture</body></html>");
    }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  const ses = session.fromPartition("persist:plasmic-desktop");
  const nativeFetch = ses.fetch.bind(ses);
  const grants = [];
  ses.fetch = async (url, init) => {
    if (url === AUTH_ORIGIN + "/oauth/token") {
      const form = new URLSearchParams(init.body);
      grants.push(form.get("grant_type"));
      if (phase !== "login") {
        assert.equal(form.get("refresh_token"), JSON.parse(fs.readFileSync(path.join(profile, "device-session.json"))).refreshToken);
      }
      return Response.json({ token_type: "Bearer", access_token: "owned-test-access", refresh_token: `owned-test-refresh-${phase}`, expires_in: 900 });
    }
    if (url === AUTH_ORIGIN + "/oauth/web-session-ticket") {
      return Response.json({ url: AUTH_ORIGIN + "/oauth/web-session?ticket=owned-fixture" });
    }
    if (url === AUTH_ORIGIN + "/oauth/revoke") return Response.json({});
    return nativeFetch(url, init);
  };
  const credentialFile = path.join(profile, "device-session.json");
  const credentials = createDeviceCredentials({ file: credentialFile });
  const login = new DesktopUnifiedLogin({ session: ses, studioOrigin: origin, credentials,
    request: init => net.request({ ...init, url: origin + "/ticket" }) });
  win = new BrowserWindow({ show: false, webPreferences: { session: ses, sandbox: true, contextIsolation: true } });
  await win.loadURL(origin + "/studio");
  if (phase === "first_install") {
    assert.equal(credentials.read(), undefined);
    assert.equal(await login.restore(), false);
    assert.equal(fs.readFileSync(path.join(profile, "device-credentials"), "utf8"), "legacy-ciphertext-unreadable-without-keychain");
    await finish({ legacyCredentialUntouched: true });
    return;
  }
  if (phase === "login") {
    await login.start({ returnUrl: origin + "/studio", openBrowser: async url => {
      const auth = new URL(url);
      assert(auth.searchParams.get("code_challenge"));
      assert(login.acceptCallback(`plasmic-desktop://oauth/callback?state=${auth.searchParams.get("state")}&code=${"c".repeat(43)}`));
    } });
    assert.deepEqual(grants, ["authorization_code"]);
  } else {
    assert(credentials.read()?.refreshToken.startsWith("owned-test-refresh-"));
    // Expired cookies must be recoverable from the file without browser login.
    await ses.cookies.remove(origin, "fixture_session");
    assert.equal(await login.restore(), true);
    assert.deepEqual(grants, ["refresh_token"]);
  }
  assert.equal(await (await nativeFetch(origin + "/cookie-check")).text(), "authenticated");
  assert.deepEqual(JSON.parse(fs.readFileSync(credentialFile, "utf8")), { refreshToken: `owned-test-refresh-${phase}` });
  assert.equal(fs.statSync(credentialFile).mode & 0o777, 0o600);
  await ses.cookies.flushStore();
  if (phase === "upgrade") {
    const updater = new MacUpdater({ app, feedUrl: "https://owned-update.fixture/updates/", fetch: (url, init) => nativeFetch(origin + new URL(url).pathname, init) });
    await updater.checkForUpdates();
    await updater.downloadUpdate();
    fs.writeFileSync(path.join(profile, "control.json"), JSON.stringify({ phase: "upgraded_startup" }));
    fs.writeFileSync(path.join(profile, "upgrade.json"), JSON.stringify({ status: "PASS", downloadedAndVerified: true, version: app.getVersion() }));
    await updater.quitAndInstall();
    win.destroy();
    server.close();
    clearTimeout(timeout);
  } else if (phase === "sign_out") {
    await login.signOut();
    assert.equal(credentials.read(), undefined);
    assert.equal(await login.restore(), false);
    await finish({ signedOut: true });
  } else {
    await finish({ authenticated: true, grant: grants[0], privateJSON: true });
  }
}).catch(error => {
  console.error(error);
  fs.writeFileSync(path.join(profile, `${phase}.json`), JSON.stringify({ status: "FAIL", error: error.message }));
  app.exit(1);
});
