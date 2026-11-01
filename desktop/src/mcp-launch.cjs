const path = require("node:path");

function mcpLaunch(app) {
  const directory = app.isPackaged ? path.join(process.resourcesPath, "mcp")
    : path.resolve(__dirname, "../mcp-bin", `${process.platform}-${process.arch}`);
  return {
    command: path.join(directory, process.platform === "win32" ? "plasmic-mcp.exe" : "plasmic-mcp"),
    args: [],
  };
}

module.exports = { mcpLaunch };
