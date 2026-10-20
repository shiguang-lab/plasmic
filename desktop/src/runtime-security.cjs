const productionFuses = {
  enableCookieEncryption: false,
  runAsNode: false,
  enableNodeOptionsEnvironmentVariable: false,
  enableNodeCliInspectArguments: false,
};

function configureProductionRuntime(app) {
  if (!app.isPackaged) return;
  for (const name of [
    "remote-debugging-port",
    "remote-debugging-pipe",
    "remote-debugging-address",
    "remote-allow-origins",
    "auto-open-devtools-for-tabs",
  ]) {
    app.commandLine.removeSwitch(name);
  }
}

module.exports = { productionFuses, configureProductionRuntime };
