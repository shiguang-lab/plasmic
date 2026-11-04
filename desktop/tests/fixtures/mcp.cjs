const { mcpLaunch } = require("../../src/mcp-launch.cjs");

function mcpTransport(profile, options = {}) {
  return { ...mcpLaunch({ isPackaged: false }), stderr: "pipe", ...options,
    env: { ...process.env, ...options.env, PLASMIC_DESKTOP_PROFILE: profile } };
}

module.exports = { mcpTransport };
