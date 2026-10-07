const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DesktopGoogleLogin, CALLBACK } = require("../src/google-login.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { randomBytes } = require("node:crypto");
const {
  GoogleAuthWindow,
  AUTH_PATH,
} = require("../src/google-auth-window.cjs");
const origin = "https://studio.plasmic.shiguanglab.com";
function window(t) {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "plasmic-auth-window-"));
  t.after(() => fs.rmSync(userData, { recursive: true, force: true }));
  const win = new EventEmitter();
  win.url = origin + "/login?continueTo=%2Fprojects%2Fexample";
  win.loads = [];
  win.webContents = {
    getURL: () => win.url,
    send: () => {},
    session: {
      fetch: async (url) =>
        Response.json(
          url.endsWith("/csrf") ? { csrf: "test" } : { status: true },
        ),
    },
  };
  win.loadURL = async (url) => {
    win.url = url;
    win.loads.push(url);
  };
  win.isDestroyed = () => false;
  win.show = win.focus = () => {};
  win.login = new DesktopGoogleLogin({ userData, session: win.webContents.session, studioOrigin: origin });
  return win;
}
test("OAuth uses one main window and returns to the requested design after exchanging the callback", async (t) => {
  const win = window(t);
  let opens = 0;
  const login = new GoogleAuthWindow(win, origin, async (url) => {
    opens++;
    const authorization = new URL(url);
    assert.equal(authorization.origin, origin);
    const callback = new URL(CALLBACK);
    callback.searchParams.set(
      "state",
      authorization.searchParams.get("desktopState"),
    );
    callback.searchParams.set("code", randomBytes(32).toString("base64url"));
    await win.login.handle(callback.toString());
  }, win.login);
  await login.begin();
  assert.deepEqual(win.loads, [
    origin + AUTH_PATH,
    origin + "/projects/example",
  ]);
  assert.equal(login.status.phase, "success");
  assert.equal(opens, 1);
});
test("Browser launch failure is visible and retry can establish a fresh flow", async (t) => {
  const win = window(t);
  let opens = 0;
  const login = new GoogleAuthWindow(win, origin, async () => {
    opens++;
    throw new Error("System browser could not open");
  }, win.login);
  await login.begin();
  assert.equal(login.status.phase, "error");
  assert.match(login.status.message, /System browser/);
  assert.equal(login.abort, undefined);
  assert.equal(win.url, origin + AUTH_PATH);
  await login.begin();
  assert.equal(opens, 2);
  await login.command("cancel");
  assert.equal(win.url, origin + "/login?continueTo=%2Fprojects%2Fexample");
});
test('an expired cold-start callback displays an error and can start a fresh login', async t => {
  const win = window(t);
  const login = new GoogleAuthWindow(win, origin, async url => {
    const auth = new URL(url);
    const callback = new URL(CALLBACK);
    callback.searchParams.set('state', auth.searchParams.get('desktopState'));
    callback.searchParams.set('code', randomBytes(32).toString('base64url'));
    await win.login.handle(callback.toString());
  }, win.login);
  await login.receiveCallback(CALLBACK + '?state=' + randomBytes(32).toString('base64url') + '&error=expired');
  assert.equal(login.status.phase, 'error');
  await login.begin();
  assert.equal(login.status.phase, 'success');
  assert.equal(win.url, origin + '/');
});
