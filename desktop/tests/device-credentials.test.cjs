const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createDeviceCredentials } = require("../src/device-credentials.cjs");
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "plasmic-credentials-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "device-session.json");
  return { file, store: createDeviceCredentials({ file }) };
}
test("credentials survive process recreation as private JSON and rotate atomically", (t) => {
  const { file, store } = fixture(t);
  assert.equal(store.read(), undefined);
  store.write({ refreshToken: "device-refresh-secret" });
  assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")), {
    refreshToken: "device-refresh-secret",
  });
  // Windows stat mode does not expose its ACL; Unix permission bits apply on POSIX.
  if (process.platform !== "win32") {
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  }
  const reopened = createDeviceCredentials({ file });
  assert.deepEqual(reopened.read(), { refreshToken: "device-refresh-secret" });
  reopened.write({ refreshToken: "rotated-secret" });
  assert.deepEqual(store.read(), { refreshToken: "rotated-secret" });
  assert.equal(fs.existsSync(file + ".tmp"), false);
  store.clear();
  assert.equal(reopened.read(), undefined);
});
test("invalid writes preserve saved authorization and never persist access tokens", (t) => {
  const { file, store } = fixture(t);
  store.write({ refreshToken: "previous-secret", accessToken: "memory-only" });
  const before = fs.readFileSync(file);
  assert.deepEqual(JSON.parse(before), { refreshToken: "previous-secret" });
  for (const value of [undefined, null, {}, { refreshToken: "" }, { refreshToken: 1 }]) {
    assert.throws(() => store.write(value), /Invalid device credential/);
    assert.deepEqual(fs.readFileSync(file), before);
  }
  assert.equal(fs.existsSync(file + ".tmp"), false);
});
test("a stale temporary file cannot retain permissive permissions", (t) => {
  const { file, store } = fixture(t);
  fs.writeFileSync(file + ".tmp", "incomplete write", { mode: 0o644 });
  store.write({ refreshToken: "private-secret" });
  assert.deepEqual(store.read(), { refreshToken: "private-secret" });
  if (process.platform !== "win32") assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.equal(fs.existsSync(file + ".tmp"), false);
});
test("malformed session files require normal sign-in without changing the file", (t) => {
  const { file, store } = fixture(t);
  for (const data of ["incomplete-json", "null", "{}", '{"refreshToken":false}']) {
    fs.writeFileSync(file, data);
    assert.equal(store.read(), undefined);
    assert.equal(fs.readFileSync(file, "utf8"), data);
  }
});
test("storage failures preserve the previous credential and propagate", (t) => {
  const { file, store } = fixture(t);
  store.write({ refreshToken: "previous-secret" });
  fs.mkdirSync(file + ".tmp");
  assert.throws(() => store.write({ refreshToken: "new-secret" }));
  assert.deepEqual(store.read(), { refreshToken: "previous-secret" });
  fs.rmSync(file);
  fs.mkdirSync(file);
  assert.throws(() => store.read());
});
