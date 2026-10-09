const { app, session } = require("electron");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const assert = require("node:assert/strict");
const config = require("../desktop.config.json");
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "plasmic-workspace-startup-"));
app.setPath("userData", profile);
// Match the macOS app lifecycle while reopening a window through startDesktop.
app.on("window-all-closed", () => {});
const projectUrl = config.studioOrigin + "/projects/unavailable?branch=main#page";
fs.writeFileSync(path.join(profile, "workspace.json"), JSON.stringify([
  { url: projectUrl, name: "Unavailable startup project" },
]));
const forbidden = process.argv.includes("--forbidden");
let projectChecks = 0;
const documentPaths = [];
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "./asset-handler.cjs" && parent.filename.endsWith("/src/main.cjs")) {
    return { createAssetHandler: () => async (request) => {
      documentPaths.push(new URL(request.url).pathname);
      return new Response("<html><body>Startup dashboard fixture</body></html>", {
        headers: { "Content-Type": "text/html" },
      });
    } };
  }
  return originalLoad.call(this, request, parent, isMain);
};
const { startDesktop } = require("../src/main.cjs");
Module._load = originalLoad;
const timeout = setTimeout(() => {
  console.error("Unavailable-project startup timed out");
  app.exit(1);
}, 30000);
app.whenReady().then(async () => {
  const ses = session.fromPartition("persist:plasmic-desktop");
  ses.fetch = async (request) => {
    const url = new URL(typeof request === "string" ? request : request.url);
    if (url.pathname === "/api/auth/session") return Response.json({ authenticated: true });
    assert.equal(url.pathname, "/api/v1/projects");
    assert.equal(JSON.parse(url.searchParams.get("query")), "byIds");
    assert.deepEqual(JSON.parse(url.searchParams.get("projectIds")), ["unavailable"]);
    projectChecks++;
    return Response.json({ projects: [] }, { status: forbidden ? 403 : 200 });
  };
  let win = await startDesktop();
  assert.equal(win.webContents.getURL(), config.studioOrigin + "/");
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(profile, "workspace.json"), "utf8")), []);
  win.destroy();
  win = await startDesktop();
  assert.equal(win.webContents.getURL(), config.studioOrigin + "/");
  assert.equal(projectChecks, 1, "Reopening must not retry the invalid project");
  assert.deepEqual(documentPaths, ["/", "/"], "The failed project document must never load or display its error toast");
  win.destroy();
  clearTimeout(timeout);
  console.log(`Native ${forbidden ? "inaccessible" : "deleted"} project startup opens home, removes the saved route and keeps subsequent launches clean`);
  app.exit(0);
}).catch((error) => {
  console.error({ documentPaths, projectChecks });
  console.error(error);
  app.exit(1);
});
