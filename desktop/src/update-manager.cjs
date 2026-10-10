const { EventEmitter } = require("node:events");

class UpdateManager extends EventEmitter {
  constructor({ updater, version, enabled, beforeInstall }) {
    super();
    this.updater = updater;
    this.enabled = enabled;
    this.beforeInstall = beforeInstall;
    this.state = {
      phase: enabled ? "idle" : "disabled",
      currentVersion: version,
    };
    // This manager starts downloads on every platform, including the custom macOS updater.
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.allowDowngrade = false;
    updater.allowPrerelease = false;
    updater.on("checking-for-update", () => this.set({ phase: "checking" }));
    updater.on("update-available", (info) =>
      this.set({
        phase: "available",
        version: info.version,
        releaseNotes: info.localizedReleaseNotes || info.releaseNotes,
      }),
    );
    updater.on("update-not-available", () =>
      this.set({
        phase: "current",
        version: undefined,
        releaseNotes: undefined,
      }),
    );
    updater.on("download-progress", (progress) =>
      this.set({ phase: "downloading", percent: Math.floor(progress.percent) }),
    );
    updater.on("update-downloaded", (info) =>
      this.set({
        phase: "downloaded",
        version: info.version,
        percent: 100,
      }),
    );
    updater.on("error", (error) => this.fail(error));
  }
  set(value) {
    if (!this.enabled) return;
    this.state = { ...this.state, ...value };
    this.emit("status", this.state);
  }
  fail(error) {
    if (!this.enabled) return;
    console.warn("Desktop update failed:", error.message);
    this.set({
      phase: "current",
      version: undefined,
      releaseNotes: undefined,
      percent: undefined,
    });
  }
  async command(command) {
    if (command === "status") return this.state;
    if (!this.enabled) return this.state;
    if (!["check", "download", "install"].includes(command))
      throw new Error("Invalid update command");
    if (this.running) return this.running;
    if (
      command === "check" &&
      ["downloaded", "installing"].includes(this.state.phase)
    )
      return this.state;
    if (
      command !== "check" &&
      this.state.phase !== (command === "download" ? "available" : "downloaded")
    )
      return this.state;
    this.running = (async () => {
      try {
        if (command === "check") await this.updater.checkForUpdates();
        if (
          command === "download" ||
          (command === "check" && this.state.phase === "available")
        ) {
          this.set({ phase: "downloading", percent: 0 });
          await this.updater.downloadUpdate();
        }
        if (command === "install") {
          this.set({ phase: "installing" });
          await this.beforeInstall();
          await this.updater.quitAndInstall(false, true);
        }
      } catch (error) {
        this.fail(error);
      }
      return this.state;
    })();
    try {
      return await this.running;
    } finally {
      this.running = undefined;
    }
  }
  start() {
    if (this.state.phase === "disabled") return;
    void this.command("check");
    this.interval = setInterval(
      () => {
        if (["idle", "current", "available"].includes(this.state.phase))
          void this.command("check");
      },
      10 * 60 * 1000,
    );
    this.interval.unref();
  }
  stop() {
    clearInterval(this.interval);
  }
}
module.exports = { UpdateManager };
