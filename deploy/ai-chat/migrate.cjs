const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");

const config = JSON.parse(
  fs.readFileSync(
    process.env.PLASMIC_LOCAL_ENV_FILE ??
      path.join(os.homedir(), ".plasmic/local-web-env.json"),
    "utf8",
  ),
);
if (
  !["localhost", "127.0.0.1", "[::1]"].includes(
    new URL(config.DATABASE_URI).hostname,
  )
) {
  throw new Error("Local AI migration requires a local database");
}
const result = spawnSync(
  process.execPath,
  [
    "-r",
    "esbuild-register",
    "-r",
    "dotenv/config",
    "-e",
    `
const { ensureDbConnections, maybeMigrateDatabase, closeDbConnections } = require('./src/wab/server/db/DbCon');
(async () => { try { await ensureDbConnections(process.env.DATABASE_URI); await maybeMigrateDatabase(); } finally { await closeDbConnections(); } })().catch(error => { console.error(error); process.exitCode = 1; });
`,
  ],
  {
    cwd: path.resolve(__dirname, "../../platform/wab"),
    env: { ...process.env, ...config, NODE_ENV: "development" },
    stdio: "inherit",
  },
);
if (result.error) {
  throw result.error;
}
process.exitCode = result.status ?? 1;
