const { test } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const vm = require("node:vm");
const { EventEmitter } = require("node:events");
const { JSDOM } = require("jsdom");

function documentContext(dom) {
  return {
    document: dom.window.document,
    location: dom.window.location,
    innerWidth: 390,
    innerHeight: 844,
    crypto: require("node:crypto").webcrypto,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    HTMLInputElement: dom.window.HTMLInputElement,
    HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
    HTMLOptionElement: dom.window.HTMLOptionElement,
    HTMLCanvasElement: dom.window.HTMLCanvasElement,
    requestAnimationFrame: (callback) => callback(),
    setTimeout,
    URLSearchParams,
  };
}
// Canvas fixtures model Studio artboards that finished rendering, so they carry
// the render-ready signal Studio sets; pass { renderReady: false } to opt out.
function domFor(html, { renderReady = true } = {}) {
  const dom = new JSDOM(html, {
    url: "https://canvas.example/#canvas=true",
    runScripts: "dangerously",
    beforeParse(window) {
      window.document.fonts = { ready: Promise.resolve() };
    },
  });
  for (const el of dom.window.document.querySelectorAll("*")) {
    el.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      left: 0,
      right: 300,
      width: 300,
      height: 20,
    });
  }
  if (renderReady) {
    dom.window.document.documentElement.setAttribute("data-plasmic-render-ready", "");
  }
  return dom;
}
let exported;
class Preview {
  constructor() {
    this.size = { width: 390, height: 844 };
    this.webContents = Object.assign(new EventEmitter(), {
      setWindowOpenHandler() {},
      executeJavaScript: (script) =>
        vm.runInNewContext(script, documentContext(this.dom)),
      invalidate: () =>
        queueMicrotask(() =>
          this.webContents.emit(
            "paint",
            {},
            {},
            {
              getSize: () => this.size,
              toPNG: () => Buffer.from("png"),
            },
          ),
        ),
    });
  }
  async loadURL(url) {
    this.dom = exported = domFor(
      decodeURIComponent(url.split(",").slice(1).join(",")),
    );
    await new Promise((resolve) =>
      this.dom.window.addEventListener("load", resolve, { once: true }),
    );
  }
  setContentSize(width, height) {
    this.size = { width, height };
  }
  destroy() {
    this.dom.window.close();
  }
}
const originalLoad = Module._load;
Module._load = function (name, ...args) {
  return name === "electron"
    ? { app: { isPackaged: true, getPath: () => require("node:os").tmpdir() }, BrowserWindow: Preview, ipcMain: { on() {}, removeListener() {} } }
    : originalLoad.call(this, name, ...args);
};
const { renderCanvas, canvasFrames } = require("../src/canvas.cjs");
const { DesktopController } = require("../src/controller.cjs");
const { readLayout } = require("../src/layout-read.cjs");
Module._load = originalLoad;
function windowFor(dom) {
  return {
    isDestroyed: () => false,
    webContents: {
      getURL: () => "https://studio.example/projects/test",
      session: {},
      mainFrame: {
        framesInSubtree: [
          {
            url: dom.window.location.href,
            executeJavaScript: (script) =>
              vm.runInNewContext(script, documentContext(dom)),
          },
        ],
      },
    },
  };
}

test("a frame-targeted layout read renders an offscreen Page without selecting the overview or changing it", async () => {
  const overview = domFor('<html data-plasmic-frame-uuid="overview-frame"><body><div class="__wab_val_root"><span>Overview content</span></div></body></html>');
  const page = domFor('<html data-plasmic-frame-uuid="page-frame"><body><div class="__wab_val_root"><span>Page content</span></div></body></html>');
  const win = windowFor(overview);
  const visibleFrames = win.webContents.mainFrame.framesInSubtree;
  const originalHtml = overview.window.document.documentElement.outerHTML;
  const calls = [];
  const controller = new DesktopController(() => win, {});
  controller.state = async () => ({ ready: true, projectId: "test", editorContext: { mode: "edit", frameUuid: "overview-frame" } });
  controller.editor = async (method, input) => {
    calls.push({ method, input });
    if (method === "beginCanvasInspection") {
      assert.deepEqual(input, { frameUuid: "page-frame" });
      page.window.document.documentElement.setAttribute("data-plasmic-canvas-inspection", "page-lease");
      visibleFrames.push(windowFor(page).webContents.mainFrame.framesInSubtree[0]);
      return { inspectionId: "page-lease" };
    }
    assert.equal(method, "endCanvasInspection");
    visibleFrames.pop();
    page.window.document.documentElement.removeAttribute("data-plasmic-canvas-inspection");
    return { released: true };
  };
  try {
    const result = await controller.dispatch("snapshot_layout", { frameUuid: "page-frame", view: "full" });
    assert.equal(result.frames.length, 1);
    assert.equal(result.frames[0].frameUuid, "page-frame");
    assert.ok(result.frames[0].elements.some((element) => element.text === "Page content"));
    assert.equal(result.frames[0].elements.some((element) => element.text === "Overview content"), false);
    assert.equal(visibleFrames.length, 1);
    assert.equal(overview.window.document.documentElement.outerHTML, originalHtml);
    assert.deepEqual(calls, [
      { method: "beginCanvasInspection", input: { frameUuid: "page-frame" } },
      { method: "endCanvasInspection", input: { inspectionId: "page-lease" } },
    ]);
  } finally {
    controller.close();
    overview.window.close();
    page.window.close();
  }
});

