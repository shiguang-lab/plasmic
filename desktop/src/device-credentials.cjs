const fs = require("node:fs");
const path = require("node:path");
function createDeviceCredentials({ file }) {
  return {
    read() {
      let value;
      try {
        value = JSON.parse(fs.readFileSync(file, "utf8"));
      } catch (error) {
        if (error.code === "ENOENT" || error instanceof SyntaxError) {
          return undefined;
        }
        throw error;
      }
      if (typeof value?.refreshToken !== "string" || !value.refreshToken) {
        return undefined;
      }
      return { refreshToken: value.refreshToken };
    },
    write(value) {
      if (typeof value?.refreshToken !== "string" || !value.refreshToken) {
        throw new Error("Invalid device credential");
      }
      fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
      const temporary = file + ".tmp";
      let descriptor;
      try {
        descriptor = fs.openSync(temporary, "w", 0o600);
        fs.fchmodSync(descriptor, 0o600);
        fs.writeFileSync(descriptor, JSON.stringify({ refreshToken: value.refreshToken }), "utf8");
        fs.closeSync(descriptor);
        descriptor = undefined;
        fs.renameSync(temporary, file);
      } finally {
        if (descriptor !== undefined) fs.closeSync(descriptor);
        fs.rmSync(temporary, { force: true });
      }
    },
    clear() {
      fs.rmSync(file, { force: true });
    },
  };
}
module.exports = { createDeviceCredentials };
