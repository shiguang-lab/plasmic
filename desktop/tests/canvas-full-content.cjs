// Native Chromium geometry/pixel regression: pnpm exec electron tests/canvas-full-content.cjs
const { app, BrowserWindow } = require("electron");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const sharp = require("sharp");
const { renderCanvas } = require("../src/canvas.cjs");
const { DesktopController } = require("../src/controller.cjs");

app.on("window-all-closed", () => {});
app.on("web-contents-created", (_event, contents) => {
  contents.on("console-message", (details) => {
    if (details.level === "error") console.error(details.message);
  });
});
app.whenReady().then(async () => {
  // Exercise the packaged capture window's devTools:false setting as well.
  Object.defineProperty(app, "isPackaged", { value: true });
  const fixtureDir = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-full-content-"));
  const source = new BrowserWindow({ show: false, width: 800, height: 600, useContentSize: true });
  try {
    const fixturePath = path.join(fixtureDir, "index.html");
    await fs.writeFile(fixturePath, `<!doctype html>
      <html><head><style>
      *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}
      main{height:100vh;display:flex;flex-direction:column;font:16px sans-serif}
      header{height:50px;flex-shrink:0;background:#336699;position:sticky;top:0;color:white}
      .body{flex:1;min-height:0;display:flex;overflow:hidden}
      aside{width:100px;flex-shrink:0;background:#eee}
      .outer{flex:1;min-height:0;overflow:auto}
      .spacer{height:2400px;position:relative;background:#f5f5f5}
      .inner{height:120px;width:300px;overflow:auto;border:2px solid black}
      .wide{width:1100px;height:320px;position:relative;background:#ffeedd}
      .corner{position:absolute;right:0;bottom:0;width:40px;height:40px;background:rgb(255,0,255)}
      .end{height:100px;background:rgb(0,255,0)}
      </style></head><body><main class="__wab_val_root"><header>完整内容截图</header>
      <div class="body"><aside>导航</aside><div class="outer" data-plasmic-valkey="page.outer">
      <div class="spacer">滚动区域顶部<img loading="lazy" width="30" height="30" style="position:absolute;left:0;bottom:0" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='30' height='30'%3E%3Cpath fill='cyan' d='M0 0h30v30H0z'/%3E%3C/svg%3E"></div><div class="inner" data-plasmic-valkey="page.inner">
      <div class="wide">横向和纵向滚动内容<div class="corner"></div></div></div><div class="end">底部内容</div>
      </div></div></main><div hidden style="height:40000px;overflow:auto"><div style="height:50000px">隐藏内容</div></div>
      <div style="opacity:0;position:absolute"><div style="height:100px;overflow:auto"><div style="height:50000px">不可见内容</div></div></div></body></html>`);
    await source.loadFile(fixturePath);
    await source.webContents.executeJavaScript(`document.fonts.ready.then(() => {
      document.documentElement.setAttribute("data-plasmic-render-ready", "");
      document.querySelector(".outer").scrollTop = 200;
      document.querySelector(".inner").scrollLeft = 80;
      document.querySelector(".inner").scrollTop = 30;
    })`);
    const before = await source.webContents.executeJavaScript("document.documentElement.outerHTML");
    const offsets = () => source.webContents.executeJavaScript(`[...document.querySelectorAll('.outer,.inner')].map(el => [el.scrollLeft,el.scrollTop])`);
    const originalOffsets = await offsets();
    const frame = { url: "https://canvas.example/#canvas=true", executeJavaScript: script => source.webContents.executeJavaScript(script) };
    const win = { isDestroyed: () => false, webContents: { getURL: () => "https://studio.example/projects/test", session: source.webContents.session, mainFrame: { framesInSubtree: [frame] } } };
    const regular = await renderCanvas(win);
    assert.equal(regular.width, 800);
    assert.equal(regular.height, 600);
    const full = await renderCanvas(win, { fullContent: true });
    assert.ok(full.width >= 1200, `horizontal content clipped at ${full.width}`);
    assert.ok(full.height >= 2870, `vertical content clipped at ${full.height}`);
    assert.deepEqual(full.image.getSize(), { width: full.width, height: full.height });
    assert.equal(full.fullContent.coverage, "rendered-dom");
    assert.deepEqual(full.fullContent.scrollRegions.map(region => region.elementUuid).sort(), ["inner", "outer"]);
    const { data, info } = await sharp(full.image.toPNG()).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixels = (r, g, b) => {
      let count = 0;
      for (let i = 0; i < data.length; i += info.channels) if (data[i] === r && data[i + 1] === g && data[i + 2] === b) count++;
      return count;
    };
    assert.ok(pixels(255, 0, 255) >= 1500, "nested bottom-right content is missing");
    assert.ok(pixels(0, 255, 0) >= 50000, "outer bottom content is missing");
    assert.ok(pixels(0, 255, 255) >= 800, "offscreen lazy images must load in the static copy");
    assert.ok(full.html.includes('loading="eager"'));
    assert.ok(pixels(51, 102, 153) >= 45 * full.width && pixels(51, 102, 153) <= 50 * full.width, "sticky header must appear once");
    const cropped = await renderCanvas(win, { fullContent: true, elementUuid: "inner" });
    assert.deepEqual(cropped.image.getSize(), { width: 1104, height: 324 });
    assert.equal(cropped.width, 1104);
    assert.equal(cropped.height, 324);
    const controller = new DesktopController(() => win, {});
    controller.state = async () => ({ ready: true, projectId: "test", editorContext: { mode: "edit", frameUuid: "frame" } });
    try {
      const encoded = await controller.dispatch("get_screenshot", { fullContent: true });
      assert.equal(encoded.encoding, "lossless");
      assert.equal(encoded.height, full.height, "long images must retain readable original-size pixels by default");
      assert.deepEqual(encoded.fullContent, full.fullContent);
      const compressed = await controller.dispatch("get_screenshot", { fullContent: true, fullResolution: false });
      assert.equal(compressed.encoding, "lossy");
      assert.equal(compressed.height, 2048);
    } finally { controller.close(); }
    assert.equal(await source.webContents.executeJavaScript("document.documentElement.outerHTML"), before);
    assert.deepEqual(await offsets(), originalOffsets);
    const output = path.join(os.tmpdir(), "plasmic-full-content.png");
    await fs.writeFile(output, full.image.toPNG());
    console.log(JSON.stringify({ passed: true, width: full.width, height: full.height, scrollRegions: full.fullContent.scrollRegions, output }));
    await source.webContents.executeJavaScript(`document.querySelector('.spacer').style.height='17000px'`);
    await assert.rejects(renderCanvas(win, { fullContent: true }), /Full-content screenshot exceeds/);
    assert.equal(BrowserWindow.getAllWindows().length, 1, "oversize capture must dispose its isolated window");
    const smallRegion = await renderCanvas(win, { fullContent: true, elementUuid: "inner" });
    assert.equal(smallRegion.height, 324, "element crops must remain available on oversized pages");
  } finally {
    source.destroy();
    await fs.rm(fixtureDir, { recursive: true, force: true });
  }
}).then(() => app.exit(0), error => { console.error(error); app.exit(1); });
