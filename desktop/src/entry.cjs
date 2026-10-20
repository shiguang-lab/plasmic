const { app } = require("electron");
require("./runtime-security.cjs").configureProductionRuntime(app);
if (process.argv.includes("--mcp")) {
  // A transport process must never initialize the GUI or compete for its lock.
  app.setActivationPolicy?.("prohibited");
  app.dock?.hide();
  const profile = process.env.PLASMIC_DESKTOP_PROFILE ||
    require("node:path").join(app.getPath("appData"), "Plasmic Desktop");
  require("./mcp.cjs").serveMcp(profile).then((server) => {
    process.stdin.once("end", () => {
      void server.close();
      app.quit();
    });
  }).catch((error) => {
    process.stderr.write(error.message + "\n");
    app.exit(1);
  });
} else {
  require("./main.cjs").bootstrap();
}
