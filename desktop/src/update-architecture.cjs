function macUpdateArch(app, arch = process.arch) {
  if (app.runningUnderARM64Translation) return "arm64";
  if (arch !== "arm64" && arch !== "x64") throw new Error("Unsupported macOS architecture");
  return arch;
}

module.exports = { macUpdateArch };