test("image inspection is scoped to visible business content without hiding real broken images", async () => {
  const dom = domFor('<body><main hidden><img src=""></main><div class="__wab_val_root"><div hidden><img id="hidden" src=""></div><div style="opacity:0"><img src=""></div><img id="business" src=""></div></body>');
  try {
    const [frame] = await canvasFrames(windowFor(dom));
    assert.equal(frame.layout.images.length, 1);
    assert.equal(frame.layout.images[0].loaded, false);
    dom.window.document.querySelector("#business").hidden = true;
    assert.equal((await canvasFrames(windowFor(dom)))[0].layout.images.length, 0);
  } finally { dom.window.close(); }
});

test("layout measures sticky cell controls against native cell padding even when they fit the viewport", async () => {
  const dom = domFor('<div class="__wab_val_root"><table><tbody><tr><td id="actions" style="position:sticky;right:0;padding:8px;border:0"><button id="detail">详情</button><button id="edit">编辑</button><button id="more">更多</button><button hidden>Hidden action</button></td></tr></tbody></table></div>');
  let cellWidth = 136;
  const rect = (x, width) => ({ x, y: 0, left: x, right: x + width, width, height: 30 });
  dom.window.document.querySelector("#actions").getBoundingClientRect = () => rect(200, cellWidth);
  for (const [id, x, width] of [["detail", 208, 42], ["edit", 250, 42], ["more", 292, 60]]) {
    dom.window.document.getElementById(id).getBoundingClientRect = () => rect(x, width);
  }
  try {
    const inspect = async () => readLayout((await canvasFrames(windowFor(dom)))[0].layout, { view: "full" });
    const narrow = await inspect();
    const problem = narrow.problems.find((p) => p.type === "table-cell-control-overflow");
    assert.equal(problem.cellContent.requiredWidth, 160);
    assert.equal(problem.cellContent.paddingRight, 8);
    assert.equal(narrow.elements.some((el) => el.horizontalOverflow), false);
    cellWidth = 160;
    assert.equal((await inspect()).problems.length, 0);
  } finally { dom.window.close(); }
});

