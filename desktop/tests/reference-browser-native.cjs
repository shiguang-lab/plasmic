const {
  app,
  BrowserWindow,
  nativeImage,
  clipboard,
  Menu,
} = require("electron");
const http = require("node:http");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { ReferenceBrowser } = require("../src/reference-browser.cjs");
const { inPage } = require("../src/browser-page.cjs");
const { createDesktopI18n } = require("../src/i18n.cjs");
const { createDesktopAppearance } = require("../src/ui-appearance.cjs");
const directory =
  process.env.PLASMIC_BROWSER_REPORT_DIR ||
  fs.mkdtempSync(path.join(os.tmpdir(), "plasmic-reference-browser-"));
fs.mkdirSync(directory, { recursive: true });
app.setPath(
  "userData",
  fs.mkdtempSync(path.join(os.tmpdir(), "plasmic-browser-profile-")),
);
let parent, browser, server;
const imports = [];
const screenshots = [];
const localeDirectory = fs.mkdtempSync(
  path.join(os.tmpdir(), "plasmic-browser-locales-"),
);
fs.cpSync(
  path.resolve(__dirname, "../../platform/wab/src/wab/client/i18n/locales"),
  localeDirectory,
  { recursive: true },
);
fs.copyFileSync(
  path.resolve(
    __dirname,
    "../../platform/wab/src/wab/client/i18n/locale-resolution.cjs",
  ),
  path.join(localeDirectory, "locale-resolution.cjs"),
);
const report = { status: "RUNNING", checks: [] };
const watchdog = setTimeout(() => {
  console.error("Reference browser native test timed out");
  app.exit(1);
}, 45000);
app
  .whenReady()
  .then(async () => {
    await (
      await import("../scripts/build-reference-browser-ui.mjs")
    ).buildReferenceBrowserUi();
    console.log("NATIVE create parent");
    let workspaceOpens = 0;
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          label: "File",
          submenu: [
            {
              id: "desktop-open-project",
              label: "Open Project…",
              click: () => {
                workspaceOpens++;
              },
            },
          ],
        },
      ]),
    );
    parent = new BrowserWindow({
      width: 1500,
      height: 1000,
      show: false,
      ...(process.platform === "darwin"
        ? {
            titleBarStyle: "hiddenInset",
            trafficLightPosition: { x: 24, y: 22 },
          }
        : {}),
      webPreferences: {
        preload: path.join(__dirname, "../src/preload.cjs"),
        contextIsolation: true,
        sandbox: true,
      },
    });
    await parent.loadURL(
      "data:text/html,<style>body{margin:0;background:%23202226}aside{position:fixed;right:8px;top:0}</style><aside>Editor edge</aside>",
    );
    const originalViewport = await parent.webContents.executeJavaScript(
      "({width:innerWidth,height:innerHeight,dpr:devicePixelRatio})",
    );

    server = http.createServer((request, response) => {
      if (request.url === "/next")
        return response.end('<h1 id="next">Next page</h1>');
      response.setHeader("Content-Type", "text/html");
      response.end(
        '<!doctype html><html><head><style>body{margin:0;background:#f7f5ee}main{display:flex;flex-direction:column;padding:32px;width:900px;gap:18px}h1{font:48px system-ui;margin:0}p{font:18px system-ui}section{display:flex;padding:24px;background:#d7e3b7;border-radius:12px;gap:12px}button{padding:12px}body{min-height:1600px}</style></head><body><main><h1>Reference browser</h1><section id="card"><p id="literal">{{ literal source text }}</p><button id="business" onclick="window.clicked=true">Try it</button></section><a id="next-link" href="/next">Next page</a></main><div id="below" style="position:absolute;top:1400px">Below clipped area</div><script>window.clicked=false</script></body></html>',
      );
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const url = `http://127.0.0.1:${server.address().port}`;
    console.log("NATIVE configure browser");
    browser = new ReferenceBrowser({
      getParent: () => parent,
      dispatch: (_method, input) => browser.command(input),
      getImportContext: async (input) => ({
        projectId: "fixture",
        ...(input.componentUuid ? { componentUuid: input.componentUuid } : {}),
      }),
      importHtml: async (input) => {
        imports.push(input);
        return {
          projectId: "fixture",
          componentUuid: "imported",
          elementUuids: ["root"],
          warnings: [],
          changeCounter: imports.length,
        };
      },
      uploadImage: async (bytes) => {
        const size = nativeImage.createFromBuffer(bytes).getSize();
        screenshots.push(size);
        assert(size.height > 50);
        fs.writeFileSync(path.join(directory, "selection.png"), bytes);
        return { src: "https://studio.example/screenshot.png" };
      },
      locate: async () => ({ located: true }),
      undo: async () => ({ undone: true }),
      i18n: createDesktopI18n(localeDirectory, ["zh-CN"]),
      appearance: createDesktopAppearance("light"),
    });
    console.log("NATIVE open chrome");
    await browser.open();
    console.log("NATIVE load reference page");
    await browser.command({ action: "load_page", url });
    console.log("NATIVE page loaded");
    assert(browser.snapshot().visible);
    assert.equal(BrowserWindow.getAllWindows().length, 1);
    assert(parent.contentView.children.includes(browser.chrome));
    assert(parent.contentView.children.includes(browser.view));
    assert.equal(browser.snapshot().locale, "zh-CN");
    assert.equal(browser.snapshot().canGoBack, false);
    const frame = () =>
      browser.view.webContents.executeJavaScript(
        "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
      );
    await frame();
    const desktopViewport = await browser.view.webContents.executeJavaScript(
      "({width:innerWidth,height:innerHeight})",
    );
    assert.equal(desktopViewport.width, browser.view.getBounds().width);
    await browser.command({ action: "cycle_device" });
    await frame();
    assert.equal(browser.state.device, "Phone");
    assert.deepEqual(
      await browser.view.webContents.executeJavaScript(
        "({width:innerWidth,height:innerHeight})",
      ),
      { width: 390, height: 844 },
    );
    await browser.command({ action: "cycle_device" });
    await frame();
    assert.equal(browser.state.device, "Tablet");
    assert.deepEqual(
      await browser.view.webContents.executeJavaScript(
        "({width:innerWidth,height:innerHeight})",
      ),
      { width: 1180, height: 820 },
    );
    await browser.command({ action: "cycle_device" });
    await frame();
    assert.equal(browser.state.device, "Desktop");
    assert.equal(
      await browser.view.webContents.executeJavaScript("innerWidth"),
      browser.view.getBounds().width,
    );
    report.checks.push(
      "desktop viewport reflows at 100%; one-button Desktop → Phone → Tablet cycle uses measured reference dimensions",
    );
    const menus = Object.fromEntries(
      ["screenshot", "more", "history"].map((name) => [
        name,
        browser.menu(name),
      ]),
    );
    assert.deepEqual(
      menus.screenshot.map((item) => item.label),
      ["整个网页", "可见区域"],
    );
    assert(menus.more.some((item) => item.label === "清空缓存并重新加载"));
    assert(menus.more.some((item) => item.label === "重置缩放为 100%"));
    assert.equal(menus.history.length, 1);
    browser.menu("more", 0);
    await frame();
    assert.equal(browser.state.zoom, 1.25);
    assert(
      Math.abs(
        (await browser.view.webContents.executeJavaScript("innerWidth")) -
          browser.view.getBounds().width / 1.25,
      ) <= 1,
    );
    browser.menu("more", 3);
    await frame();
    assert.equal(browser.state.zoom, 1);
    assert.deepEqual(JSON.parse(fs.readFileSync(browser.historyFile, "utf8")), [
      url + "/",
    ]);
    report.checks.push(
      "camera menu exposes full page and visible area; zoom/cache actions and persisted history match the reference controls",
    );
    assert.equal(
      browser.view.webContents.getLastWebPreferences().nodeIntegration,
      false,
    );
    assert.equal(
      browser.view.webContents.getLastWebPreferences().preload,
      undefined,
    );
    assert.equal(
      await browser.view.webContents.executeJavaScript(
        "typeof window.referenceBrowser",
      ),
      "undefined",
    );
    assert.equal(
      await browser.chrome.webContents.executeJavaScript(
        'document.querySelector("h1").textContent',
      ),
      "从网页导入",
    );
    report.checks.push(
      "docked browser chrome; localized UI; isolated page with no privileged preload",
    );
    const chromeEval = async (expression) => {
      try {
        return await browser.chrome.webContents.executeJavaScript(
          expression,
          true,
        );
      } catch (error) {
        console.error("FAILED EXPRESSION", expression);
        throw error;
      }
    };
    const settleChrome = () =>
      chromeEval(
        "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
      );
    const waitChrome = async (expression) => {
      for (let attempt = 0; attempt < 50; attempt++) {
        if (await chromeEval(expression)) return;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      throw new Error(`Chrome condition not met: ${expression}`);
    };
    await chromeEval(`document.querySelector('[data-menu="more"]').click()`);
    await waitChrome('!document.getElementById("popover").hidden');
    await settleChrome();
    assert.equal(parent.contentView.children.at(-1), browser.chrome);
    assert.equal(browser.view.getVisible(), true);
    assert.equal(
      await chromeEval(
        'getComputedStyle(document.getElementById("popover")).backgroundColor',
      ),
      "rgb(255, 255, 255)",
    );
    browser.appearance.set("dark");
    await settleChrome();
    assert.equal(
      await chromeEval(
        'getComputedStyle(document.getElementById("popover")).backgroundColor',
      ),
      "rgb(32, 33, 40)",
    );
    assert.equal(
      await chromeEval(
        'getComputedStyle(document.getElementById("page-space")).backgroundColor',
      ),
      "rgba(0, 0, 0, 0)",
    );
    assert.equal(
      await chromeEval(
        'getComputedStyle(document.getElementById("menu-scroll")).height',
      ),
      `${await chromeEval('document.getElementById("menu-scroll").offsetHeight')}px`,
    );
    await chromeEval(
      'document.dispatchEvent(new KeyboardEvent("keydown", {key:"End",bubbles:true}))',
    );
    assert.equal(
      await chromeEval("document.activeElement.textContent"),
      "在系统浏览器中打开",
    );
    await chromeEval(
      'document.dispatchEvent(new KeyboardEvent("keydown", {key:"Escape",bubbles:true}))',
    );
    await waitChrome('document.getElementById("popover").hidden');
    await settleChrome();
    assert.equal(parent.contentView.children.at(-1), browser.view);
    assert.equal(
      await chromeEval("document.activeElement.dataset.menu"),
      "more",
    );
    browser.appearance.set("light");
    // Exercise the real menu action, not only its descriptor.
    await chromeEval(`document.querySelector('[data-menu="more"]').click()`);
    await waitChrome('!document.getElementById("popover").hidden');
    await chromeEval('document.querySelector("#menu button").click()');
    await waitChrome('document.getElementById("popover").hidden');
    assert.equal(browser.state.zoom, 1.25);
    browser.menu("more", 3);
    report.checks.push(
      "themed popovers overlay the live source, follow app appearance, and support keyboard navigation and focus restoration",
    );
    const chromeDebugger = browser.chrome.webContents.debugger;
    chromeDebugger.attach("1.3");
    assert(
      (
        await chromeEval(
          'getComputedStyle(document.querySelector("#toolbar button")).transitionDuration',
        )
      ).includes("0.12s"),
    );
    await chromeDebugger.sendCommand("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "reduce" }],
    });
    assert.equal(
      await chromeEval(
        'getComputedStyle(document.querySelector("#toolbar button")).transitionDuration',
      ),
      "0s",
    );
    assert.equal(
      await chromeEval(
        'getComputedStyle(document.querySelector(".spinner")).animationName',
      ),
      "none",
    );
    await chromeDebugger.sendCommand("Emulation.setEmulatedMedia", {
      features: [],
    });
    chromeDebugger.detach();
    report.checks.push(
      "system reduced-motion preference disables button transitions and loading animation",
    );
    const fakeEvent = {
      sender: browser.view.webContents,
      senderFrame: browser.view.webContents.mainFrame,
    };
    await assert.rejects(
      browser.onCommand(fakeEvent, { action: "import_to_canvas" }),
      /Invalid reference browser page/,
    );
    report.checks.push("untrusted reference contents cannot call chrome IPC");
    // Exercise the actual mouse picker, including suppression of business clicks.
    await browser.command({ action: "select_element" });
    await browser.view.webContents.executeJavaScript(
      'document.getElementById("business").click()',
    );
    await browser.poll();
    assert(browser.state.selection.selector.endsWith("button"));
    assert.equal(browser.state.picking, true);
    assert.equal(
      browser.state.selection.details.padding["padding-top"],
      "12px",
    );
    assert(
      browser.state.selection.details.style.includes("padding-top: 12px;"),
    );
    await browser.chrome.webContents.executeJavaScript(
      "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
    );
    const inspector = await browser.chrome.webContents.executeJavaScript(
      '({visible: !document.getElementById("inspector").hidden, labels: Array.from(document.querySelectorAll("#inspector button")).map(node=>node.getAttribute("aria-label")), hasDestinationMenu: !!document.querySelector(\'[data-menu="target"]\')})',
    );
    assert(inspector.visible);
    assert(inspector.labels.some((label) => label.includes("复制")));
    assert.equal(inspector.hasDestinationMenu, false);
    const writeClipboard = clipboard.writeText;
    let copied;
    try {
      clipboard.writeText = (value) => {
        copied = value;
      };
      await browser.onCommand(
        {
          sender: browser.chrome.webContents,
          senderFrame: browser.chrome.webContents.mainFrame,
        },
        { action: "copy_selection", group: "padding", property: "padding-top" },
      );
      assert.equal(copied, "12px");
      await chromeEval(
        'document.querySelectorAll("#inspector button")[0].click()',
      );
      await waitChrome(
        'document.querySelectorAll("#inspector button")[0].dataset.copied === "true"',
      );
      assert.equal(
        await chromeEval('document.getElementById("copy-status").textContent'),
        "已复制",
      );
      clipboard.writeText = () => {
        throw new Error("fixture clipboard denied");
      };
      await chromeEval(
        'document.querySelectorAll("#inspector button")[0].click()',
      );
      await waitChrome(
        'document.getElementById("copy-status").textContent.includes("fixture clipboard denied")',
      );
      assert.equal(
        await chromeEval(
          'document.querySelectorAll("#inspector button")[0].hasAttribute("data-copied")',
        ),
        false,
      );
    } finally {
      clipboard.writeText = writeClipboard;
    }
    report.checks.push(
      "continuous picking exposes computed styles and the trusted copy action copies the chosen property value",
    );
    assert.equal(
      await browser.view.webContents.executeJavaScript("window.clicked"),
      false,
    );
    const ancestors = browser.state.selection.ancestors;
    await browser.command({
      action: "select_element",
      selector: ancestors.at(-2).selector,
    });
    assert.equal(browser.state.selection.ancestors.at(-1).tag, "section");
    report.checks.push(
      "picker locks element, blocks business click and selects its parent",
    );
    const result = await browser.command({
      action: "import_to_canvas",
      target: "selection",
    });
    assert.equal(result.componentUuid, "imported");
    assert(imports[0].html.includes("{{ literal source text }}"));
    assert(!imports[0].html.includes("onclick"));
    assert(!imports[0].html.includes("data-plasmic-browser-overlay"));
    assert(!imports[0].html.includes("<script"));
    report.checks.push(
      "explicit import uses selected DOM, static capture and shared import callback",
    );
    const completed = new Promise((resolve) => {
      const original = browser.dispatch;
      browser.dispatch = async (...args) => {
        try {
          return await original(...args);
        } finally {
          browser.dispatch = original;
          resolve();
        }
      };
    });
    await browser.chrome.webContents.executeJavaScript(
      'document.getElementById("import").click();document.getElementById("import").click()',
      true,
    );
    await completed;
    assert.equal(imports.length, 2);
    assert.equal(imports.at(-1).componentUuid, undefined);
    await browser.command({
      action: "import_to_canvas",
      target: "selection",
      componentUuid: "explicit",
    });
    assert.equal(imports.at(-1).componentUuid, "explicit");
    report.checks.push(
      "visible Import button creates a page without a selected destination; MCP can append to an explicit component",
    );
    await browser.command({ action: "clear_selection" });
    await assert.rejects(
      browser.command({ action: "set_import_height", height: 239 }),
      /240/,
    );
    await browser.command({ action: "set_import_height", height: 600 });
    await settleChrome();
    await chromeEval(
      'document.getElementById("height-handle").dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowUp",bubbles:true}))',
    );
    await waitChrome(
      'document.getElementById("height-handle").getAttribute("aria-valuenow") === "576"',
    );
    assert.equal(browser.state.importHeight, 576);
    assert.equal(browser.view.getBounds().height, 576);
    const clipArea = await chromeEval(
      '({height:document.getElementById("viewport").getBoundingClientRect().height, stripeHeight:document.getElementById("clip-space").getBoundingClientRect().height, pattern:getComputedStyle(document.getElementById("clip-space")).backgroundImage})',
    );
    assert.equal(clipArea.height, 576);
    assert(
      clipArea.stripeHeight > 0 &&
        clipArea.pattern.includes("repeating-linear-gradient"),
    );
    browser.menu("more", 0);
    await browser.command({ action: "set_import_height", height: 500 });
    await browser.command({ action: "import_to_canvas", target: "full_page" });
    assert.equal(imports.at(-1).height, 400);
    const { JSDOM } = require("jsdom");
    const clippedDocument = new JSDOM(imports.at(-1).html).window.document;
    assert.equal(clippedDocument.body.firstElementChild.style.height, "400px");
    assert.equal(
      clippedDocument.body.firstElementChild.style.overflow,
      "hidden",
    );
    assert(!clippedDocument.body.textContent.includes("Below clipped area"));
    await browser.command({
      action: "screenshot_to_canvas",
      target: "full_page",
    });
    assert.equal(
      screenshots.at(-1).height,
      (400 *
        (await browser.view.webContents.executeJavaScript(
          "devicePixelRatio",
        ))) /
        browser.state.zoom,
    );
    browser.menu("more", 3);
    await chromeEval(
      'document.getElementById("height-handle").dispatchEvent(new MouseEvent("dblclick",{bubbles:true}))',
    );
    await waitChrome('document.getElementById("clip-space").hidden');
    assert.equal(browser.state.importHeight, null);
    assert.equal(
      browser.view.getBounds().height,
      browser.state.maxImportHeight,
    );
    await browser.command({ action: "select_element", selector: "#card" });
    report.checks.push(
      "bottom grip clips the native viewport, editable DOM and screenshots at zoom-adjusted height; keyboard adjustment and double-click restore the full page",
    );
    browser.state.result.warnings = Array.from(
      { length: 20 },
      (_, index) => `Import warning ${index + 1}: fixture detail.`,
    );
    browser.publish();
    await settleChrome();
    await chromeEval(
      `document.querySelector('[data-action="show_warnings"]').click()`,
    );
    await waitChrome('!document.getElementById("popover").hidden');
    const detailsBounds = await chromeEval(
      '(()=>{const rect=document.getElementById("popover").getBoundingClientRect();return {top:rect.top,bottom:rect.bottom,height:innerHeight,rows:document.querySelectorAll("#menu p").length}})()',
    );
    assert(
      detailsBounds.top >= 8 &&
        detailsBounds.bottom <= detailsBounds.height - 8,
    );
    assert.equal(detailsBounds.rows, 21);
    await chromeEval(
      'document.dispatchEvent(new KeyboardEvent("keydown", {key:"Escape",bubbles:true}))',
    );
    browser.state.result.warnings = [];
    browser.publish();
    report.checks.push(
      "import details open above the receipt with a bounded shared scroll area",
    );
    const beforeCancel = imports.length;
    const getContext = browser.getImportContext;
    let resume, started;
    const waiting = new Promise((resolve) => {
      started = resolve;
    });
    browser.getImportContext = async (...args) => {
      started();
      await new Promise((resolve) => {
        resume = resolve;
      });
      return getContext(...args);
    };
    const pending = browser.command({
      action: "import_to_canvas",
      target: "selection",
    });
    await waiting;
    await browser.command({ action: "cancel" });
    resume();
    await assert.rejects(pending, /cancelled/);
    browser.getImportContext = getContext;
    assert.equal(imports.length, beforeCancel);
    report.checks.push("cancelling preparation leaves the canvas untouched");
    const originalBounds = browser.chrome.getBounds();
    const assertDocked = async () => {
      const [width, height] = parent.getContentSize();
      const panel = browser.chrome.getBounds();
      assert.equal(panel.y, 8);
      assert.equal(height - panel.y - panel.height, 8);
      assert.equal(width - panel.x - panel.width, 8);
      const toolbar = await chromeEval(
        '(()=>{const bar=document.getElementById("toolbar").getBoundingClientRect();const control=document.getElementById("import").getBoundingClientRect();return {bottom:bar.bottom,controlHeight:control.height}})()',
      );
      assert.equal(toolbar.bottom, 42);
      assert.equal(toolbar.controlHeight, 28);
      const editor = await parent.webContents.executeJavaScript(
        '({width:innerWidth,height:innerHeight,right:document.querySelector("aside").getBoundingClientRect().right,dpr:devicePixelRatio,scale:visualViewport.scale})',
      );
      assert.equal(
        editor.width,
        browser.expanded ? width : Math.max(1, panel.x),
      );
      assert.equal(editor.height, height);
      assert.equal(editor.right, editor.width - 8);
      if (!browser.expanded) assert.equal(panel.x - editor.right, 8);
      assert.equal(editor.dpr, originalViewport.dpr);
      assert.equal(editor.scale, 1);
    };
    await assertDocked();
    const beforeExpand = parent.getBounds();
    await browser.command({ action: "expand" });
    assert.deepEqual(parent.getBounds(), beforeExpand);
    assert.equal(browser.chrome.getBounds().x, 8);
    await settleChrome();
    assert.equal(
      await chromeEval('document.getElementById("app-header").hidden'),
      false,
    );
    const leadingBounds = await chromeEval(
      '(()=>{const app=document.getElementById("app-menu").getBoundingClientRect();const picker=document.querySelector("[data-action=select_element]").getBoundingClientRect();return {left:app.left,right:app.right,pickerLeft:picker.left}})()',
    );
    assert(leadingBounds.pickerLeft > leadingBounds.right);
    if (process.platform === "darwin") assert(leadingBounds.left >= 96);
    assert.deepEqual(
      await parent.webContents.executeJavaScript(
        "({visibility:document.documentElement.style.visibility,inert:document.documentElement.inert})",
      ),
      { visibility: "hidden", inert: true },
    );
    await browser.onCommand(
      {
        sender: browser.chrome.webContents,
        senderFrame: browser.chrome.webContents.mainFrame,
      },
      { action: "open_workspace" },
    );
    assert.equal(workspaceOpens, 1);
    await assertDocked();
    await browser.command({ action: "expand" });
    assert.deepEqual(browser.chrome.getBounds(), originalBounds);
    await settleChrome();
    assert.equal(
      await chromeEval('document.getElementById("app-header").hidden'),
      true,
    );
    assert.deepEqual(
      await parent.webContents.executeJavaScript(
        "({visibility:document.documentElement.style.visibility,inert:document.documentElement.inert})",
      ),
      { visibility: "", inert: false },
    );
    report.checks.push(
      "expanded mode merges app identity and workspace entry into the browser header, reserves native window controls, and restores the hidden inert editor on exit",
    );
    const chromeContents = browser.chrome.webContents;
    await chromeEval(
      'document.getElementById("resize-handle").addEventListener("pointerdown", event => { window.resizePointerId = event.pointerId; })',
    );
    const moveResizePointer = async (x, pressed = false) => {
      chromeContents.sendInputEvent({
        type: "mouseMove",
        x,
        y: 200,
        globalX: browser.chrome.getBounds().x + x,
        modifiers: pressed ? ["leftButtonDown"] : [],
      });
      await settleChrome();
    };
    const pressResizePointer = async () => {
      chromeContents.sendInputEvent({
        type: "mouseDown",
        x: 3,
        y: 200,
        globalX: browser.chrome.getBounds().x + 3,
        button: "left",
        clickCount: 1,
      });
      await settleChrome();
    };
    await moveResizePointer(3);
    assert.equal(browser.chrome.getBounds().width, originalBounds.width);
    await pressResizePointer();
    await moveResizePointer(-37, true);
    const draggedWidth = browser.chrome.getBounds().width;
    assert.equal(draggedWidth, originalBounds.width + 40);
    chromeContents.sendInputEvent({
      type: "mouseUp",
      x: 3,
      y: 200,
      button: "left",
      clickCount: 1,
    });
    await settleChrome();
    await moveResizePointer(3);
    assert.equal(browser.chrome.getBounds().width, draggedWidth);
    await pressResizePointer();
    await moveResizePointer(-17, true);
    const beforeCaptureLoss = browser.chrome.getBounds().width;
    await chromeEval(
      'document.getElementById("resize-handle").releasePointerCapture(window.resizePointerId)',
    );
    await settleChrome();
    await moveResizePointer(3, true);
    assert.equal(browser.chrome.getBounds().width, beforeCaptureLoss);
    chromeContents.sendInputEvent({
      type: "mouseUp",
      x: 3,
      y: 200,
      button: "left",
      clickCount: 1,
    });
    await settleChrome();
    await pressResizePointer();
    const beforeUnpressedMove = browser.chrome.getBounds().width;
    await moveResizePointer(23);
    assert.equal(browser.chrome.getBounds().width, beforeUnpressedMove);
    await pressResizePointer();
    await chromeEval('window.dispatchEvent(new Event("blur"))');
    await moveResizePointer(-17, true);
    assert.equal(browser.chrome.getBounds().width, beforeUnpressedMove);
    chromeContents.sendInputEvent({
      type: "mouseUp",
      x: 3,
      y: 200,
      button: "left",
      clickCount: 1,
    });
    await settleChrome();
    await moveResizePointer(3);
    report.checks.push(
      "panel width changes only while dragging with the left button; hover, release and lost pointer capture leave its width unchanged",
    );
    await browser.onCommand(
      { sender: chromeContents, senderFrame: chromeContents.mainFrame },
      { action: "panel_width", width: 720 },
    );
    assert.equal(browser.chrome.getBounds().width, 720);
    await assertDocked();
    parent.setContentSize(1100, 720);
    browser.layout();
    await assertDocked();
    parent.setContentSize(originalViewport.width, originalViewport.height);
    await parent.webContents.executeJavaScript(
      "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
    );
    await browser.onCommand(
      { sender: chromeContents, senderFrame: chromeContents.mainFrame },
      { action: "panel_width", width: originalBounds.width },
    );
    await assertDocked();
    report.checks.push(
      "right dock reserves editor width at 1:1 scale and keeps an 8 px gap from Studio chrome plus 8 px top, bottom and right insets through resize and expand",
    );
    const contents = browser.view.webContents;
    await browser.command({ action: "close" });
    assert(!browser.snapshot().visible);
    assert(parent.isVisible());
    await parent.webContents.executeJavaScript(
      "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
    );
    const restoredViewport = await parent.webContents.executeJavaScript(
      "({width:innerWidth,height:innerHeight,dpr:devicePixelRatio})",
    );
    assert.deepEqual(restoredViewport, originalViewport);
    await browser.command({ action: "open" });
    await assertDocked();
    assert.equal(browser.view.webContents, contents);
    assert.equal(browser.state.selection.ancestors.at(-1).tag, "section");
    report.checks.push(
      "closing and reopening preserves the same page, session and selection",
    );
    await browser.command({ action: "expand" });
    await browser.command({ action: "close" });
    await parent.webContents.executeJavaScript(
      "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
    );
    assert.equal(
      await parent.webContents.executeJavaScript(
        "document.documentElement.inert",
      ),
      false,
    );
    await browser.command({ action: "open" });
    await settleChrome();
    assert.equal(
      await parent.webContents.executeJavaScript(
        "document.documentElement.inert",
      ),
      true,
    );
    await browser.command({ action: "expand" });
    await settleChrome();
    assert.equal(
      await parent.webContents.executeJavaScript(
        "document.documentElement.inert",
      ),
      false,
    );
    await browser.command({ action: "clear_selection" });
    assert.equal(browser.state.selection, null);
    await browser.view.webContents.executeJavaScript(
      'document.getElementById("next-link").click()',
      true,
    );
    await new Promise((resolve) =>
      browser.view.webContents.once("did-stop-loading", resolve),
    );
    assert(browser.snapshot().canGoBack);
    await browser.command({ action: "back" });
    await new Promise((resolve) =>
      browser.view.webContents.once("did-stop-loading", resolve),
    );
    assert(browser.snapshot().canGoForward);
    await assert.rejects(
      browser.command({ action: "cdp", method: "Network.getAllCookies" }),
      /Unsupported/,
    );
    await assert.rejects(
      browser.command({
        action: "cdp",
        method: "Page.navigate",
        params: { url: "file:///etc/passwd" },
      }),
      /HTTP/,
    );
    report.checks.push("real navigation history and restricted CDP");
    await browser.command({ action: "select_element", selector: "#card" });
    await browser.view.webContents.executeJavaScript("window.scrollTo(0, 100)");
    await browser.command({
      action: "screenshot_to_canvas",
      target: "selection",
    });
    assert.equal(
      screenshots.at(-1).width,
      900 *
        (await browser.view.webContents.executeJavaScript("devicePixelRatio")),
    );
    assert(
      imports.at(-1).html.includes("https://studio.example/screenshot.png"),
    );
    report.checks.push(
      "selection screenshot uploads through the image path before HTML import",
    );
    const metrics = await browser.cdp("Page.getLayoutMetrics");
    const viewport = metrics.cssVisualViewport;
    await browser.command({
      action: "screenshot_to_canvas",
      target: "visible_area",
    });
    const dpr =
      await browser.view.webContents.executeJavaScript("devicePixelRatio");
    assert(
      Math.abs(screenshots.at(-1).width - viewport.clientWidth * dpr) <= 1,
    );
    assert(
      Math.abs(screenshots.at(-1).height - viewport.clientHeight * dpr) <= 1,
    );
    assert(imports.at(-1).html.includes(`width:${viewport.clientWidth}px`));
    report.checks.push(
      "visible-area screenshot uses the scrolled viewport dimensions rather than full-page dimensions",
    );
    await browser.command({ action: "select_element", selector: "#card" });
    await browser.poll();
    await browser.chrome.webContents.executeJavaScript(
      "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
    );
    fs.writeFileSync(
      path.join(directory, "chrome.png"),
      (await browser.chrome.webContents.capturePage()).toPNG(),
    );
    await browser.command({ action: "clear_page" });
    await browser.chrome.webContents.executeJavaScript(
      "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
    );
    assert.equal(browser.snapshot().canGoBack, false);
    assert.equal(browser.snapshot().canGoForward, false);
    const start = await browser.chrome.webContents.executeJavaScript(
      '({visible: !document.getElementById("start").hidden, disabled: document.querySelector(\'[data-action="back"]\').disabled, headingRight: document.querySelector(".recent-heading").getBoundingClientRect().right, clearRight: document.querySelector(\'[data-action="clear_history"]\').getBoundingClientRect().right})',
    );
    assert(start.visible && start.disabled);
    const originalRecent = browser.state.recent;
    browser.state.recent = Array.from(
      { length: 30 },
      (_, index) => `https://example.com/${index}`,
    );
    browser.publish();
    await settleChrome();
    assert.equal(
      await chromeEval('document.querySelectorAll("#recent button").length'),
      30,
    );
    assert.equal(
      await chromeEval(
        'document.querySelectorAll("[data-overlayscrollbars]").length',
      ),
      3,
    );
    const scrollArea = await chromeEval(
      '(()=>{const node=document.querySelector("#start-scroll [data-overlayscrollbars-viewport]");return {height:node.clientHeight,scrollHeight:node.scrollHeight}})()',
    );
    assert(
      scrollArea.scrollHeight > scrollArea.height && scrollArea.height > 0,
    );
    assert.equal(
      await chromeEval('!!document.querySelector("#start-scroll .privacy")'),
      true,
    );
    assert.equal(
      await chromeEval(
        'getComputedStyle(document.querySelector(".privacy")).borderTopWidth',
      ),
      "0px",
    );
    report.checks.push(
      "privacy note scrolls with the homepage and does not occupy a separate fixed bottom bar",
    );
    browser.state.recent = originalRecent;
    browser.publish();
    report.checks.push(
      "all recent pages use the bounded shared Scrollbar; copy success and failure receive accurate visible feedback",
    );
    assert(Math.abs(start.headingRight - start.clearRight) <= 1);
    await browser.command({ action: "load_page", url });
    await browser.command({ action: "select_element", selector: "#card" });
    await frame();
    report.checks.push(
      "closing a page returns to the start screen with cleared navigation and a right-aligned Clear All action",
    );
    if (process.env.PLASMIC_BROWSER_VISUAL_CHECK) {
      await browser.view.webContents.executeJavaScript("window.scrollTo(0, 0)");
      await new Promise((resolve) => setTimeout(resolve, 25000));
    }
    const chrome = browser.chrome.webContents,
      page = browser.view.webContents;
    const released = Promise.all(
      [chrome, page].map(
        (contents) =>
          new Promise((resolve) => contents.once("destroyed", resolve)),
      ),
    );
    browser.dispose();
    await released;
    assert(chrome.isDestroyed());
    assert(page.isDestroyed());
    assert(!parent.isDestroyed());
    assert.equal(
      await parent.webContents.executeJavaScript("innerWidth"),
      parent.getContentSize()[0],
    );
    browser = undefined;
    report.checks.push(
      "disposing the embedded browser closes its contents and keeps the editor window",
    );
    report.status = "PASS";
  })
  .catch((error) => {
    report.status = "FAIL";
    report.error = error.stack;
    console.error(error);
  })
  .finally(() => {
    clearTimeout(watchdog);
    browser?.dispose();
    parent?.destroy();
    server?.close();
    fs.writeFileSync(
      path.join(directory, "report.json"),
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report));
    app.exit(report.status === "PASS" ? 0 : 1);
  });
