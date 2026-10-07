import { readFile } from "node:fs/promises";
export async function nasConfig() {
  const config = JSON.parse(await readFile(new URL("../desktop.config.json", import.meta.url), "utf8"));
  config.nasHost = process.env.PLASMIC_NAS_HOST || config.nasHost;
  config.nasDeployDir = process.env.PLASMIC_NAS_DEPLOY_DIR || config.nasDeployDir;
  const port = process.env.PLASMIC_NAS_SSH_PORT || "22";
  if (!/^[a-zA-Z0-9@._-]+$/.test(config.nasHost) || !/^\/[a-zA-Z0-9/._-]+$/.test(config.nasDeployDir) ||
      !/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error("Invalid NAS SSH configuration");
  return { ...config, sshArgs: ["-o", "BatchMode=yes", "-p", port, config.nasHost] };
}
