const fs = require("node:fs");
const path = require("node:path");
const { uiError } = require("./ui-error.cjs");

function createDeviceCredentials({ file, safeStorage }) {
  const available = () => {
    if (
      !safeStorage.isEncryptionAvailable() ||
      (process.platform === "linux" &&
        safeStorage.getSelectedStorageBackend?.() === "basic_text")
    ) {
      throw uiError(
        "Secure credential storage is unavailable. Enable your system keyring and try again.",
      );
    }
  };
  return {
    read() {
      if (!fs.existsSync(file)) {
        return undefined;
      }
      available();
      const value = JSON.parse(
        safeStorage.decryptString(fs.readFileSync(file)),
      );
      if (typeof value.refreshToken !== "string" || !value.refreshToken) {
        throw new Error("Invalid stored device credential");
      }
      return value;
    },
    write(value) {
      available();
      const encrypted = safeStorage.encryptString(JSON.stringify(value));
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const temporary = file + ".tmp";
      try {
        fs.writeFileSync(temporary, encrypted, { mode: 0o600 });
        fs.renameSync(temporary, file);
      } finally {
        fs.rmSync(temporary, { force: true });
      }
    },
    clear() {
      fs.rmSync(file, { force: true });
    },
  };
}
module.exports = { createDeviceCredentials };
