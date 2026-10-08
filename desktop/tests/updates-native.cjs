// Native sidebar/rail update UI and Electron's ASAR bundle cleanup.
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
  const updateUi = await fs.readFile(path.join(__dirname, "../src/update-ui.js"), "utf8");
  const studioOrigin = "https://studio.update.test";
  const canvasOrigin = "https://canvas.update.test";
  window.webContents.session.protocol.handle("https", (request) => {
    const url = new URL(request.url);
    if (url.pathname === "/update-ui.js") return new Response(updateUi, { headers: { "Content-Type": "application/javascript; charset=utf-8" } });
    const isStudio = url.origin === studioOrigin;
    const content = isStudio
      ? (url.pathname === "/delayed" ? "" : `<aside style="width:220px"><nav>Projects</nav><footer>Settings</footer></aside><main>Workspace</main>`)
      : `<script>
          setTimeout(() => {
          const frame = document.createElement("iframe");
          frame.className = "__wab_studio-frame";
          frame.style = "border:0;width:100vw;height:100vh";
          frame.addEventListener("load", () => {
            const inner = frame.contentDocument;
            inner.open();
            inner.write('<html><head></head><body style="margin:0"><div id="left-tab-strip" style="display:flex;flex-direction:column;width:36px;height:calc(100vh - 16px);padding:8px;overflow:auto;justify-content:space-between"><div>Tools</div><div style="display:flex;flex-direction:column;align-items:center"><div class="Avatar" style="height:32px;width:32px;background:#e4e4e7;border-radius:50%">YL</div></div></div></body></html>');
            inner.close();
          });
          document.body.append(frame);
          }, 50);
        </script>`;
    return new Response(`<html><head><style>body{margin:0;font:14px sans-serif}aside{height:100vh;display:flex;flex-direction:column}footer{margin-top:auto;padding:8px}</style></head><body>${content}
      ${isStudio ? `<script>
        window.commands = [];
        window.fixtureStatus = { phase: "downloaded", version: "0.0.7", currentVersion: "0.0.6" };
        window.desktopUpdates = {
          onStatus: callback => { window.updateStatus = callback; },
          command: async command => { window.commands.push(command); return window.fixtureStatus; },
        };
      </script>` : ""}
      <script defer src="${studioOrigin}/update-ui.js" data-studio-origin="${studioOrigin}" data-canvas-origin="${canvasOrigin}"></script>
      </body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  });
  const evaluate = (code) => window.webContents.executeJavaScript(code);
  await window.loadURL(studioOrigin + "/delayed");
  assert.equal(await evaluate(`typeof window.updateStatus`), "function", "Update listeners must initialize before the sidebar mounts");
  await evaluate(`document.body.insertAdjacentHTML("beforeend", '<aside><footer>Settings</footer></aside>')`);
  assert.equal(await evaluate(`document.querySelector(".update-action")?.getAttribute("aria-label")`), "Update 0.0.7 is ready. Restart Plasmic to install.");
  await window.loadURL(studioOrigin);
  assert.deepEqual(await evaluate(`(() => {
    const control = document.getElementById("plasmic-desktop-update");
    const button = control.querySelector("button");
    return { parent: control.parentElement.tagName, placement: control.dataset.placement, position: getComputedStyle(control).position, icon: !!button.querySelector("svg"), width: button.getBoundingClientRect().width, label: button.getAttribute("aria-label"), visible: !control.hidden };
  })()`), { parent: "FOOTER", placement: "footer", position: "relative", icon: true, width: 20, label: "Update 0.0.7 is ready. Restart Plasmic to install.", visible: true });
  window.show();
  window.webContents.focus();
  await evaluate(`document.querySelector(".update-action").focus(); new Promise(resolve => setTimeout(resolve, 300))`);
  assert(await evaluate(`document.querySelector(".update-action").getBoundingClientRect().width > 20`), "Keyboard focus must expand the footer icon label");
  assert.equal(await evaluate(`document.querySelector(".update-tooltip").matches(":popover-open")`), true);
  await evaluate(`document.querySelector(".update-action").blur()`);
  window.hide();
  await evaluate(`document.querySelector(".update-action").click()`);
  assert.equal(await evaluate(`window.commands.at(-1)`), "open");
  await evaluate(`window.fixtureStatus = { phase: "downloading", version: "0.0.7", percent: 42 }; window.updateStatus(window.fixtureStatus)`);
  assert.deepEqual(await evaluate(`(() => {
    const control = document.getElementById("plasmic-desktop-update");
    return { role: control.getAttribute("role"), percent: control.getAttribute("aria-valuenow"), disabled: control.querySelector("button").disabled, label: control.querySelector(".update-label").textContent };
  })()`), { role: "progressbar", percent: "42", disabled: true, label: "42%" });
  await evaluate(`window.fixtureStatus = { phase: "downloaded", version: "0.0.7" }; window.updateStatus(window.fixtureStatus); document.querySelector(".update-action").click()`);
  assert.equal(await evaluate(`window.commands.at(-1)`), "open");
  await evaluate(`window.fixtureStatus = { phase: "error", error: "下载失败", retry: "download" }; window.updateStatus(window.fixtureStatus); document.querySelector(".update-action").click()`);
  assert.equal(await evaluate(`window.commands.at(-1)`), "open");
  for (const phase of ["idle", "current", "checking", "disabled"]) {
    await evaluate(`window.updateStatus({ phase: ${JSON.stringify(phase)} })`);
    assert.equal(await evaluate(`document.getElementById("plasmic-desktop-update").hidden`), true);
  }
  await evaluate(`document.querySelector("aside").remove()`);
  assert.equal(await evaluate(`document.getElementById("plasmic-desktop-update")`), null);
  await evaluate(`window.fixtureStatus = { phase: "downloaded", version: "0.0.7" }; window.updateStatus(window.fixtureStatus); document.body.insertAdjacentHTML("beforeend", '<aside><footer>Settings</footer></aside>')`);
  assert.equal(await evaluate(`document.getElementById("plasmic-desktop-update").parentElement.tagName`), "FOOTER");
  console.log("PASS: Sidebar shows download progress, then opens the ready/retry window instead of restarting directly");

  await evaluate(`document.querySelector("aside").remove(); const frame = document.createElement("iframe"); frame.className = "studio-frame"; frame.src = ${JSON.stringify(canvasOrigin + "/static/host.html")}; frame.style = "border:0;width:100vw;height:100vh"; document.body.append(frame)`);
  let editor;
  for (let i = 0; i < 100; i++) {
    const host = window.webContents.mainFrame.frames.find((frame) => frame.url.startsWith(canvasOrigin));
    editor = host?.frames.find((frame) => frame.url === "about:blank");
    if (editor && await editor.executeJavaScript(`document.querySelector("#plasmic-desktop-update")?.dataset.phase === "downloaded"`)) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert(editor, "Bundled editor frame did not load");
  assert.deepEqual(await editor.executeJavaScript(`(() => {
    const control = document.getElementById("plasmic-desktop-update");
    const button = control.querySelector("button");
    return { placement: control.dataset.placement, inStrip: !!control.closest("#left-tab-strip"), width: button.getBoundingClientRect().width, iconWidth: button.querySelector("svg").getBoundingClientRect().width, position: getComputedStyle(control).position, beforeAvatar: control.nextElementSibling.className };
  })()`), { placement: "rail", inStrip: true, width: 20, iconWidth: 12, position: "relative", beforeAvatar: "Avatar" });
  await fs.writeFile(path.join(os.tmpdir(), "plasmic-update-rail.png"), (await window.webContents.capturePage()).toPNG());
  assert.equal(await editor.executeJavaScript(`document.querySelector(".update-action svg").dataset.icon`), "restart");
  window.show();
  window.webContents.focus();
  await editor.executeJavaScript(`document.querySelector(".update-action").focus(); new Promise(resolve => setTimeout(resolve, 300))`);
  assert.equal(await editor.executeJavaScript(`document.querySelector(".update-action").matches(":popover-open")`), true, "The expanded rail button must escape toolbar overflow");
  assert(await editor.executeJavaScript(`document.querySelector(".update-action").getBoundingClientRect().width > 20`));
  await editor.executeJavaScript(`document.querySelector(".update-action").blur()`);
  assert.equal(await editor.executeJavaScript(`document.querySelector(".update-action").hasAttribute("popover")`), false);
  window.hide();
  await editor.executeJavaScript(`document.querySelector(".update-action").click()`);
  assert.equal(await evaluate(`window.commands.at(-1)`), "open");
  await evaluate(`window.fixtureStatus = { phase: "downloading", version: "0.0.7", percent: 67 }; window.updateStatus(window.fixtureStatus)`);
  assert.equal(await editor.executeJavaScript(`document.querySelector("#plasmic-desktop-update").getAttribute("aria-valuenow")`), "67");
  const commandCount = await evaluate(`window.commands.length`);
  await editor.executeJavaScript(`window.parent.postMessage({channel:"plasmic-desktop-update-command",command:"install"},${JSON.stringify(studioOrigin)})`);
  assert.equal(await evaluate(`window.commands.length`), commandCount, "The sidebar bridge must not directly install");
  await evaluate(`window.postMessage({channel:"plasmic-desktop-update-command",command:"install"},location.origin)`);
  assert.equal(await evaluate(`window.commands.length`), commandCount, "Untrusted sender must not invoke updates");
  await editor.executeJavaScript(`window.postMessage({channel:"plasmic-desktop-update-status",status:{phase:"error"}},"*")`);
  assert.equal(await editor.executeJavaScript(`document.querySelector("#plasmic-desktop-update").dataset.phase`), "downloading", "Untrusted sender must not overwrite status");
  await editor.executeJavaScript(`document.querySelector("#left-tab-strip").remove()`);
  assert.equal(await editor.executeJavaScript(`document.querySelector("#plasmic-desktop-update")`), null);
  console.log("PASS: Bundled editor embeds the compact expanding update button and validates cross-frame messages");
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
