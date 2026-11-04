// The parent removes the private Chromium profile only after Electron exits.
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
(async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-background-native-"));
  try {
    process.exitCode = await new Promise((resolve, reject) => {
      const child = spawn(require("electron"), [path.join(__dirname, "background-native-host.cjs")], {
        stdio: "inherit", env: { ...process.env, PLASMIC_BACKGROUND_PROFILE: profile } });
      const timeout = setTimeout(() => child.kill("SIGKILL"), 120000);
      child.on("error", reject); child.on("exit", code => { clearTimeout(timeout); resolve(code ?? 1); });
    });
  } finally { await fs.rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