test("static export preserves live form values and both scroll axes while removing authored scripts", async () => {
  const source = domFor(
    '<html><head></head><body><div class="__wab_val_root"><input id="input" value="before"><textarea id="textarea">before</textarea><input id="check" type="checkbox"><input id="uncheck" type="checkbox" checked><select id="select"><option value="a" selected>A</option><option value="b">B</option></select><select id="multiple" multiple><option selected>A</option><option>B</option></select><div id="scroll" style="overflow:auto"><div>Content</div></div><button onclick="window.authored=true">Action</button><a href="javascript:window.authored=true">Link</a></div></body></html>',
  );
  const doc = source.window.document;
  doc.querySelector("#input").value = "after";
  doc.querySelector("#textarea").value = "after";
  doc.querySelector("#check").checked = true;
  doc.querySelector("#uncheck").checked = false;
  doc.querySelector("#select").value = "b";
  doc.querySelectorAll("#multiple option")[1].selected = true;
  doc.querySelector("#scroll").scrollLeft = 100;
  doc.querySelector("#scroll").scrollTop = 50;
  const script = doc.createElement("script");
  script.textContent = "window.authored=true";
  doc.head.append(script);
  let captured;
  const destroy = Preview.prototype.destroy;
  Preview.prototype.destroy = function () {
    const d = this.dom.window.document;
    captured = {
      input: d.querySelector("#input").value,
      textarea: d.querySelector("#textarea").value,
      check: d.querySelector("#check").checked,
      uncheck: d.querySelector("#uncheck").checked,
      selected: d.querySelector("#select").value,
      multiple: [...d.querySelectorAll("#multiple option")].map(
        (el) => el.selected,
      ),
      left: d.querySelector("#scroll").scrollLeft,
      top: d.querySelector("#scroll").scrollTop,
      buttonHandler: d.querySelector("button").getAttribute("onclick"),
      link: d.querySelector("a").getAttribute("href"),
      authored: this.dom.window.authored,
    };
    destroy.call(this);
  };
  try {
    const result = await renderCanvas(windowFor(source), { height: 844 });
    assert.deepEqual(captured, {
      input: "after",
      textarea: "after",
      check: true,
      uncheck: false,
      selected: "b",
      multiple: [true, true],
      left: 100,
      top: 50,
      buttonHandler: null,
      link: null,
      authored: undefined,
    });
    // The standalone HTML has the same restoration path, independent of Electron.
    const html = domFor(result.html);
    assert.ok(result.html.indexOf('<meta charset="utf-8">') < 1024);
    assert.equal(
      html.window.document.querySelectorAll("meta[charset]").length,
      1,
    );
    await new Promise((resolve) =>
      html.window.addEventListener("load", resolve, { once: true }),
    );
    assert.equal(html.window.document.querySelector("#scroll").scrollLeft, 100);
    const restorer = html.window.document.querySelector("script");
    assert.equal(html.window.document.querySelectorAll("script").length, 1);
    assert.ok(
      html.window.document
        .querySelector('meta[http-equiv="Content-Security-Policy"]')
        .content.includes(`'nonce-${restorer.nonce}'`),
    );
    html.window.close();
  } finally {
    Preview.prototype.destroy = destroy;
    source.window.close();
  }
});

test("layout checks ignore clipped scrolling content but still detect overflowing containers and visible content", async () => {
  const source = domFor(
    '<html><body><div class="__wab_val_root"><div id="scroll" style="overflow-x:auto"><div id="wide">Wide table</div></div><div id="unclipped">Actual overflow</div></div></body></html>',
  );
  const doc = source.window.document;
  const scroll = doc.querySelector("#scroll");
  Object.defineProperty(scroll, "clientWidth", {
    value: 325,
    configurable: true,
  });
  scroll.getBoundingClientRect = () => ({
    x: 32,
    y: 0,
    left: 32,
    right: 357,
    width: 325,
    height: 20,
  });
  for (const id of ["wide", "unclipped"])
    doc.querySelector(`#${id}`).getBoundingClientRect = () => ({
      x: 32,
      y: 0,
      left: 32,
      right: 832,
      width: 800,
      height: 20,
    });
  const controller = new DesktopController(() => windowFor(source), {});
  controller.ready = async () => {};
  controller.state = async () => ({ ready: true, projectId: "test", editorContext: { mode: "edit", frameUuid: "frame" } });
  try {
    const layout = await controller.dispatch("snapshot_layout", { view: "full" });
    assert.equal(layout.frames[0].problems.length, 1);
    assert.equal(
      layout.frames[0].elements[layout.frames[0].problems[0].index].text,
      "Actual overflow",
    );
    doc.documentElement.style.overflowX = "auto";
    Object.defineProperty(doc, "scrollingElement", {
      value: doc.documentElement,
    });
    Object.defineProperty(doc.documentElement, "clientWidth", { value: 390 });
    const pageScroll = await controller.dispatch("snapshot_layout", { view: "full" });
    assert.equal(pageScroll.frames[0].problems.length, 1);
    scroll.getBoundingClientRect = () => ({
      x: 32,
      y: 0,
      left: 32,
      right: 832,
      width: 800,
      height: 20,
    });
    Object.defineProperty(scroll, "clientWidth", { value: 800 });
    const overflow = await controller.dispatch("snapshot_layout", { view: "full" });
    assert.equal(overflow.frames[0].problems.length, 3);
  } finally {
    controller.close();
    source.window.close();
  }
});

