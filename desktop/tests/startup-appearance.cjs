// Verify first-paint backgrounds in Chromium without loading the app bundles.
const {
  app,
  BrowserWindow,
  ipcMain,
  session,
  nativeTheme,
} = require("electron");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { PNG } = require("pngjs");
const profile = fs.mkdtempSync(
  path.join(os.tmpdir(), "plasmic-startup-appearance-"),
);
app.setPath("userData", profile);
app.on("window-all-closed", () => {});
process.on("exit", () => fs.rmSync(profile, { recursive: true, force: true }));
const origin = "https://startup.example";
const source = require("../../platform/wab/node_modules/lodash/template")(fs.readFileSync(
  path.join(__dirname, "../../platform/wab/public/index.html"),
  "utf8",
), { interpolate: /<%=([\s\S]+?)%>/g })({
  staticUrl: origin,
  previewLoadingCss: fs.readFileSync(path.join(__dirname, "../../platform/wab/src/wab/client/components/live/PreviewLoading.css"), "utf8"),
  brand: require("../../platform/wab/src/wab/shared/branding.json"),
  brandLoadingAnimation: require("../../platform/wab/src/wab/client/components/widgets/brand-loading-animation.js").animateBrandLoading.toString(),
});
let scriptNumber = 0;
const studioHtml = source
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, (script) =>
    ++scriptNumber === 1 ? script : "",
  )
  .replace(/<link\b[^>]*>/g, "")
  .replace(/<body>[\s\S]*<\/body>/, "<body></body>");
scriptNumber = 0;
const projectHtml = source
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, (script) =>
    ++scriptNumber === 1 ||
    script.includes('getElementById("studio-startup-loading")') ||
    script.includes("animateStartupLogo")
      ? script
      : "",
  )
  .replace(/<link\b[^>]*>/g, "");
const hostHtml = fs
  .readFileSync(
    path.join(__dirname, "../../platform/sub/public/static/host.html"),
    "utf8",
  )
  .replace(/<script src=[^>]+><\/script>/, "");
