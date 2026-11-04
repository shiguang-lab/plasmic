// Node-only unit-test double for Electron's process API. Production always uses
// utilityProcess; native acceptance exercises its actual implementation.
const Module = require("node:module");
const path = require("node:path");
const { fork } = require("node:child_process");
if (!process.versions.electron) {
  const load = Module._load;
  Module._load = function (name, parent, ...args) {
    if (name === "electron" && parent.filename.endsWith(path.sep + "background-worker.cjs")) return {
      utilityProcess: { fork(entry) {
        const child = fork(path.join(__dirname, "background-child.cjs"), [entry], { serialization: "advanced", stdio: ["ignore", "pipe", "pipe", "ipc"] });
        child.postMessage = message => child.send(message, error => { if (error) child.kill(); });
        return child;
      } },
    };
    return load.call(this, name, parent, ...args);
  };
}
