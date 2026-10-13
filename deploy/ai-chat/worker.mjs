import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const config = JSON.parse(
  await readFile(
    process.env.PLASMIC_LOCAL_ENV_FILE ??
      path.join(os.homedir(), ".plasmic/local-web-env.json"),
    "utf8",
  ),
);
const env = {
  ...process.env,
  ...config,
  AI_CHAT_BUCKET: config.AI_CHAT_BUCKET ?? "plasmic-ai-chat",
  S3_ENDPOINT: config.S3_ENDPOINT ?? "http://127.0.0.1:8333",
  AWS_ACCESS_KEY_ID: config.AWS_ACCESS_KEY_ID ?? "local-ai-storage",
  AWS_SECRET_ACCESS_KEY:
    config.AWS_SECRET_ACCESS_KEY ?? "local-ai-storage-secret",
  AWS_REGION: "us-east-1",
};
const child = spawn(
  process.execPath,
  [
    "-r",
    "esbuild-register",
    "-r",
    "dotenv/config",
    "src/wab/server/copilot/ai-worker.ts",
  ],
  {
    cwd: new URL("../../platform/wab/", import.meta.url),
    env: { ...env, NODE_ENV: "development" },
    stdio: "inherit",
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
