// Regression for Electron's virtual ASAR filesystem during bundle cleanup.
const { app, BrowserWindow } = require("electron");
const fs = require("original-fs").promises;
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const { createPackage } = require("@electron/asar");
const { acknowledgeMacUpdate } = require("../src/mac-updater.cjs");
let root;
let window;
app.whenReady().then(async () => {
  window = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  await window.loadURL("data:text/html,<html><head></head><body><aside><nav>Projects</nav><footer>Settings</footer></aside></body></html>");
  const updateUi = await fs.readFile(path.join(__dirname, "../src/update-ui.js"), "utf8");
  await window.webContents.executeJavaScript(`
    window.desktopUpdates = {
      onStatus: () => {},
      command: async () => ({ phase: "available", version: "0.0.5", currentVersion: "0.0.4" }),
    };
    ${updateUi}
  `);
  assert.deepEqual(await window.webContents.executeJavaScript(`(() => {
    const card = document.getElementById("plasmic-desktop-update");
    return { parent: card.parentElement.tagName, floating: card.dataset.floating, collapsed: card.dataset.collapsed, button: card.querySelector(".update-action").textContent };
  })()`), { parent: "FOOTER", floating: "false", collapsed: "false", button: "下载更新" });
  await window.webContents.executeJavaScript(`document.querySelector("aside").remove()`);
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById("plasmic-desktop-update").dataset.floating`), "true");
  await window.webContents.executeJavaScript(`document.body.insertAdjacentHTML("beforeend", "<aside><nav>Projects</nav><footer>Settings</footer></aside>")`);
  assert.equal(await window.webContents.executeJavaScript(`document.getElementById("plasmic-desktop-update").parentElement.tagName`), "FOOTER");
  console.log("PASS: Update prompt mounts in the rendered sidebar footer and follows page navigation");
  root = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-update-native-"));
  const cache = path.join(root, "updates");
  const source = path.join(root, "source");
  const resources = path.join(cache, "extract-fixture/Plasmic.app/Contents/Resources");
  await fs.mkdir(resources, { recursive: true });
  await fs.mkdir(source);
  await fs.writeFile(path.join(source, "index.js"), "module.exports = true;");
  await createPackage(source, path.join(resources, "app.asar"));
  // Patched fs exposes the archive as a directory; original-fs sees the file.
  assert.equal((await require("node:fs/promises").stat(path.join(resources, "app.asar"))).isDirectory(), true);
  assert.equal((await fs.stat(path.join(resources, "app.asar"))).isFile(), true);
  const helper = path.join(cache, "copied-helper.js");
  await require("node:fs/promises").copyFile(path.join(resources, "app.asar/index.js"), helper);
  assert.equal(await fs.readFile(helper, "utf8"), "module.exports = true;");
  const id = "eb954cc1-07c2-4b0b-85a0-5d00eedf12ae";
  const target = path.join(root, "Plasmic.app");
  await fs.writeFile(path.join(cache, "mac-transaction.json"), JSON.stringify({ id, target, version: "0.0.4" }));
  await fs.writeFile(path.join(cache, "Plasmic-0.0.4.zip"), "cached");
  await acknowledgeMacUpdate({ getPath: () => root, getVersion: () => "0.0.4", getAppPath: () => path.join(target, "Contents/Resources/app.asar") });
  await assert.rejects(fs.stat(path.join(cache, "extract-fixture")), { code: "ENOENT" });
  await assert.rejects(fs.stat(path.join(cache, "Plasmic-0.0.4.zip")), { code: "ENOENT" });
  assert.equal(await fs.readFile(path.join(cache, `${id}.ready`), "utf8"), "ready");
  console.log("PASS: Electron removes physical application bundles containing app.asar and acknowledges startup");
}).catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (root) await fs.rm(root, { recursive: true, force: true });
  app.exit(process.exitCode || 0);
});
