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
  const auth = new UnifiedAuthWindow(win, origin, () => {}, {
    start: async ({ returnUrl }) => assert.equal(returnUrl, destination),
  });
  await auth.begin(
    "https://shiguanglab.com/login?return_to=" +
      encodeURIComponent(destination),
  );
  assert.deepEqual(win.loads, [origin + AUTH_PATH, destination]);
  assert.equal(auth.status.phase, "success");
});
test("cancel stays on the intermediate page and allows a fresh retry", async () => {
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
  const first = auth.begin();
  await new Promise((resolve) => setImmediate(resolve));
  await auth.command("cancel");
  await first;
  assert.equal(win.url, origin + AUTH_PATH);
  assert.equal(auth.status.phase, "cancelled");
  await auth.begin();
  assert.equal(auth.status.phase, "success");
  assert.equal(starts, 2);
});
