const fs = require("node:fs");
const path = require("node:path");

function lifecycleError(error) {
  return { name: error?.name, code: error?.code,
    message: String(error?.message ?? error).slice(0, 2000),
    stack: error?.stack?.slice(0, 6000) };
}

function createLifecycleLog(profile, maxBytes = 2 * 1024 * 1024) {
  const directory = path.join(profile, "logs");
  const file = path.join(directory, "lifecycle.log");
  return (event, detail = {}) => {
    try {
      fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
      const record = JSON.stringify({ time: new Date().toISOString(), pid: process.pid,
        ppid: process.ppid, event, ...detail }) + "\n";
      if (fs.existsSync(file) && fs.statSync(file).size + Buffer.byteLength(record) > maxBytes) {
        fs.renameSync(file, file + ".1");
      }
      fs.appendFileSync(file, record, { mode: 0o600 });
    } catch {
      // Diagnostics must not prevent startup or shutdown (including a full disk).
    }
  };
}

module.exports = { createLifecycleLog, lifecycleError };
