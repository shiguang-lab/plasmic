const { app, session, BrowserWindow, nativeTheme, Menu } = require("electron");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const assert = require("node:assert/strict");
const config = require("../desktop.config.json");
const profile = fs.mkdtempSync(
  path.join(os.tmpdir(), "plasmic-unified-startup-"),
);
app.setPath("userData", profile);
const projectUrl = config.studioOrigin + "/projects/fixture?branch=main#page";
fs.writeFileSync(
  path.join(profile, "workspace.json"),
  JSON.stringify([{ url: projectUrl, name: "Session expiry fixture" }]),
);
let opened;
let slowRequests = 0;
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (
    request === "./asset-handler.cjs" &&
    parent.filename.endsWith("/src/main.cjs")
  ) {
    const { createAssetHandler } = originalLoad.call(
      this,
      request,
      parent,
      isMain,
    );
    return {
      createAssetHandler: (options) => {
        const handle = createAssetHandler(options);
        return async (request) => {
          const response = await handle(request);
          if (new URL(request.url).pathname !== "/projects/fixture")
            return response;
          const headers = new Headers(response.headers);
          headers.delete("Content-Length");
          // Hold the initial document load open while its bootstrap API detects
          // expiry. Login navigation must be allowed to supersede this load.
          const html = (await response.text()).replace(
            "</body>",
            '<img src="https://startup-fixture.invalid/slow.svg"></body>',
          );
          return new Response(html, { headers });
        };
      },
    };
  }
  if (
    request === "./open-browser.cjs" &&
    parent.filename.endsWith("/src/main.cjs")
  ) {
    return {
      openBrowser: async (url) => {
        opened = new URL(url);
      },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};
const { startDesktop } = require("../src/main.cjs");
Module._load = originalLoad;
const timeout = setTimeout(() => {
  console.error("Native sign-in startup timed out");
  app.exit(1);
}, 30000);
app
  .whenReady()
  .then(async () => {
    const ses = session.fromPartition("persist:plasmic-desktop");
    // No production API calls or credentials are involved in this native UI test.
    ses.fetch = async (request) => {
      const url = new URL(typeof request === "string" ? request : request.url);
      if (url.hostname === "startup-fixture.invalid") {
        slowRequests++;
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return new Response('<svg xmlns="http://www.w3.org/2000/svg"/>', {
          headers: { "Content-Type": "image/svg+xml" },
        });
      }
      if (url.pathname === "/api/auth/session") {
        return Response.json({ authenticated: false }, { status: 401 });
      }
      return Response.json(
        {
          error: {
            name: "UnauthorizedError",
            message: "Unauthenticated fixture",
            statusCode: 401,
          },
        },
        { status: 401 },
      );
    };
    nativeTheme.themeSource = "dark";
    const win = await startDesktop();
    assert(
      slowRequests > 0,
      "The first navigation must still have a loading resource",
    );
    assert.equal(win.webContents.getLastWebPreferences().sandbox, true);
    for (let i = 0; i < 150; i++) {
      if (
        new URL(win.webContents.getURL()).pathname ===
          "/desktop/unified-login" &&
        !win.webContents.isLoadingMainFrame()
      ) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    await win.webContents
      .executeJavaScript("window.desktopUnifiedLogin.command('status')")
      .then((status) => assert.equal(status.phase, "idle"));
    assert.equal(opened, undefined, "Startup must not open the system browser");
    assert.equal(
      await win.webContents.executeJavaScript(
        "document.getElementById('sign-in').hidden",
      ),
      false,
    );
    assert.equal(
      await win.webContents.executeJavaScript(
        "document.getElementById('status').hidden",
      ),
      true,
    );
    for (const language of ["en", "zh-CN", "zh-TW", "ja", "ko"]) {
      await win.webContents.executeJavaScript(
        `window.desktopEnvironment.setUiLocale(${JSON.stringify(language)})`,
      );
      const pack = JSON.parse(
        fs.readFileSync(
          path.join(
            __dirname,
            "../../platform/wab/src/wab/client/i18n/locales",
            language + ".json",
          ),
          "utf8",
        ),
      );
      const menu = Menu.getApplicationMenu();
      assert.equal(menu.getMenuItemById("desktop-file").label, pack.File);
      const edit = menu.items.find((item) =>
        item.submenu?.items.some((child) => child.role === "undo"),
      );
      assert.equal(edit.label, pack.Edit);
      for (const [role, key] of [
        ["undo", "Undo"],
        ["redo", "Redo"],
        ["cut", "Cut"],
        ["copy", "Copy"],
        ["paste", "Paste"],
        ["selectall", "Select All"],
      ]) {
        assert.equal(
          edit.submenu.items.find((item) => item.role?.toLowerCase() === role)
            ?.label,
          pack[key],
        );
      }
    }

    await win.webContents.executeJavaScript(
      'localStorage.setItem("shiguang.ui.language", "zh-CN")',
    );
    await win.loadURL(config.studioOrigin + "/desktop/unified-login");
    const zhPack = JSON.parse(
      fs.readFileSync(
        path.join(
          __dirname,
          "../../platform/wab/src/wab/client/i18n/locales/zh-CN.json",
        ),
        "utf8",
      ),
    );
    for (let attempt = 0; attempt < 100; attempt++) {
      if (
        (await win.webContents.executeJavaScript(
          'document.getElementById("sign-in").textContent',
        )) === zhPack["Sign in with Shiguang"]
      )
        break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    for (const [id, key] of [
      ["sign-in", "Sign in with Shiguang"],
      ["open", "Open browser"],
      ["retry", "Try again"],
    ]) {
      assert.equal(
        await win.webContents.executeJavaScript(
          `document.getElementById(${JSON.stringify(id)}).textContent`,
        ),
        zhPack[key],
      );
    }
    assert.equal(
      Menu.getApplicationMenu().getMenuItemById("desktop-file").label,
      zhPack.File,
    );
    console.log(
      "PASS: Reload restores the cached language in native menus and sign-in controls",
    );
    await win.webContents.executeJavaScript(
      'localStorage.setItem("shiguang.ui.language", "en")',
    );
    await win.webContents.executeJavaScript(
      'window.desktopEnvironment.setUiLocale("en")',
    );
    console.log(
      "PASS: Actual native menus follow five UI language changes through the trusted preload bridge",
    );
    await win.webContents.executeJavaScript(
      "window.desktopUpdates.command('open')",
    );
    assert.deepEqual(
      await win.webContents.executeJavaScript(`(() => {
      const root = document.getElementById("plasmic-desktop-update-dialog").shadowRoot;
      const dialog = root.querySelector("dialog");
      return { open: dialog.open, modal: dialog.matches(":modal"), background: getComputedStyle(dialog).backgroundColor, title: root.getElementById("status").textContent };
    })()`),
      {
        open: true,
        modal: true,
        background: "rgb(255, 255, 255)",
        title: "Updates unavailable",
      },
    );
    assert.equal(BrowserWindow.getAllWindows().length, 1);
    await win.webContents.executeJavaScript(
      'document.getElementById("plasmic-desktop-update-dialog").shadowRoot.getElementById("primary").click()',
    );
    assert.equal(
      await win.webContents.executeJavaScript(
        'document.getElementById("plasmic-desktop-update-dialog").shadowRoot.querySelector("dialog").open',
      ),
      false,
    );
    await win.webContents.executeJavaScript(
      "document.getElementById('sign-in').click()",
    );
    for (let i = 0; i < 100 && !opened; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert(opened, "Clicking Sign in with Shiguang must start authorization");
    assert.equal(opened.origin, "https://shiguanglab.com");
    assert.equal(opened.searchParams.get("client_id"), "plasmicapp");
    assert.equal(opened.searchParams.get("code_challenge_method"), "S256");
    const cancelled = await win.webContents.executeJavaScript(
      "window.desktopUnifiedLogin.command('cancel')",
    );
    assert.equal(cancelled.phase, "idle");
    assert.equal(
      new URL(win.webContents.getURL()).pathname,
      "/desktop/unified-login",
    );
    clearTimeout(timeout);
    console.log(
      "Native sign-in prompt, explicit browser authorization and cancellation passed",
    );
    // Destroy the isolated fixture window without invoking the app's asynchronous
    // workspace checkpoint-on-close flow (the fixture is deliberately logged out).
    win.destroy();
    app.exit(0);
  })
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
