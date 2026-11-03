const { studioContents } = require("./fixtures/native-studio.cjs");
const { app, dialog } = require("electron");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const config = require("../desktop.config.json");
// Keep production main/window recovery, but serve a deterministic local page.
// Recovery must never depend on a live NAS session or authentication redirects.
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "./asset-handler.cjs" && parent.filename.endsWith("/src/main.cjs")) {
    return {
      createAssetHandler: () => async (request) => {
        assert.equal(new URL(request.url).origin, config.studioOrigin);
        return new Response("<html><body>Window recovery fixture</body></html>", {
          headers: { "Content-Type": "text/html" },
        });
      },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};
const { startDesktop } = require("../src/main.cjs");
Module._load = originalLoad;
const directory = process.env.PLASMIC_RECOVERY_REPORT;
assert(directory, "Use an isolated recovery report/profile directory");
fs.mkdirSync(directory, { recursive: true });
app.setPath("userData", path.join(directory, "profile"));
app.setPath("sessionData", path.join(directory, "profile"));
const prompts = [];
const errors = [];
let response = 0;
dialog.showMessageBox = async (_window, options) => {
  prompts.push({ message: options.message, buttons: options.buttons });
  return { response };
};
dialog.showErrorBox = (title, message) => errors.push({ title, message });
const timer = setTimeout(() => app.exit(1), 45000);
async function until(check, description) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail(`Window recovery timed out: ${description}`);
}
app.whenReady().then(async () => {
  const win = await startDesktop();
  await until(() => !studioContents(win).isLoading(), "initial page loaded");
  const before = studioContents(win).getURL();
  const registered = studioContents(win).listenerCount("render-process-gone");
  const gone = new Promise((resolve) => studioContents(win).once("render-process-gone", (_event, details) => resolve(details.reason)));
  studioContents(win).forcefullyCrashRenderer();
  const reason = await gone;
  await until(() => prompts.length === 1 && !studioContents(win).isCrashed() && !studioContents(win).isLoading(), "crashed renderer reloaded");
  const report = { reason, before, registered, prompts };
  assert.equal(prompts.length, 1);
  assert.equal(studioContents(win).getURL(), before);
  assert.equal(studioContents(win).isCrashed(), false);
  studioContents(win).emit("unresponsive");
  await until(() => prompts.length === 2, "unresponsive prompt");
  assert.equal(prompts.length, 2);
  response = 2; // Cancel the deliberately failed navigation in every UI language.
  await studioContents(win).session.protocol.unhandle("https");
  await studioContents(win).session.protocol.handle("https", () => Response.error());
  await assert.rejects(studioContents(win).loadURL(before), /ERR_FAILED/);
  await until(() => prompts.length === 3, "failed navigation prompt");
  assert.equal(prompts.length, 3);
  assert.deepEqual(errors, []);
  report.reloaded = true;
  report.simulatedEvents = ["unresponsive"];
  fs.writeFileSync(path.join(directory, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  clearTimeout(timer);
  app.exit(0);
}).catch((error) => { console.error(error.message); clearTimeout(timer); app.exit(1); });
