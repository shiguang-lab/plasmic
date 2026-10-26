// Run with Electron; exercises only the owned background entry, no editor or API.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { app, BrowserWindow } = require("electron");
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "plasmic-background-"));
process.env.PLASMIC_DESKTOP_PROFILE = profile;
process.argv.push("--mcp");
const timeout = setTimeout(() => app.exit(1), 15000);
require("../src/local-rpc.cjs").startRpc(profile, async () => ({})).then(async (stop) => {
  require("../src/entry.cjs");
  await app.whenReady();
  assert.equal(BrowserWindow.getAllWindows().length, 0);
  assert.equal(require.cache[require.resolve("../src/main.cjs")], undefined);
  if (process.platform === "darwin") assert.equal(app.dock.isVisible(), false);
  process.stderr.write(JSON.stringify({ passed: true, windows: 0, guiLoaded: false,
    dockVisible: app.dock?.isVisible() ?? null }) + "\n");
  clearTimeout(timeout);
  await stop();
  fs.rmSync(profile, { recursive: true, force: true });
  app.exit(0);
}).catch((error) => {
  process.stderr.write(error.stack + "\n");
  fs.rmSync(profile, { recursive: true, force: true });
  app.exit(1);
});
