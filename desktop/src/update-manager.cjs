const { EventEmitter } = require("node:events");

class UpdateManager extends EventEmitter {
  constructor({ updater, version, enabled, beforeInstall }) {
    super();
    this.updater = updater;
    this.enabled = enabled;
    this.beforeInstall = beforeInstall;
    this.state = { phase: enabled ? "idle" : "disabled", currentVersion: version };
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.allowDowngrade = false;
    updater.allowPrerelease = false;
    updater.on("checking-for-update", () => this.set({ phase: "checking", error: undefined }));
    updater.on("update-available", (info) => this.set({ phase: "available", version: info.version, releaseNotes: info.releaseNotes, error: undefined }));
    updater.on("update-not-available", () => this.set({ phase: "current", version: undefined, releaseNotes: undefined, error: undefined }));
    updater.on("download-progress", (progress) => this.set({ phase: "downloading", percent: Math.floor(progress.percent) }));
    updater.on("update-downloaded", (info) => this.set({ phase: "downloaded", version: info.version, percent: 100, error: undefined }));
    updater.on("error", (error) => this.fail(error));
  }
  set(value) {
    if (!this.enabled) return;
    this.state = { ...this.state, ...value };
    this.emit("status", this.state);
  }
  fail(error) {
    this.set({ phase: "error", error: error.message, retry: this.action || this.lastAction || "check" });
  }
  async command(command) {
    if (command === "status") return this.state;
    if (!this.enabled) return this.state;
    if (!["check", "download", "install"].includes(command)) throw new Error("Invalid update command");
    if (this.running) return this.running;
    if (command === "check" && ["downloaded", "installing"].includes(this.state.phase)) return this.state;
    if (command !== "check" && this.state.phase !== (command === "download" ? "available" : "downloaded") && !(this.state.phase === "error" && this.state.retry === command)) return this.state;
    this.action = command;
    this.lastAction = command;
    this.running = (async () => {
      try {
        if (command === "check") await this.updater.checkForUpdates();
        if (command === "download") {
          this.set({ phase: "downloading", percent: 0, error: undefined });
          await this.updater.downloadUpdate();
        }
        if (command === "install") {
          this.set({ phase: "installing", error: undefined });
          await this.beforeInstall();
          await this.updater.quitAndInstall(false, true);
        }
      } catch (error) { this.fail(error); }
      return this.state;
    })();
    try { return await this.running; }
    finally { this.running = undefined; this.action = undefined; }
  }
  start() {
    if (this.state.phase === "disabled") return;
    this.initial = setTimeout(() => void this.command("check"), 10000);
    this.interval = setInterval(() => {
      if (["idle", "current", "available"].includes(this.state.phase) || (this.state.phase === "error" && this.state.retry === "check")) void this.command("check");
    }, 4 * 60 * 60 * 1000);
    this.initial.unref();
    this.interval.unref();
  }
  stop() { clearTimeout(this.initial); clearInterval(this.interval); }
}
module.exports = { UpdateManager };