test("exports valid rich text and strips selected column chrome without removing authored styles", async () => {
  const source = domFor(
    '<html data-plasmic-frame-uuid="first"><head><style data-plasmic-editor-style>[data-plasmic-table-column-selected]{background:#e6f4ff;outline:1px solid blue}</style></head><body><main class="__wab_val_root"><p><span class="__wab_rich_text" style="display:block">说明</span></p><p><span class="__wab_rich_text" style="display:block">第二段</span></p><table><tbody><tr><td data-plasmic-table-column-selected="true" style="background:yellow;color:red">待处理</td></tr></tbody></table></main></body></html>',
  );
  try {
    const result = await renderCanvas(windowFor(source), {});
    assert.equal(result.html.includes("data-plasmic-render-ready"), false);
    const standalone = domFor(result.html);
    const doc = standalone.window.document;
    assert.equal(doc.querySelectorAll("p").length, 2);
    assert.equal(doc.querySelector("p").textContent, "说明");
    assert.equal(
      doc.querySelectorAll("[data-plasmic-table-column-selected]").length,
      0,
    );
    assert.equal(doc.querySelector("td").style.background, "yellow");
    assert.equal(doc.querySelector("td").style.color, "rgb(255, 0, 0)");
    assert.equal(result.frameUuid, "first");
    standalone.window.close();
  } finally {
    source.window.close();
  }
});

test("same-sized artboards use explicit frame identity or focused frame and reject ambiguity", async () => {
  const first = domFor(
    '<html data-plasmic-frame-uuid="first"><body><main class="__wab_val_root">First</main></body></html>',
  );
  const second = domFor(
    '<html data-plasmic-frame-uuid="second"><body><main class="__wab_val_root">Second</main></body></html>',
  );
  const win = windowFor(first);
  win.webContents.mainFrame.framesInSubtree.push(
    windowFor(second).webContents.mainFrame.framesInSubtree[0],
  );
  win.webContents.executeJavaScript = async () => ({ frameUuid: "first" });
  try {
    assert.equal((await renderCanvas(win, { width: 390 })).frameUuid, "first");
    assert.equal(
      (await renderCanvas(win, { frameUuid: "second", width: 390 })).frameUuid,
      "second",
    );
    await assert.rejects(
      renderCanvas(win, { frameUuid: "missing" }),
      /not rendered/,
    );
    win.webContents.executeJavaScript = async () => ({ frameUuid: null });
    await assert.rejects(
      renderCanvas(win, { width: 390 }),
      /specify frameUuid/,
    );
  } finally {
    first.window.close();
    second.window.close();
  }
});

test("layout text excludes descendant CSS, scripts and hidden content", async () => {
  const source = domFor(
    '<body><main class="__wab_val_root"><section><style data-plasmic-editor-style>.selected{outline:1px solid blue}</style><script type="application/json">{"secret":"noise"}</script><span style="display:none">Hidden data</span><span data-plasmic-editor-only>Editor hint</span><span>Visible status</span></section></main></body>',
  );
  const controller = new DesktopController(() => windowFor(source), {});
  controller.ready = async () => {};
  controller.state = async () => ({ ready: true, projectId: "test", editorContext: { mode: "edit", frameUuid: "frame" } });
  try {
    const layout = await controller.dispatch("snapshot_layout", { view: "full" });
    const section = layout.frames[0].elements.find(
      (el) => el.tag === "section",
    );
    assert.equal(section.text, "Visible status");
  } finally {
    controller.close();
    source.window.close();
  }
});

test("a code-component artboard without __wab_val_root is ready once Studio signals render-ready", async () => {
  const dom = domFor('<html data-plasmic-frame-uuid="code-frame"><body><div class="AppShell"><span>Shell content</span></div></body></html>');
  const frames = await canvasFrames(windowFor(dom));
  assert.equal(frames.length, 1);
  assert.equal(frames[0].layout.frameUuid, "code-frame");
  assert.ok(frames[0].layout.elements.some((element) => element.text === "Shell content"));
});
test("an artboard without the render-ready signal or a live hash is not ready", async () => {
  const dom = domFor('<html><body><div class="__wab_val_root"><span>Rendering</span></div></body></html>', { renderReady: false });
  await assert.rejects(canvasFrames(windowFor(dom), undefined, undefined, undefined, AbortSignal.timeout(500)), { name: "TimeoutError" });
});
