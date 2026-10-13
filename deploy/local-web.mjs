import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath =
  process.env.PLASMIC_LOCAL_ENV_FILE ??
  path.join(os.homedir(), ".plasmic", "local-web-env.json");
const config = JSON.parse(await readFile(configPath, "utf8"));
for (const key of [
  "DATABASE_URI",
  "SG_IDENTITY_API_URL",
  "SG_IDENTITY_API_TOKEN",
  "PLASMIC_DEV_API_USER",
  "PLASMIC_DEV_API_TOKEN",
]) {
  if (typeof config[key] !== "string" || !config[key]) {
    throw new Error(`Missing ${key} in the private local Web configuration`);
  }
}
if (
  !["localhost", "127.0.0.1", "[::1]"].includes(
    new URL(config.DATABASE_URI).hostname,
  )
) {
  throw new Error("Local Web development requires a local database");
}
const env = {
  ...process.env,
  ...config,
  AI_CHAT_BUCKET: config.AI_CHAT_BUCKET ?? "plasmic-ai-chat",
  S3_ENDPOINT: config.S3_ENDPOINT ?? "http://127.0.0.1:8333",
  AWS_ACCESS_KEY_ID: config.AWS_ACCESS_KEY_ID ?? "local-ai-storage",
  AWS_SECRET_ACCESS_KEY: config.AWS_SECRET_ACCESS_KEY ?? "local-ai-storage-secret",
  NODE_ENV: "development",
  BIND_HOST: "127.0.0.1",
  HOSTSERVER_PORT: "3005",
  BACKEND_PORT: "3004",
  PORT: "3003",
  REACT_APP_PUBLIC_URL: "http://localhost:3003",
};
const child = spawn(
  "pnpm",
  [
    "exec",
    "concurrently",
    "--kill-others",
    "--names",
    "backend,host,frontend,ai-worker",
    "pnpm backend",
    "pnpm host-server",
    "pnpm start",
    "pnpm ai-worker",
  ],
  { cwd: path.join(root, "platform", "wab"), env, stdio: "inherit" },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
console.log(
  "Local Web Studio: http://localhost:3003 (database and IAM must be available)",
);
