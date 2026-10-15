const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createDeviceCredentials } = require("../src/device-credentials.cjs");
function fixture(t, overrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "plasmic-credentials-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "credentials");
  const safeStorage = {
    isEncryptionAvailable: () => true,
    encryptString: (value) => Buffer.from(value).map((v) => v ^ 0xa5),
    decryptString: (value) =>
      Buffer.from(value)
        .map((v) => v ^ 0xa5)
        .toString(),
    ...overrides,
  };
  return {
    file,
    safeStorage,
    store: createDeviceCredentials({ file, safeStorage }),
  };
}
test("credentials survive process recreation encrypted on disk and rotate atomically", (t) => {
  const { file, store, safeStorage } = fixture(t);
  assert.equal(store.read(), undefined);
  store.write({ refreshToken: "device-refresh-secret" });
  assert.equal(
    fs.readFileSync(file).includes(Buffer.from("device-refresh-secret")),
    false,
  );
  // Windows stat mode does not expose its ACL; Unix permission bits apply on POSIX.
  if (process.platform !== "win32") {
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  }
  const reopened = createDeviceCredentials({ file, safeStorage });
  assert.deepEqual(reopened.read(), { refreshToken: "device-refresh-secret" });
  reopened.write({ refreshToken: "rotated-secret" });
  assert.deepEqual(store.read(), { refreshToken: "rotated-secret" });
  assert.equal(fs.existsSync(file + ".tmp"), false);
  store.clear();
  assert.equal(reopened.read(), undefined);
});
test("unavailable secure storage never writes plaintext or replaces a saved token", (t) => {
  const { file, store, safeStorage } = fixture(t);
  store.write({ refreshToken: "previous-secret" });
  const before = fs.readFileSync(file);
  safeStorage.isEncryptionAvailable = () => false;
  assert.throws(
    () => store.write({ refreshToken: "new-secret" }),
    /Secure credential storage/,
  );
  assert.deepEqual(fs.readFileSync(file), before);
  assert.equal(fs.existsSync(file + ".tmp"), false);
});
