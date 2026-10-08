const AUTH_PATH = "/desktop/unified-login";
class UnifiedAuthWindow {
  constructor(window, studioOrigin, openBrowser, login) {
    this.window = window;
    this.login = login;
    this.studioOrigin = studioOrigin;
    this.returnUrl = studioOrigin + "/";
    this.openBrowser = openBrowser;
    this.status = { phase: "idle" };
    window.once("closed", () => this.abort?.abort("window-closed"));
  }
  publish(status) {
    this.status = status;
    if (!this.window.isDestroyed()) {
      this.window.webContents.send("desktop:auth-status", status);
    }
  }
  async show(loginUrl) {
    const current = new URL(loginUrl || this.window.webContents.getURL());
    if (current.pathname !== AUTH_PATH) {
      const next = new URL(
        (current.origin === "https://shiguanglab.com" &&
        current.pathname === "/login"
          ? current.searchParams.get("return_to")
          : current.searchParams.get("continueTo")) || "/",
        this.studioOrigin,
      );
      this.returnUrl =
        next.origin === this.studioOrigin &&
        !next.pathname.startsWith("/desktop/")
          ? next.toString()
          : this.studioOrigin + "/";
    }
    if (!this.abort) {
      this.publish({ phase: "idle" });
    }
    await this.window.loadURL(this.studioOrigin + AUTH_PATH);
  }
  async begin() {
    if (this.abort) {
      return;
    }
    const abort = new AbortController();
    this.abort = abort;
    this.authorizationUrl = undefined;
    this.publish({ phase: "opening" });
    try {
      await this.login.start({
        returnUrl: this.returnUrl,
        signal: abort.signal,
        onAuthorizationUrl: (url) => {
          if (!abort.signal.aborted) {
            this.authorizationUrl = url;
          }
        },
        openBrowser: async (url) => {
          await this.openBrowser(url);
          if (!abort.signal.aborted) {
            this.publish({ phase: "waiting" });
          }
        },
      });
      if (abort.signal.aborted) {
        return;
      }
      this.publish({ phase: "success" });
      await this.window.loadURL(this.returnUrl);
      this.window.show();
      this.window.focus();
    } catch (error) {
      if (!abort.signal.aborted) {
        this.publish({ phase: "error", message: error.message });
      }
    } finally {
      if (this.abort === abort) {
        this.abort = undefined;
      }
    }
  }
  async command(command) {
    if (command === "status") {
      return this.status;
    }
    if (command === "sign-in" && this.abort) {
      return this.status;
    }
    if (command === "cancel") {
      this.abort?.abort();
      this.abort = undefined;
      this.authorizationUrl = undefined;
      this.publish({ phase: "idle" });
      return this.status;
    }
    if (
      (command === "sign-in" && this.status.phase === "idle") ||
      (command === "retry" && this.status.phase === "error")
    ) {
      void this.begin();
      return this.status;
    }
    if (command === "open-browser" && this.authorizationUrl && this.abort) {
      const abort = this.abort;
      try {
        await this.openBrowser(this.authorizationUrl);
        if (!abort.signal.aborted) {
          this.publish({ phase: "waiting" });
        }
      } catch (error) {
        if (!abort.signal.aborted) {
          abort.abort();
          this.abort = undefined;
          this.authorizationUrl = undefined;
          this.publish({ phase: "error", message: error.message });
        }
      }
      return this.status;
    }
    throw new Error("Shiguang login action is unavailable");
  }
}
module.exports = { UnifiedAuthWindow, AUTH_PATH };
