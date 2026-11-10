// Node driver and owned Electron fixture: production bootstrap and quit guards,
// isolated profile, deterministic renderer/network, no user App or NAS edits.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { setTimeout: delay } = require("node:timers/promises");

if (!process.versions.electron) {
  const { spawnSync } = require("node:child_process");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "plasmic-desktop-lifecycle-"));
  try {
    // Every following process reuses the failed process's profile/lock path.
    for (const stage of ["startup-failed", "error-dialog-failed", "startup-load-failed", "normal-quit", "island", "queued-quit", "cancel-quit"]) {
      fs.writeFileSync(path.join(profile, "presentation.json"), JSON.stringify({ mode: "window", closeAction: "island" }));
      const result = spawnSync(require("electron"), [__filename, stage], {
        env: { ...process.env, PLASMIC_DESKTOP_PROFILE: profile }, encoding: "utf8", timeout: 25000,
      });
      const fatal = stage.endsWith("failed");
      assert.equal(result.status, fatal ? 1 : 0, `${stage}: ${result.error || result.stderr}`);
      const rows = fs.readFileSync(path.join(profile, "logs/lifecycle.log"), "utf8").trim().split("\n").map(JSON.parse);
      const start = rows.findLast(row => row.event === "process.start");
      const events = rows.filter(row => row.pid === start.pid);
      assert.ok(events.some(row => row.event === "instance.lock-acquired"), stage);
      if (fatal) {
        const failure = events.find(row => row.event === "startup.failed");
        if (stage === "startup-load-failed") assert.equal(failure.error.code, "ERR_FAILED");
        else assert.equal(failure.error.message, "Injected locale read failure");
        assert.equal(events.some(row => row.event === "startup.ready"), false);
        assert.ok(events.some(row => row.event === "process.exit-requested" && row.code === 1));
        if (stage === "error-dialog-failed") assert.ok(events.some(row => row.event === "startup.error-dialog-failed"));
      } else {
        assert.ok(events.some(row => row.event === "startup.ready"), stage);
        assert.ok(events.some(row => row.event === "quit.completed"), stage);
        if (stage === "queued-quit") {
          assert.ok(events.some(row => row.event === "quit.deferred"));
          assert.equal(JSON.parse(fs.readFileSync(path.join(profile, "presentation.json"))).mode, "island", "Pending quit preserves the completed close action and last display mode");
        }
        if (stage === "cancel-quit") assert.ok(events.some(row => row.event === "quit.cancelled"));
        if (stage === "island") {
          assert.equal(JSON.parse(fs.readFileSync(path.join(profile, "presentation.json"))).mode, "island");
          assert.ok(events.some(row => row.event === "window.closed-to-island"));
        }
      }
      assert.equal(events.some(row => row.event === "process.uncaught-exception"), false, stage);
      console.log("Desktop lifecycle passed:", stage);
    }
  } finally { fs.rmSync(profile, { recursive: true, force: true }); }
} else {
  const { app, BrowserWindow, dialog, session, Menu } = require("electron");
  const Module = require("node:module");
  const { studioContents } = require("./fixtures/native-studio.cjs");
  const profile = process.env.PLASMIC_DESKTOP_PROFILE;
  const stage = process.argv[2];
  let presentation, ready = false, passed = false, draftPrompt;
  const originalLoad = Module._load;
  Module._load = function(request, parent, isMain) {
    const value = originalLoad.call(this, request, parent, isMain);
    if (!parent?.filename.endsWith("/src/main.cjs")) return value;
    if (request === "../desktop.config.json") {
      const assets = JSON.parse(fs.readFileSync(path.join(__dirname, "../renderer/desktop-assets.json")));
      return { ...value, webImage: assets.webImage };
    }
    if (request === "./i18n.cjs" && ["startup-failed", "error-dialog-failed"].includes(stage)) {
      return { createDesktopI18n() { throw new Error("Injected locale read failure"); } };
    }
    if (request === "./asset-handler.cjs") return { createAssetHandler: () => async () => stage === "startup-load-failed" ? Response.error() : new Response(`<html><body>Lifecycle fixture<script>
      addEventListener('message',event=>{
        if(event.source!==window || event.origin!==location.origin || event.data?.channel!=='plasmic-desktop-request')return;
        postMessage({channel:'plasmic-desktop-response',id:event.data.id,result:{ready:false,tools:{},availableEditorTools:[]}},location.origin);
      });
    </script></body></html>`, { headers: { "Content-Type": "text/html" } }) };
    if (request === "./island.cjs") return { ...value, createIsland(...args) {
      presentation = value.createIsland(...args);
      const setMode = presentation.setMode;
      presentation.setMode = async (...input) => { const result = await setMode(...input); ready = true; return result; };
      return presentation;
    } };
    return value;
  };
  const watchdog = setTimeout(() => { console.error("Lifecycle timed out:", stage); app.exit(2); }, 20000);
  process.on("unhandledRejection", error => { console.error(error); app.exit(2); });
  dialog.showErrorBox = (title, detail) => {
    assert.ok(stage.endsWith("failed"), `${title}: ${detail}`);
    assert.ok(title && detail);
    if (stage === "error-dialog-failed") throw new Error("Injected error dialog failure");
  };
  dialog.showMessageBox = async () => new Promise(resolve => { draftPrompt = resolve; });
  app.on("will-quit", () => {
    assert.equal(passed, true, "Unexpected exit: " + stage);
    clearTimeout(watchdog);
  });
  async function until(check, label) {
    const end = Date.now() + 10000;
    while (Date.now() < end) { if (await check()) return; await delay(20); }
    throw new Error("Timed out: " + label);
  }
  app.whenReady().then(async () => {
    session.fromPartition("persist:plasmic-desktop").fetch = async () => Response.json({ authenticated: true });
    if (stage.endsWith("failed")) return; // Production must exit(1), even when the dialog throws.
    await until(() => ready, "startup completes");
    const main = BrowserWindow.getAllWindows().find(win => win.isVisible());
    assert.ok(main);
    if (stage === "island") {
      main.close();
      await until(() => !main.isVisible(), "close enters island");
      app.emit("activate");
      app.emit("second-instance", {}, ["Plasmic"]);
      await delay(200);
      assert.equal(main.isVisible(), false, "Activation preserves island mode");
      assert.equal(presentation.mode, "island");
    } else if (stage === "queued-quit") {
      let release, entered;
      const pending = new Promise(resolve => { release = resolve; });
      const started = new Promise(resolve => { entered = resolve; });
      presentation.closingAction = async () => { entered(); return pending; };
      main.close();
      await started;
      app.quit();
      release("island");
      passed = true;
      return; // The queued request must exit without another command.
    } else if (stage === "cancel-quit") {
      await studioContents(main).executeJavaScript("history.replaceState({}, '', '/projects/lifecycle-fixture')");
      Menu.getApplicationMenu().getMenuItemById("close-action-quit").click();
      main.close();
      await until(() => draftPrompt, "draft confirmation");
      // Repeated explicit quit must survive a window-close request, while a
      // subsequent Cancel in draft protection still cancels the whole exit.
      app.quit();
      const cancel = draftPrompt;
      draftPrompt = undefined;
      cancel({ response: 0 });
      await delay(250);
      assert.equal(main.isDestroyed(), false);
      assert.equal(draftPrompt, undefined, "Cancel must not trigger a second confirmation");
      app.quit();
      await until(() => draftPrompt, "retry draft confirmation");
      passed = true;
      draftPrompt({ response: 1 });
      return;
    }
    passed = true;
    app.quit();
  }).catch(error => { console.error(error); app.exit(2); });
  require("../src/main.cjs").bootstrap();
  Module._load = originalLoad;
}
