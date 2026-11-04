const { app } = require("electron");
require("./runtime-security.cjs").configureProductionRuntime(app);
if (process.argv.includes("--mcp")) {
  // A transport process must never initialize the GUI or compete for its lock.
  app.setActivationPolicy?.("prohibited");
  const { command, args } = require("./mcp-launch.cjs").mcpLaunch(app);
  // Keep the public --mcp entry using the same helper as registered clients.
  // POSIX can replace this process before Electron starts browser services.
  try {
    if (process.platform !== "win32") {
      process.execve(command, [command, ...args], process.env);
    } else {
      // Registered clients launch Go directly. The public Windows entry keeps
      // its inherited pipes attached until the helper exits.
      const child = require("node:child_process").spawn(command, args, { stdio: "inherit", windowsHide: true });
      child.once("error", error => { process.stderr.write(error.message + "\n"); app.exit(1); });
      child.once("exit", (code) => app.exit(code ?? 1));
    }
  } catch (error) {
    process.stderr.write(error.message + "\n");
    app.exit(1);
  }
} else {
  require("./main.cjs").bootstrap();
}
