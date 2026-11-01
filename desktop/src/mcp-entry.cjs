const path = require("node:path");
const { homedir } = require("node:os");

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--version") {
    process.stdout.write(JSON.stringify({ version: require("../package.json").version, node: process.versions.node, platform: process.platform, arch: process.arch }) + "\n");
    return;
  }
  if (args.some(arg => arg !== "--mcp")) throw new Error("Unsupported MCP argument");
  const appData = process.platform === "darwin" ? path.join(homedir(), "Library/Application Support")
    : process.platform === "win32" ? process.env.APPDATA || path.join(homedir(), "AppData/Roaming")
    : process.env.XDG_CONFIG_HOME || path.join(homedir(), ".config");
  const profile = process.env.PLASMIC_DESKTOP_PROFILE || path.join(appData, "Plasmic Desktop");
  const server = await require("./mcp.cjs").serveMcp(profile);
  const onclose = server.onclose;
  server.onclose = () => { onclose?.(); process.exit(0); };
  process.stdin.once("end", () => { void server.close(); });
}

main().catch(error => {
  process.stderr.write(error.message + "\n");
  process.exit(1);
});
