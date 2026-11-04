const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { attachErrorLog } = require("../src/error-log.cjs");
test("persists renderer errors privately and rotates bounded files", () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "plasmic-errors-"));
  try {
    const contents = new EventEmitter();
    const detach = attachErrorLog(contents, profile, 300);
    contents.emit("console-message", { message: "ordinary output" });
    assert.equal(fs.existsSync(path.join(profile, "logs")), false);
    const detail = { message: "HTTP 503", stack: "original stack", request: { method: "GET", url: "/api/v1/projects" } };
    const emit = () => contents.emit("console-message", { sourceId: "studio.js", message: "Studio operation failed " + JSON.stringify(detail) });
    emit(); emit();
    const file = path.join(profile, "logs", "errors.log");
    assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")).detail, detail);
    assert.ok(fs.existsSync(file + ".1"));
    if (process.platform !== "win32") assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    detach();
    assert.equal(contents.listenerCount("console-message"), 0);
  } finally { fs.rmSync(profile, { recursive: true, force: true }); }
});
