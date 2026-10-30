const { EventEmitter } = require("node:events");

// Main-process verification shared by native account UI and draft authorization.
class DesktopIdentity extends EventEmitter {
  constructor({ session, studioOrigin, prepare, fetchIdentity, now = Date.now }) {
    super();
    this.prepare = prepare;
    this.fetchIdentity = fetchIdentity;
    this.now = now;
    this.epoch = 0;
    this.cookies = session.cookies;
    const host = new URL(studioOrigin).hostname;
    const values = new Map();
    const key = cookie => `${cookie.domain}:${cookie.path}:${cookie.name}`;
    this.cookieChanged = (_event, cookie, cause, removed) => {
      const domain = cookie.domain.replace(/^\./, "");
      if (!cookie.httpOnly || !(host === domain || host.endsWith(`.${domain}`)) || removed && cause === "overwrite") return;
      const id = key(cookie), next = removed ? null : cookie.value;
      if (values.get(id) === next) return;
      values.set(id, next);
      this.invalidate();
    };
    this.cookies.on("changed", this.cookieChanged);
    void this.cookies.get({ url: studioOrigin }).then(items => {
      for (const cookie of items) {
        if (cookie.httpOnly && !values.has(key(cookie))) values.set(key(cookie), cookie.value);
      }
    }).catch(() => {});
  }
  expire() {
    this.value = undefined;
    this.until = 0;
  }
  invalidate() {
    this.epoch++;
    this.expire();
    this.pending = undefined;
    this.emit("changed");
  }
  async read() {
    try {
      await this.prepare();
    } catch (error) {
      this.invalidate();
      throw error;
    }
    if (this.pending) return this.pending;
    if (this.value && this.now() < this.until) return this.value;
    const epoch = this.epoch;
    const pending = Promise.resolve().then(() => this.fetchIdentity()).then(value => {
      if (epoch !== this.epoch) throw new Error("Desktop identity changed; retry the operation");
      // Only a server-verified signed-in identity can authorize a later draft read.
      if (typeof value?.user?.id === "string" && value.user.id) {
        this.value = value;
        this.until = this.now() + 30_000;
      }
      return value;
    }).finally(() => {
      if (this.pending === pending) this.pending = undefined;
    });
    this.pending = pending;
    return pending;
  }
  dispose() {
    this.cookies.removeListener("changed", this.cookieChanged);
    this.removeAllListeners();
    this.invalidate();
  }
}
module.exports = { DesktopIdentity };
