const { test } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const { EventEmitter } = require("node:events");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const YAML = require("yaml");

test("update IPC accepts only the main Studio frame and bypasses the bundled protocol for NAS checks", { skip: process.platform !== "darwin" }, async (t) => {
  const userData = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-updates-ipc-"));
  t.after(() => fs.rm(userData, { recursive: true, force: true }));
  const app = new EventEmitter();
  app.isPackaged = true;
  app.getVersion = () => "0.0.1";
  app.getPath = () => userData;
  const handlers = {};
  const load = Module._load;
  Module._load = function (id, ...args) { return id === "electron" ? { app, ipcMain: { handle: (name, callback) => { handlers[name] = callback; } } } : load.call(this, id, ...args); };
  let createUpdates;
  try { ({ createUpdates } = require("../src/updates.cjs")); }
  finally { Module._load = load; }
  const config = { studioOrigin: "https://studio.example", updateUrl: "https://updates.example/desktop-updates" };
  const sent = [];
  const frame = { url: config.studioOrigin + "/projects/test" };
  const webContents = { mainFrame: frame, send: (channel, status) => sent.push({ channel, status }) };
  const window = { webContents, isDestroyed: () => false };
  let requests = 0;
  const manager = await createUpdates({ config, getWindow: () => window, beforeInstall: async () => {}, session: { fetch: async (url, options) => {
    requests++;
    assert.equal(url, `https://updates.example/desktop-updates/darwin/${process.arch}/latest-mac.yml`);
    assert.equal(options.bypassCustomProtocolHandlers, true);
    return new Response(YAML.stringify({ version: "0.0.1" }));
  } } });
  t.after(() => manager.stop());
  const handler = handlers["desktop:update"];
  for (const event of [
    { sender: {}, senderFrame: frame },
    { sender: webContents, senderFrame: { url: frame.url } },
  ]) assert.throws(() => handler(event, "install"), /Invalid update sender/);
  frame.url = "https://canvas.example/projects/test";
  assert.throws(() => handler({ sender: webContents, senderFrame: frame }, "check"), /Invalid update sender/);
  assert.equal(requests, 0);
  frame.url = config.studioOrigin + "/";
  assert.equal((await handler({ sender: webContents, senderFrame: frame }, "check")).phase, "current");
  assert.equal(requests, 1);
  assert.equal(sent.at(-1).channel, "desktop:update-status");
});