const bootstrap = fs.readFileSync(
  path.join(__dirname, "../../platform/wab/public/studio.js.template"),
  "utf8",
);
const timeout = setTimeout(() => app.exit(1), 30000);
let activeWindow;
ipcMain.handle("desktop:view-state", () => ({active:true}));
ipcMain.handle("desktop:ui-appearance", (_event, appearance) => {
  activeWindow.setBackgroundColor(
    appearance === "dark" ? "#15161b" : "#eceef3",
  );
  return appearance;
});
app
  .whenReady()
  .then(async () => {
    const ses = session.fromPartition("persist:startup-appearance");
    ses.protocol.handle("https", (request) => {
      const url = new URL(request.url);
      let html = studioHtml;
      if (url.pathname === "/seed") {
        html = `<script>localStorage.setItem("shiguang.ui.appearance", ${JSON.stringify(url.searchParams.get("appearance"))});</script>`;
      } else if (url.pathname.startsWith("/projects/") || url.pathname.startsWith("/d/")) {
        html = projectHtml;
      } else if (url.pathname === "/host") {
        html = hostHtml.replace(
          "</body>",
          () =>
            `<script>const __plasmicData = { html: ${JSON.stringify(studioHtml).replaceAll("<", "\\u003c")} };${bootstrap.replaceAll("</script>", "<\\/script>")}</script></body>`,
        );
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
        webPreferences: {
          session: ses,
          preload: path.join(__dirname, "../src/preload.cjs"),
        },
      });
      await activeWindow.loadURL(`${origin}/seed?appearance=${appearance}`);
      const painted = new Promise((resolve) =>
        activeWindow.webContents.once("did-finish-load", resolve),
      );
      await activeWindow.loadURL(origin + "/");
      await painted;
      const resolved = appearance === "system" ? "dark" : appearance;
      const expected = resolved === "dark" ? [21, 22, 27] : [236, 238, 243];
      const computed = await activeWindow.webContents.executeJavaScript(
        `({ appearance: document.documentElement.dataset.uiAppearance, html: getComputedStyle(document.documentElement).backgroundColor, body: getComputedStyle(document.body).backgroundColor })`,
      );
      assert.equal(computed.appearance, resolved);
      assert.equal(computed.html, `rgb(${expected.join(", ")})`);
      assert.equal(computed.body, computed.html);
      assert.equal(
        activeWindow.getBackgroundColor().toLowerCase(),
        resolved === "dark" ? "#15161b" : "#eceef3",
      );
      const shot = PNG.sync.read(
        (await activeWindow.webContents.capturePage()).toPNG(),
      );
      // Chromium's screenshot color conversion can round a channel by one.
      expected.forEach((channel, index) =>
        assert.ok(Math.abs(shot.data[index] - channel) <= 1),
      );
      activeWindow.destroy();
      console.log(
        `Startup ${appearance}: native window and document paint ${resolved} before app bundles`,
      );
    }
    for (const pathname of ["/projects/example", "/projects/example/preview", "/d/0123456789"]) {
    for (const appearance of ["dark", "light"]) {
      activeWindow = new BrowserWindow({
        width: 900,
        height: 650,
        show: false,
        webPreferences: { session: ses },
      });
      await activeWindow.loadURL(`${origin}/seed?appearance=${appearance}`);
      await activeWindow.loadURL(origin + pathname);
      const computed = await activeWindow.webContents
        .executeJavaScript(`(() => {
      const loading = document.getElementById(${JSON.stringify(pathname.endsWith("/preview") || pathname.startsWith("/d/") ? "preview-startup-loading" : "studio-startup-loading")});
      const logo = loading.querySelector("svg");
      const rect = logo.getBoundingClientRect();
      return {
        display: getComputedStyle(loading).display,
        background: getComputedStyle(document.body).backgroundColor,
        loadingBackground: getComputedStyle(loading).backgroundColor,
        width: rect.width,
        height: rect.height,
        top: rect.top,
        bottom: rect.bottom,
        viewportHeight: innerHeight,
        placeholders: loading.querySelectorAll(".studio-loading__placeholder").length,
        pages: loading.querySelectorAll(".studio-loading__artboard").length,
        scaffold: logo.querySelectorAll("[data-scaffold] [clip-path] path").length,
        backgroundGrid: !!logo.querySelector("[data-grid]"),
        lights: logo.querySelector("[data-lights]").children.length,
        gradientStops: logo.querySelectorAll("linearGradient")[0].querySelectorAll("stop").length,
        spinner: !!loading.querySelector(".studio-loading__spinner, .ant-spin"),
      };
    })()`);
      assert.equal(computed.display, "flex");
      assert.equal(
        computed.background,
        appearance === "dark" ? "rgb(21, 22, 27)" : "rgb(236, 238, 243)",
      );
      assert.equal(computed.loadingBackground, computed.background);
      assert.equal(computed.width, 192);
      assert.ok(computed.height > 158 && computed.height < 159);
      assert.ok(
        computed.top >= 0 && computed.bottom <= computed.viewportHeight,
      );
      assert.equal(computed.placeholders, 0);
      assert.equal(computed.pages, 0);
      assert.equal(computed.scaffold, 40);
      assert.equal(computed.backgroundGrid, false);
      assert.equal(computed.lights, 112);
      assert.equal(computed.gradientStops, 4);
      assert.equal(computed.spinner, false);
      activeWindow.destroy();
      console.log(
        `${pathname} ${appearance}: brand logo paints before app bundles`,
      );
    }
    }
    for (const appearance of ["dark", "light"]) {
      activeWindow = new BrowserWindow({
        width: 500,
        height: 400,
        show: false,
        webPreferences: { session: ses },
      });
      await activeWindow.loadURL(
        `${origin}/seed?appearance=${appearance === "dark" ? "light" : "dark"}`,
      );
      await activeWindow.loadURL(
        `${origin}/host#origin=${encodeURIComponent(origin)}&uiAppearance=${appearance}`,
      );
      const computed = await activeWindow.webContents
        .executeJavaScript(`(() => {
      const frame = document.querySelector("iframe");
      return { host: getComputedStyle(document.documentElement).backgroundColor, frame: getComputedStyle(frame).backgroundColor, document: getComputedStyle(frame.contentDocument.documentElement).backgroundColor };
    })()`);
      const expected =
        appearance === "dark" ? "rgb(21, 22, 27)" : "rgb(236, 238, 243)";
      assert.deepEqual(computed, {
        host: expected,
        frame: expected,
        document: expected,
      });
      activeWindow.destroy();
      console.log(
        `Host ${appearance}: host, blank iframe and injected Studio document share the inherited background`,
      );
    }
    clearTimeout(timeout);
    app.exit(0);
  })
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
