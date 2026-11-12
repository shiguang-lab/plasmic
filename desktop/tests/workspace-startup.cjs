const { studioContents } = require("./fixtures/native-studio.cjs");
const { app, session } = require("electron");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const assert = require("node:assert/strict");
const { setTimeout: delay } = require("node:timers/promises");
const config = require("../desktop.config.json");
const profile = fs.mkdtempSync(
  path.join(os.tmpdir(), "plasmic-workspace-startup-"),
);
app.setPath("userData", profile);
// Match the macOS app lifecycle while reopening a window through startDesktop.
app.on("window-all-closed", () => {});
const projectUrl =
  config.studioOrigin + "/projects/unavailable?branch=main#page";
fs.writeFileSync(
  path.join(profile, "workspace.json"),
  JSON.stringify([{ url: projectUrl, name: "Unavailable startup project" }]),
);
fs.writeFileSync(
  path.join(profile, "workspace-route.json"),
  JSON.stringify(projectUrl),
);
const forbidden = process.argv.includes("--forbidden");
const authorized = process.argv.includes("--authorized");
const measure = process.argv.includes("--measure");
const shell = Promise.withResolvers();
let projectChecks = 0;
const documentPaths = [];
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (
    request === "./asset-handler.cjs" &&
    parent.filename.endsWith("/src/main.cjs")
  ) {
    return {
      createAssetHandler: () => async (assetRequest) => {
        documentPaths.push(new URL(assetRequest.url).pathname);
        if (assetRequest.url === projectUrl || new URL(assetRequest.url).pathname === "/projects/unavailable") {
          shell.resolve(performance.now());
          return new Response(`<html><body><script>
            window.startup = desktopEnvironment.consumeStartupData("unavailable", "main").then(opening => {
              if (!opening) fetch("/unexpected-startup-request");
              return opening?.project?.id;
            });
          </script></body></html>`, { headers: { "Content-Type": "text/html" } });
        }
        return new Response(
          "<html><body>Startup dashboard fixture</body></html>",
          {
            headers: { "Content-Type": "text/html" },
          },
        );
      },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};
const { startDesktop } = require("../src/main.cjs");
Module._load = originalLoad;
const timeout = setTimeout(() => {
  console.error("Unavailable-project startup timed out");
  app.exit(1);
}, 30000);
app
  .whenReady()
  .then(async () => {
    const ses = session.fromPartition("persist:plasmic-desktop");
    let checkFinished;
    ses.fetch = async (request) => {
      const url = new URL(typeof request === "string" ? request : request.url);
      if (url.pathname === "/api/auth/session") {
        return Response.json({ authenticated: true });
      }
      assert.equal(url.pathname, "/api/v1/projects/unavailable");
      assert.equal(JSON.parse(url.searchParams.get("branchName")), "main");
      projectChecks++;
      await delay(400);
      checkFinished = performance.now();
      if (authorized) {
        return Response.json({ project: { id: "unavailable" }, startup: { projectId: "unavailable", branchName: "main" } });
      }
      return Response.json({ projectData: { projects: [], perms: [] } }, { status: forbidden ? 403 : 404 });
    };
    const started = performance.now();
    let win = await startDesktop();
    const shellStarted = await shell.promise;
    if (!measure) assert.ok(shellStarted < checkFinished, "The project document must start before the access check finishes");
    if (authorized) {
      assert.equal(studioContents(win).getURL(), projectUrl);
      assert.equal(await studioContents(win).executeJavaScript("window.startup"), "unavailable");
      assert.equal(projectChecks, 1);
      console.log(JSON.stringify({
        documentRequestMs: Math.round(shellStarted - started),
        accessCheckMs: Math.round(checkFinished - started),
        modelReadbackMs: Math.round(performance.now() - started),
        projectChecks,
      }));
      win.destroy();
      clearTimeout(timeout);
      app.exit(0);
      return;
    }
    assert.equal(studioContents(win).getURL(), config.studioOrigin + "/");
    const records = fs.readFileSync(path.join(profile, "logs", "project-open.log"), "utf8").trim().split("\n").map(JSON.parse);
    const preflight = records.find(record => record.event === "project-open.preflight");
    assert.equal(preflight.event, "project-open.preflight");
    assert.equal(preflight.projectId, "unavailable");
    assert.equal(preflight.projectStatus, forbidden ? 403 : 404);
    assert.equal(preflight.outcome, "denied");
    assert.deepEqual(
      JSON.parse(fs.readFileSync(path.join(profile, "workspace.json"), "utf8")),
      [],
    );
    win.destroy();
    win = await startDesktop();
    assert.equal(studioContents(win).getURL(), config.studioOrigin + "/");
    assert.equal(
      projectChecks,
      1,
      "Reopening must not retry the invalid project",
    );
    assert.deepEqual(
      documentPaths,
      ["/projects/unavailable", "/", "/"],
      "The speculative document must never make a second project request",
    );
    if (process.platform === "darwin") {
      await studioContents(win).loadURL(config.studioOrigin + "/projects/header-fixture");
      await new Promise(setImmediate);
      assert.deepEqual(win.getWindowButtonPosition(), { x: 24, y: 22 });
      const resized = new Promise((resolve) => win.once("resize", resolve));
      const [width, height] = win.getContentSize();
      win.setContentSize(width + 40, height);
      await resized;
      await new Promise(setImmediate);
      assert.deepEqual(win.getWindowButtonPosition(), { x: 24, y: 22 });
      await studioContents(win).loadURL(config.studioOrigin + "/");
      await new Promise(setImmediate);
      assert.deepEqual(win.getWindowButtonPosition(), { x: 24, y: 22 });
      console.log("Native window buttons stay aligned across application pages and resize");
    }
    win.destroy();
    clearTimeout(timeout);
    console.log(
      `Native ${forbidden ? "inaccessible" : "deleted"} project startup opens home, removes the saved route and keeps subsequent launches clean`,
    );
    app.exit(0);
  })
  .catch((error) => {
    console.error({ documentPaths, projectChecks });
    console.error(error);
    app.exit(1);
  });
