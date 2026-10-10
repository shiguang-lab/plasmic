// Run with Electron to inspect native MCP settings using an isolated temporary profile.
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const root = path.resolve(__dirname, "..");
const { McpIntegrations } = require(
  path.join(root, "src/mcp-integrations.cjs"),
);
const { createMcpSettings } = require(path.join(root, "src/mcp-settings.cjs"));
const { createDesktopAppearance } = require(
  path.join(root, "src/ui-appearance.cjs"),
);
const { createDesktopI18n } = require(path.join(root, "src/i18n.cjs"));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "plasmic-native-ui-"));
app.setPath("userData", profile);
app.setName("Plasmic UI acceptance");
let parent;
app.whenReady().then(() => {
  parent = new BrowserWindow({
    width: 900,
    height: 800,
    title: "Plasmic UI acceptance",
    backgroundColor: "#15161b",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  const integrations = new McpIntegrations({
    userData: profile,
    home: path.join(profile, "home"),
    env: {},
    command: process.execPath,
    args: [path.join(root, "src/entry.cjs"), "--mcp"],
  });
  integrations.set("codex", true);
  const appearance = createDesktopAppearance();
  appearance.set(process.argv.includes("--light") ? "light" : "dark");
  const i18n = createDesktopI18n(path.join(root, "renderer/ui-locales"), [
    "zh-CN",
  ]);
  createMcpSettings(integrations, () => parent, i18n, appearance)();
  console.log("Native UI fixture:", profile);
});
app.on("window-all-closed", () => app.quit());
