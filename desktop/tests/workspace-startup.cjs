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
const interactive = process.argv.includes("--open");
const published = process.argv.includes("--published");
const projectUrl = config.studioOrigin + "/projects/unavailable" +
  (published ? "?publishedTemplate=true" : "?branch=feature") + "#page";
fs.writeFileSync(
  path.join(profile, "workspace.json"),
  JSON.stringify([{ url: projectUrl, name: "Unavailable startup project" }]),
);
fs.writeFileSync(
  path.join(profile, "workspace-route.json"),
  JSON.stringify(interactive ? config.studioOrigin + (published ? "/template-center" : "/projects") : projectUrl),
);
const forbidden = process.argv.includes("--forbidden");
const authorized = process.argv.includes("--authorized");
const measure = process.argv.includes("--measure");
const shell = Promise.withResolvers();
const editorBridge = fs.readFileSync(path.join(__dirname, "../src/editor-bridge.js"), "utf8");
let projectChecks = 0;
let requestStarted;
const documentPaths = [];
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (
    request === "./asset-handler.cjs" &&
    parent.filename.endsWith("/src/main.cjs")
  ) {
    return {
      createAssetHandler: ({ remoteFetch }) => async (assetRequest) => {
        if (new URL(assetRequest.url).pathname.startsWith("/api/")) return remoteFetch(assetRequest);
        documentPaths.push(new URL(assetRequest.url).pathname);
        if (assetRequest.url === projectUrl || new URL(assetRequest.url).pathname === "/projects/unavailable") {
          shell.resolve(performance.now());
          return new Response(`<html><body><script>${editorBridge}</script><script>
            window.startup = desktopEnvironment.consumeStartupData("unavailable", ${published ? "undefined, true" : '"feature"'}).then(opening => {
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
    const firstCheck = Promise.withResolvers();
    const sessionFetch = ses.fetch.bind(ses);
    ses.fetch = async (request, options) => {
      if (!options?.bypassCustomProtocolHandlers) {
        requestStarted = performance.now();
        return sessionFetch(request, options);
      }
      const url = new URL(typeof request === "string" ? request : request.url);
      if (url.pathname === "/api/auth/session") {
        return Response.json({ authenticated: true });
      }
      if (url.pathname === "/api/v1/projects/header-fixture") {
        assert.deepEqual(Object.fromEntries(url.searchParams), { includeStartup: "true", branchName: '"main"' });
        return Response.json({ project: { id: "header-fixture" }, startup: { projectId: "header-fixture", branchName: "main" } });
      }
      assert.equal(url.pathname, published ? "/api/v1/template-center/unavailable/studio" : "/api/v1/projects/unavailable");
      assert.deepEqual(Object.fromEntries(url.searchParams), published ? {} : { includeStartup: "true", branchName: '"feature"' });
      requestStarted ??= performance.now();
      projectChecks++;
      if (!measure) await shell.promise;
      await delay(400);
      checkFinished = performance.now();
      firstCheck.resolve(checkFinished);
      if (authorized) {
        return Response.json(published
          ? { project: { id: "unavailable", publishedTemplateVersion: "1.0.0" } }
          : { project: { id: "unavailable" }, startup: { projectId: "unavailable", branchName: "feature" } });
      }
      return Response.json({ projectData: { projects: [], perms: [] } }, { status: forbidden ? 403 : 404 });
    };
    const started = performance.now();
    let win = await startDesktop();
    const dashboard = interactive ? studioContents(win) : undefined;
    if (dashboard) {
      await dashboard.executeJavaScript(`desktopNavigation.navigate(${JSON.stringify(projectUrl)})`);
      assert.notEqual(studioContents(win), dashboard);
    }
    const shellStarted = await shell.promise;
    if (!measure) assert.ok(shellStarted < await firstCheck.promise, "The project document must start before the access check finishes");
    if (authorized) {
      assert.equal(studioContents(win).getURL(), projectUrl);
      assert.equal(await studioContents(win).executeJavaScript("window.startup"), "unavailable");
      assert.equal(projectChecks, 1);
      assert.ok(requestStarted <= shellStarted, "Opening GET must begin by the time the editor document is requested");
      console.log(JSON.stringify({
        documentRequestMs: Math.round(shellStarted - started),
        accessCheckMs: Math.round(checkFinished - started),
        modelReadbackMs: Math.round(performance.now() - started),
        projectChecks,
      }));
      if (interactive) {
        const editor = studioContents(win);
        const reloaded = new Promise(resolve => editor.once("did-finish-load", resolve));
        editor.reload();
        await reloaded;
        assert.equal(await editor.executeJavaScript("window.startup"), "unavailable");
        assert.equal(projectChecks, 2, "Reload must initiate exactly one fresh opening GET");
      }
      const retired = studioContents(win);
      const closed = new Promise(resolve => retired.once("destroyed", resolve));
      const listUrl = dashboard?.getURL() ?? config.studioOrigin + "/projects";
      await retired.executeJavaScript(`void desktopNavigation.navigate(${JSON.stringify(listUrl)})`);
      await closed;
      assert.equal(studioContents(win).getURL(), listUrl);
      if (dashboard) assert.equal(studioContents(win), dashboard);
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
      assert.equal(await studioContents(win).executeJavaScript(
        'desktopEnvironment.consumeStartupData("header-fixture", "main").then(data => data?.project?.id)'
      ), "header-fixture");
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
