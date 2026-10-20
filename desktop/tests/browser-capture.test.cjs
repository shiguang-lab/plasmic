const { test } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const { PNG } = require("pngjs");
const sharp = require("sharp");
const png = PNG.sync.write(new PNG({ width: 320, height: 200 }));
const windows = [];
class Window {
  constructor(options) {
    assert.equal(options.webPreferences.devTools, false);
    this.options = options;
    this.destroyed = false;
    this.webContents = {
      setWindowOpenHandler: (handler) => {
        this.popup = handler;
      },
      on: () => {},
      getURL: () => this.url,
      getTitle: () => "Reference",
      executeJavaScriptInIsolatedWorld: async () => ({
        url: this.url,
        title: "Reference",
        html: "<main>Example</main>",
        rect: { x: 0, y: 0, width: 320, height: 200 },
      }),
      capturePage: async () => ({
        getSize: () => ({ width: 320, height: 200 }),
        toPNG: () => png,
      }),
      debugger: {
        isAttached: () => true,
        sendCommand: async (method, params) => ({ method, params }),
      },
    };
    windows.push(this);
  }
  async loadURL(url) {
    this.url = url;
  }
  setContentSize(width, height) {
    this.size = [width, height];
  }
  isDestroyed() {
    return this.destroyed;
  }
  destroy() {
    this.destroyed = true;
  }
}
const original = Module._load;
Module._load = function (name, ...args) {
  return name === "electron"
    ? { app: { isPackaged: true }, BrowserWindow: Window }
    : original.call(this, name, ...args);
};
const { captureBrowser } = require("../src/browser-capture.cjs");
Module._load = original;
test("stateless reference capture always destroys its window and rejects credential URLs", async () => {
  await assert.rejects(
    captureBrowser({ url: "https://name:secret@example.org" }),
    /credentials/,
  );
  const result = await captureBrowser({ url: "https://example.org" });
  assert.equal(result.width, 320);
  assert.equal(result.mimeType, "image/webp");
  assert.equal(result.encoding, "lossy");
  assert.equal((await sharp(Buffer.from(result.data, "base64")).metadata()).format, "webp");
  assert.equal(windows.at(-1).destroyed, true);
  const full = await captureBrowser({ url: "https://example.org", fullResolution: true });
  assert.equal(full.encoding, "lossless");
  assert.equal(windows.at(-1).destroyed, true);
});
