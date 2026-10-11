// Verify first-paint backgrounds in Chromium without loading the app bundles.
const { app, BrowserWindow, ipcMain, session, nativeTheme } = require("electron");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { PNG } = require("pngjs");
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "plasmic-startup-appearance-"));
app.setPath("userData", profile);
app.on("window-all-closed", () => {});
process.on("exit", () => fs.rmSync(profile, { recursive: true, force: true }));
const origin = "https://startup.example";
const source = fs.readFileSync(path.join(__dirname, "../../platform/wab/public/index.html"), "utf8");
let scriptNumber = 0;
const studioHtml = source
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, (script) => ++scriptNumber === 1 ? script : "")
  .replace(/<link\b[^>]*>/g, "")
  .replace(/<body>[\s\S]*<\/body>/, "<body></body>");
const hostHtml = fs.readFileSync(path.join(__dirname, "../../platform/sub/public/static/host.html"), "utf8")
  .replace(/<script src=[^>]+><\/script>/, "");
const bootstrap = fs.readFileSync(path.join(__dirname, "../../platform/wab/public/studio.js.template"), "utf8");
const timeout = setTimeout(() => app.exit(1), 30000);
let activeWindow;
ipcMain.handle("desktop:ui-appearance", (_event, appearance) => {
  activeWindow.setBackgroundColor(appearance === "dark" ? "#15161b" : "#eceef3");
  return appearance;
});
app.whenReady().then(async () => {
  const ses = session.fromPartition("persist:startup-appearance");
  ses.protocol.handle("https", (request) => {
    const url = new URL(request.url);
    let html = studioHtml;
    if (url.pathname === "/seed") {
      html = `<script>localStorage.setItem("shiguang.ui.appearance", ${JSON.stringify(url.searchParams.get("appearance"))});</script>`;
    } else if (url.pathname === "/host") {
      html = hostHtml.replace("</body>", () => `<script>const __plasmicData = { html: ${JSON.stringify(studioHtml).replaceAll("<", "\\u003c")} };${bootstrap.replaceAll("</script>", "<\\/script>")}</script></body>`);
    }
    return new Response(html, { headers: { "Content-Type": "text/html" } });
  });
  for (const appearance of ["dark", "light", "system"]) {
    nativeTheme.themeSource = appearance === "system" ? "dark" : "light";
    activeWindow = new BrowserWindow({
      width: 500,
      height: 400,
      show: false,
      backgroundColor: "#ffffff",
      webPreferences: { session: ses, preload: path.join(__dirname, "../src/preload.cjs") },
    });
    await activeWindow.loadURL(`${origin}/seed?appearance=${appearance}`);
    const painted = new Promise((resolve) => activeWindow.webContents.once("did-finish-load", resolve));
    await activeWindow.loadURL(origin + "/");
    await painted;
    const resolved = appearance === "system" ? "dark" : appearance;
    const expected = resolved === "dark" ? [21, 22, 27] : [236, 238, 243];
    const computed = await activeWindow.webContents.executeJavaScript(`({ appearance: document.documentElement.dataset.uiAppearance, html: getComputedStyle(document.documentElement).backgroundColor, body: getComputedStyle(document.body).backgroundColor })`);
    assert.equal(computed.appearance, resolved);
    assert.equal(computed.html, `rgb(${expected.join(", ")})`);
    assert.equal(computed.body, computed.html);
    assert.equal(activeWindow.getBackgroundColor().toLowerCase(), resolved === "dark" ? "#15161b" : "#eceef3");
    const shot = PNG.sync.read((await activeWindow.webContents.capturePage()).toPNG());
    // Chromium's screenshot color conversion can round a channel by one.
    expected.forEach((channel, index) => assert.ok(Math.abs(shot.data[index] - channel) <= 1));
    activeWindow.destroy();
    console.log(`Startup ${appearance}: native window and document paint ${resolved} before app bundles`);
  }
  for (const appearance of ["dark", "light"]) {
    activeWindow = new BrowserWindow({ width: 500, height: 400, show: false, webPreferences: { session: ses } });
    await activeWindow.loadURL(`${origin}/seed?appearance=${appearance === "dark" ? "light" : "dark"}`);
    await activeWindow.loadURL(`${origin}/host#origin=${encodeURIComponent(origin)}&uiAppearance=${appearance}`);
    const computed = await activeWindow.webContents.executeJavaScript(`(() => {
      const frame = document.querySelector("iframe");
      return { host: getComputedStyle(document.documentElement).backgroundColor, frame: getComputedStyle(frame).backgroundColor, document: getComputedStyle(frame.contentDocument.documentElement).backgroundColor };
    })()`);
    const expected = appearance === "dark" ? "rgb(21, 22, 27)" : "rgb(236, 238, 243)";
    assert.deepEqual(computed, { host: expected, frame: expected, document: expected });
    activeWindow.destroy();
    console.log(`Host ${appearance}: host, blank iframe and injected Studio document share the inherited background`);
  }
  clearTimeout(timeout);
  app.exit(0);
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
