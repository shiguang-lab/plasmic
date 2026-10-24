// Run with Node; launches isolated real Electron app instances across restarts.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");

if (!process.versions.electron) {
  const { spawnSync } = require("node:child_process");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "plasmic-close-mode-"));
  try {
    for (const stage of ["choose", "reopen", "exit", "quit"]) {
      const result = spawnSync(require("electron"), [__filename, stage], {
        env: { ...process.env, PLASMIC_DESKTOP_PROFILE: profile }, encoding: "utf8", timeout: 45000,
      });
      process.stdout.write(result.stdout || "");
      process.stderr.write(result.stderr || "");
      assert.equal(result.status, 0, result.error?.message || `Close-mode ${stage} failed`);
      assert.equal(JSON.parse(fs.readFileSync(path.join(profile, `passed-${stage}.json`))).passed, true);
    }
    console.log("Close-mode native acceptance passed: cancel, remember/unremember, repeat close, cold start, temporary show, Dock/relaunch, explicit exit, preference changes and context-menu Quit.");
  } finally { fs.rmSync(profile, { recursive: true, force: true }); }
} else {
  const { app, BrowserWindow, dialog, Menu, session } = require("electron");
  const Module = require("node:module");
  const config = require("../desktop.config.json");
  const profile = process.env.PLASMIC_DESKTOP_PROFILE;
  const stage = process.argv[2];
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  let main, shown = 0, prompt, prompts = 0, completed = false;
  const timeout = setTimeout(() => { console.error("Close-mode stage timed out:", stage); app.exit(1); }, 35000);
  const preference = () => JSON.parse(fs.readFileSync(path.join(profile, "presentation.json")));
  async function until(check, label) {
    const end = Date.now() + 10000;
    while (Date.now() < end) { if (await check()) return; await pause(30); }
    throw new Error("Timed out: " + label);
  }
  function pass() { completed = true; }
  app.on("will-quit", () => {
    assert.equal(completed, true, `Unexpected quit during ${stage}`);
    clearTimeout(timeout);
    fs.writeFileSync(path.join(profile, `passed-${stage}.json`), JSON.stringify({ passed: true, prompts, shown, preference: preference() }));
    console.log("Close-mode stage passed:", stage, { prompts, shown });
  });
  dialog.showErrorBox = (title, detail) => { console.error(title, detail); app.exit(1); };
  dialog.showMessageBox = async (parent, options) => {
    assert.equal(parent, main);
    assert.equal(stage, "choose", "Remembered choices must not prompt again");
    assert.equal(options.buttons.length, 3);
    assert.equal(options.defaultId, 0); assert.equal(options.cancelId, 2);
    assert.equal(options.checkboxChecked, true);
    prompts++;
    return new Promise((resolve) => { prompt = resolve; });
  };
  app.on("browser-window-created", (_event, win) => {
    if (!main) { main = win; main.on("show", () => { shown++; }); }
  });
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === "./asset-handler.cjs" && parent.filename.endsWith("/src/main.cjs")) {
      return { createAssetHandler: () => async () => new Response(`<html><body>Close-mode fixture<script>
        addEventListener('message',event=>{
          if(event.source!==window || event.origin!==location.origin || event.data?.channel!=='plasmic-desktop-request')return;
          postMessage({channel:'plasmic-desktop-response',id:event.data.id,result:{ready:false,tools:{},availableEditorTools:[]}},location.origin);
        });
      </script></body></html>`, { headers: { "Content-Type": "text/html" } }) };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  const { bootstrap } = require("../src/main.cjs");
  Module._load = originalLoad;
  app.whenReady().then(async () => {
    const ses = session.fromPartition("persist:plasmic-desktop");
    ses.fetch = async () => Response.json({ authenticated: true });
    await until(() => main && !main.webContents.isLoadingMainFrame() && fs.existsSync(path.join(profile, "presentation.json")), "main app startup");
    await until(() => Menu.getApplicationMenu()?.getMenuItemById("close-action-ask"), "native menu ready");
    const island = () => BrowserWindow.getAllWindows().find((win) => win !== main && win.webContents.getURL().endsWith("/island.html"));
    function islandMenu() {
      const originalPopup = Menu.prototype.popup;
      let menu;
      Menu.prototype.popup = function() { menu=this; };
      return island().webContents.executeJavaScript("desktopIsland.command('menu')").then(() => menu).finally(() => { Menu.prototype.popup=originalPopup; });
    }
    async function returnMain() {
      Menu.getApplicationMenu().getMenuItemById("presentation-window").click();
      await until(() => main.isVisible(), "return main");
      await pause(60);
    }
    async function waitIsland() { await until(() => !main.isVisible() && island()?.isVisible(), "island shown"); await pause(60); }
    async function choose(response, checkboxChecked) {
      const expected = prompts + 1;
      main.close();
      await until(() => prompts === expected, "close dialog");
      main.close(); await pause(60);
      assert.equal(prompts, expected, "repeated close deduplicates the dialog");
      prompt({ response, checkboxChecked });
      await pause(80);
    }
    if (stage === "choose") {
      assert.equal(main.isVisible(), true);
      assert.equal(await main.webContents.executeJavaScript("typeof desktopPresentation"), "undefined");
      await choose(2, true);
      assert.equal(main.isVisible(), true); assert.equal(preference().closeAction, "ask");
      await choose(0, false); await waitIsland();
      assert.equal(preference().closeAction, "ask");
      assert.equal(main.isDestroyed(), false, "entering island keeps the editor alive");
      await returnMain();
      await choose(0, true); await waitIsland();
      assert.equal(preference().closeAction, "island");
      await returnMain();
      main.close(); await waitIsland();
      assert.equal(prompts, 3, "remembered island closes without prompting");
      await returnMain();
      assert.equal(preference().mode, "window");
      assert.equal(preference().closeAction, "island", "temporary editing does not change the startup preference");
      pass(); app.quit();
    } else if (stage === "reopen") {
      await waitIsland();
      assert.equal(shown, 0, "cold island start never shows the main window");
      app.emit("activate"); await pause(150);
      assert.equal(main.isVisible(), false);
      app.emit("second-instance", {}, ["Plasmic"]); await pause(150);
      assert.equal(main.isVisible(), false); assert.equal(shown, 0);
      const { requestRpc } = require("../src/local-rpc.cjs");
      const state = await requestRpc(profile, "get_app_state", {});
      assert.equal(state.windowOpen, true, "MCP keeps its editor window while hidden");
      assert.equal(Menu.getApplicationMenu().getMenuItemById("close-action-island").checked, true);
      const menu=await islandMenu();
      menu.getMenuItemById("island-show-main").click();
      await until(()=>main.isVisible() && island().isVisible(),"show main keeps island enabled");
      assert.equal(preference().mode,"island");assert.equal(preference().closeAction,"island");
      app.emit("activate");await pause(150);
      assert.equal(main.isVisible(),true,"Dock keeps an explicitly opened main window visible");
      app.emit("second-instance",{},["Plasmic"]);await pause(150);
      assert.equal(main.isVisible(),true,"reopening keeps an explicitly opened main window visible");
      main.close();await waitIsland();assert.equal(prompts,0,"temporary main closes back to island without a dialog");
      pass();menu.getMenuItemById("island-quit").click();
    } else if(stage === "exit") {
      await waitIsland();
      const menu=await islandMenu();
      menu.getMenuItemById("island-exit").click();
      await until(()=>main.isVisible() && !island().isVisible(),"exit restores standard window");
      await until(()=>preference().mode === "window" && preference().closeAction === "ask","exit clears remembered island mode");
      pass();app.quit();
    } else {
      assert.equal(stage, "quit");
      await until(() => main.isVisible(), "standard startup after explicitly exiting island mode");
      assert.equal(preference().closeAction, "ask", "explicit island exit persists across cold startup");
      Menu.getApplicationMenu().getMenuItemById("close-action-ask").click();
      assert.equal(preference().closeAction, "ask");
      Menu.getApplicationMenu().getMenuItemById("close-action-quit").click();
      pass(); main.close();
    }
  }).catch((error) => { console.error(error.stack); app.exit(1); });
  bootstrap();
}
