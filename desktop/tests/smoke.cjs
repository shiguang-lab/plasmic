const { app } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { startDesktop } = require("../src/main.cjs");
const config = require("../desktop.config.json");
const reportDir =
  process.env.PLASMIC_REPORT_DIR || path.resolve("desktop-report");
fs.mkdirSync(reportDir, { recursive: true });
app.setPath("userData", path.join(reportDir, "profile"));
const report = { status: "RUNNING", localResources: [], editorErrors: [] };
const timeout = setTimeout(() => {
  console.error("Desktop smoke timed out");
  app.exit(1);
}, 240000);
const env = Object.fromEntries(
  fs
    .readFileSync(process.env.PLASMIC_ENV_FILE || "/run/plasmic.env", "utf8")
    .split("\n")
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => [
      line.slice(0, line.indexOf("=")),
      line.slice(line.indexOf("=") + 1),
    ]),
);
async function until(win, expression) {
  for (let i = 0; i < 180; i++) {
    if (await win.webContents.executeJavaScript(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Studio did not become ready");
}
app
  .whenReady()
  .then(async () => {
    const win = await startDesktop();
    const ses = win.webContents.session;
    win.webContents.on("console-message", (details) => {
      if (
        /Uncaught|must have owner component|Unexpected error/.test(
          details.message || "",
        )
      ) {
        report.editorErrors.push(details.message);
      }
    });
    // Main-process fetch intentionally bypasses our local handler. Renderer login
    // below exercises forwarding, CSRF, request body and session cookie persistence.
    const source = await win.webContents.executeJavaScript(
      "document.documentElement.outerHTML",
    );
    assert(source.includes("<html"), "No local document");
    await until(win, "document.readyState === 'complete'");
    const login = await win.webContents.executeJavaScript(`(async () => {
    const csrf = (await (await fetch('/api/v1/auth/csrf')).json()).csrf;
    const response = await fetch('/api/v1/auth/login', {method:'POST',
      headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},
      body:JSON.stringify(${JSON.stringify({ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD })})});
    return {status:response.status, authenticated:(await response.json()).status};
  })()`);
    assert.equal(login.status, 200);
    assert(login.authenticated, "NAS login failed");
    report.nasLogin = true;
    const projectId = "qTizhC3kqg4Y2ovU7xiLhG",
      componentUuid = "-HvnDCEDMZha";
    await win.loadURL(config.studioOrigin + "/projects/" + projectId);
    await until(win, "!!window.PLASMIC_AI_TOOLS");
    async function call(name, input = {}) {
      const result = await win.webContents.executeJavaScript(
        `window.PLASMIC_AI_TOOLS[${JSON.stringify(name)}](${JSON.stringify(input)})`,
      );
      assert(result.success, result.error?.message || name + " failed");
      return result.output ? JSON.parse(result.output) : null;
    }
    await call("read", { componentUuids: [componentUuid] });
    await call("navigate", { componentUuid });
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const validation = await call("validate", {
      componentUuids: [componentUuid],
    });
    assert(validation.valid, "Existing Ant6 page is invalid");
    await call("save");
    report.validation = validation;
    report.nasSave = true;
    const loaded = new Set();
    for (const frame of win.webContents.mainFrame.framesInSubtree) {
      for (const url of await frame.executeJavaScript(
        'performance.getEntriesByType("resource").map(entry => entry.name)',
      )) {
        const parsed = new URL(url);
        if (
          [config.studioOrigin, config.canvasOrigin].includes(parsed.origin) &&
          parsed.pathname.startsWith("/static/")
        )
          loaded.add(url);
      }
    }
    for (const url of loaded) {
      const response = await ses.fetch(url, { method: "HEAD" });
      assert.equal(
        response.headers.get("X-Plasmic-Desktop-Asset"),
        "local",
        "Resource was not bundled: " + new URL(url).pathname,
      );
      report.localResources.push(new URL(url).pathname);
    }
    fs.writeFileSync(
      path.join(reportDir, "studio.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
    await win.loadURL(config.studioOrigin + "/projects/" + projectId);
    await until(win, "!!window.PLASMIC_AI_TOOLS");
    const restored = await call("read", { componentUuids: [componentUuid] });
    assert(
      restored.results[0].baseVariantTplTree.includes("plasmicAntd6Button"),
    );
    report.persisted = true;
    // Prove a full network outage does not require downloading a canvas resource.
    ses.enableNetworkEmulation({ offline: true });
    const offline = await win.webContents.executeJavaScript(`(async () => {
    const response = await fetch(${JSON.stringify(config.canvasOrigin + "/static/host.html")});
    return {status:response.status, local:response.headers.get('X-Plasmic-Desktop-Asset'),
      length:(await response.text()).length};
  })()`);
    assert.equal(offline.status, 200);
    assert.equal(offline.local, "local");
    assert(offline.length > 100);
    ses.disableNetworkEmulation();
    assert(
      report.localResources.some(
        (url) => url.includes("/canvas-packages/") && url.includes("antd6"),
      ),
      "Ant6 canvas bundle was not loaded from the package",
    );
    assert(
      report.localResources.some((url) => url.startsWith("/static/js/")),
      "Studio scripts were not local",
    );
    assert.equal(
      report.editorErrors.length,
      0,
      "Editor reported an unexpected error",
    );
    report.offlineCanvasAsset = true;
    report.status = "PASS";
    fs.writeFileSync(
      path.join(reportDir, "report.json"),
      JSON.stringify(report, null, 2),
    );
    console.log(
      "DESKTOP SMOKE PASS",
      JSON.stringify({
        localResources: report.localResources.length,
        validation,
      }),
    );
    clearTimeout(timeout);
    app.exit(0);
  })
  .catch((error) => {
    // Do not dump renderer request input, credentials or cookies in failure output.
    report.status = "FAIL";
    report.error = error.message;
    fs.writeFileSync(
      path.join(reportDir, "report.json"),
      JSON.stringify(report, null, 2),
    );
    console.error(error.message);
    clearTimeout(timeout);
    app.exit(1);
  });
