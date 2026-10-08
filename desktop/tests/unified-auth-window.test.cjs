const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const {
  UnifiedAuthWindow,
  AUTH_PATH,
} = require("../src/unified-auth-window.cjs");
const origin = "https://studio.plasmic.shiguanglab.com";
function window() {
  const win = new EventEmitter();
  win.url = origin + "/login";
  win.loads = [];
  win.webContents = { getURL: () => win.url, send: () => {} };
  win.loadURL = async (url) => {
    win.url = url;
    win.loads.push(url);
  };
  win.show = win.focus = () => {};
  win.isDestroyed = () => false;
  return win;
}
test("central return_to reaches the original project in the same window", async () => {
  const win = window();
  const destination = origin + "/projects/example?branch=main";
  let starts = 0;
  const auth = new UnifiedAuthWindow(win, origin, () => {}, {
    start: async ({ returnUrl }) => {
      starts++;
      assert.equal(returnUrl, destination);
    },
  });
  await auth.show(
    "https://shiguanglab.com/login?return_to=" +
      encodeURIComponent(destination),
  );
  assert.equal(starts, 0, "navigation must not start browser authorization");
  assert.equal(auth.status.phase, "idle");
  await auth.command("sign-in");
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(win.loads, [origin + AUTH_PATH, destination]);
  assert.equal(auth.status.phase, "success");
});
test("cancel returns to the sign-in prompt and allows a fresh attempt", async () => {
  const win = window();
  let starts = 0;
  const auth = new UnifiedAuthWindow(win, origin, () => {}, {
    start: async ({ signal }) => {
      starts++;
      if (starts === 1) {
        await new Promise((_, reject) =>
          signal.addEventListener(
            "abort",
            () => reject(new Error("cancelled")),
            { once: true },
          ),
        );
      }
    },
  });
  await auth.show();
  await auth.command("sign-in");
  await new Promise((resolve) => setImmediate(resolve));
  await auth.command("cancel");
  assert.equal(win.url, origin + AUTH_PATH);
  assert.equal(auth.status.phase, "idle");
  await auth.command("sign-in");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(auth.status.phase, "success");
  assert.equal(starts, 2);
});
test("cancelling during browser launch cannot restore the waiting state", async () => {
  const win = window();
  let finishOpening;
  const opened = new Promise((resolve) => {
    finishOpening = resolve;
  });
  const auth = new UnifiedAuthWindow(win, origin, () => opened, {
    start: async ({ openBrowser, onAuthorizationUrl }) => {
      onAuthorizationUrl("https://shiguanglab.com/oauth/authorize");
      await openBrowser("https://shiguanglab.com/oauth/authorize");
    },
  });
  await auth.show();
  await auth.command("sign-in");
  await auth.show();
  assert.equal(auth.status.phase, "opening");
  assert.equal((await auth.command("sign-in")).phase, "opening");
  await auth.command("cancel");
  finishOpening();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(auth.status.phase, "idle");
  assert.equal(auth.authorizationUrl, undefined);
  assert.deepEqual(win.loads, [origin + AUTH_PATH, origin + AUTH_PATH]);
});
