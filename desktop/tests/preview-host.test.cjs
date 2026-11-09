const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(path.join(__dirname, "../src/preview-host.html"), "utf8");
const channel = "plasmic-canvas-preview";

function createHost() {
  const dom = new JSDOM(html, { url: "https://studio.test/static/desktop/preview-host.html", runScripts: "outside-only" });
  const win = dom.window;
  const listeners = new Set();
  const add = win.addEventListener.bind(win), remove = win.removeEventListener.bind(win);
  win.addEventListener = (type, callback, ...args) => {
    if (type === "message") { listeners.add(callback); }
    return add(type, callback, ...args);
  };
  win.removeEventListener = (type, callback, ...args) => {
    if (type === "message") { listeners.delete(callback); }
    return remove(type, callback, ...args);
  };
  let start;
  const results = [], errors = [];
  let frame;
  const assertReleased = () => {
    assert.equal(frame.isConnected, false);
    assert.equal(frame.src, "about:blank");
    assert.equal(frame.onerror, null);
    assert.equal(listeners.size, 0);
    assert.equal(win.document.querySelector("iframe"), null);
  };
  win.desktopPreviewHost = {
    onStart: (callback) => { start = callback; },
    result: (bytes) => { assertReleased(); results.push([...bytes]); },
    fail: (error) => { assertReleased(); errors.push(error); },
  };
  win.eval(win.document.querySelector("script").textContent);
  const request = { projectId: "fixture", revision: 42 };
  start({ src: "https://studio.test/canvas-preview/index.html", request });
  frame = win.document.querySelector("iframe");
  const source = frame.contentWindow;
  const starts = [];
  source.postMessage = (message, origin) => starts.push({ message, origin });
  const message = (data, eventSource = source, origin = win.location.origin) => win.dispatchEvent(new win.MessageEvent("message", { data: { channel, ...data }, source: eventSource, origin }));
  return { dom, win, frame, source, results, errors, starts, request, message, listeners, assertReleased };
}

test("detaches the engine before forwarding the parent-owned PNG and ignores late ready messages", () => {
  const host = createHost();
  try {
    host.message({ type: "ready" });
    assert.equal(host.starts.length, 1);
    assert.equal(host.starts[0].message.channel, channel);
    assert.equal(host.starts[0].message.type, "start");
    assert.equal(host.starts[0].message.request, host.request);
    assert.equal(host.starts[0].origin, "https://studio.test");
    const bytes = new host.win.Uint8Array([137, 80, 78, 71]);
    host.message({ type: "result", bytes: bytes.buffer });
    assert.deepEqual(host.results, [[137, 80, 78, 71]]);
    assert.deepEqual(host.errors, []);
    assert.deepEqual([...bytes], [137, 80, 78, 71]);
    host.message({ type: "ready" });
    host.message({ type: "result", bytes: bytes.buffer });
    assert.equal(host.starts.length, 1);
    assert.equal(host.results.length, 1);
  } finally { host.dom.window.close(); }
});

for (const kind of ["engine", "load"]) {
  test(`detaches and removes listeners before forwarding an ${kind} error`, () => {
    const host = createHost();
    try {
      if (kind === "engine") { host.message({ type: "error", message: "Rejected component" }); }
      else { host.frame.dispatchEvent(new host.win.Event("error")); }
      assert.deepEqual(host.errors, [kind === "engine" ? "Rejected component" : "Canvas preview failed to load"]);
      assert.deepEqual(host.results, []);
      host.message({ type: "ready" });
      assert.equal(host.starts.length, 0);
      assert.equal(host.errors.length, 1);
    } finally { host.dom.window.close(); }
  });
}

test("ignores unrelated messages while retaining the active engine", () => {
  const host = createHost();
  try {
    host.message({ type: "result", bytes: new host.win.ArrayBuffer(1) }, host.win);
    host.message({ type: "error", message: "wrong origin" }, host.source, "https://other.test");
    assert.equal(host.frame.isConnected, true);
    assert.equal(host.listeners.size, 1);
    assert.deepEqual(host.results, []);
    assert.deepEqual(host.errors, []);
    host.message({ type: "error", message: "cleanup" });
    host.assertReleased();
  } finally { host.dom.window.close(); }
});
