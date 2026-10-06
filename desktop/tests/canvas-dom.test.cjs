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
    requestAnimationFrame: (callback) => callback(),
    setTimeout,
  };
}
function domFor(html) {
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
    ? { BrowserWindow: Preview, ipcMain: { on() {}, removeListener() {} } }
    : originalLoad.call(this, name, ...args);
};
const { renderCanvas } = require("../src/canvas.cjs");
const { DesktopController } = require("../src/controller.cjs");
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
    assert.equal(html.window.document.querySelectorAll("meta[charset]").length, 1);
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
  try {
    const layout = await controller.dispatch("snapshot_layout", {});
    assert.equal(layout.frames[0].problems.length, 1);
    assert.equal(
      layout.frames[0].elements[layout.frames[0].problems[0].index].text,
      "Actual overflow",
    );
    doc.documentElement.style.overflowX = "auto";
    Object.defineProperty(doc, "scrollingElement", { value: doc.documentElement });
    Object.defineProperty(doc.documentElement, "clientWidth", { value: 390 });
    const pageScroll = await controller.dispatch("snapshot_layout", {});
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
    const overflow = await controller.dispatch("snapshot_layout", {});
    assert.equal(overflow.frames[0].problems.length, 3);
  } finally {
    controller.close();
    source.window.close();
  }
});
