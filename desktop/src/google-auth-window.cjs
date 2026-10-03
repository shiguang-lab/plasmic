
const AUTH_PATH = "/desktop/google-login";
class GoogleAuthWindow {
  constructor(window, studioOrigin, openBrowser, login) {
    this.window = window;
    this.login = login;
    this.studioOrigin = studioOrigin;
    this.loginUrl = studioOrigin + "/login";
    this.returnUrl = studioOrigin + "/";
    this.openBrowser = openBrowser;
    this.status = { phase: "idle" };
    window.once("closed", () => this.abort?.abort("window-closed"));
  }
  publish(status) {
    this.status = status;
    if (!this.window.isDestroyed())
      this.window.webContents.send("desktop:google-status", status);
  }
  async begin() {
    if (this.abort) return;
    const current = new URL(this.window.webContents.getURL());
    if (current.pathname !== AUTH_PATH) {
      this.loginUrl = current.toString();
      const next = new URL(
        current.searchParams.get("continueTo") || "/",
        this.studioOrigin,
      );
      this.returnUrl =
        next.origin === this.studioOrigin &&
        !next.pathname.startsWith("/desktop/")
          ? next.toString()
          : this.studioOrigin + "/";
    }
    const abort = new AbortController();
    this.abort = abort;
    this.authorizationUrl = undefined;
    this.publish({ phase: "opening" });
    try {
      await this.window.loadURL(this.studioOrigin + AUTH_PATH);
      await this.login.start({
        returnUrl: this.returnUrl,
        signal: abort.signal,
        onAuthorizationUrl: (url) => {
          this.authorizationUrl = url;
        },
        openBrowser: async (url) => {
          await this.openBrowser(url);
          if (this.status.phase !== "success") this.publish({ phase: "waiting" });
        },
      });
      this.publish({ phase: "success" });
      await this.window.loadURL(this.returnUrl);
      this.window.show();
      this.window.focus();
    } catch (error) {
      if (!abort.signal.aborted)
        this.publish({ phase: "error", message: error.message });
    } finally {
      if (this.abort === abort) this.abort = undefined;
    }
  }
  async receiveCallback(url) {
    const waiting = !!this.abort;
    try {
      if (!waiting) {
        await this.window.loadURL(this.studioOrigin + AUTH_PATH);
        this.publish({ phase: "opening" });
      }
      const destination = await this.login.handle(url);
      if (!waiting && destination) {
        this.publish({ phase: "success" });
        await this.window.loadURL(destination);
      }
    } catch (error) {
      this.publish({ phase: waiting && this.login.pending ? "waiting" : "error", message: error.message });
    }
    if (!this.window.isDestroyed()) { this.window.show(); this.window.focus(); }
  }
  async command(command) {
    if (command === "status") return this.status;
    if (command === "cancel") {
      this.abort?.abort();
      this.login.clear();
      await this.window.loadURL(this.loginUrl || this.studioOrigin + "/login");
      return { phase: "idle" };
    }
    if (command === "retry" && this.status.phase === "error") {
      void this.begin();
      return this.status;
    }
    if (command === "open-browser" && this.authorizationUrl && this.abort) {
      try {
        await this.openBrowser(this.authorizationUrl);
        this.publish({ phase: "waiting" });
      } catch (error) {
        this.abort?.abort();
      this.login.clear();
        this.publish({ phase: "error", message: error.message });
      }
      return this.status;
    }
    throw new Error("Google login action is unavailable");
  }
}
module.exports = { GoogleAuthWindow, AUTH_PATH };
