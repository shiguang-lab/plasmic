const { uiError } = require("./ui-error.cjs");
const { randomBytes, createHash, timingSafeEqual } = require("node:crypto");
const { consumeSessionTicket } = require("./session-ticket.cjs");
const { EventEmitter } = require("node:events");
const AUTH_ORIGIN = "https://shiguanglab.com";
const CLIENT_ID = "plasmicapp";
const REDIRECT_URI = AUTH_ORIGIN + "/auth/apps/" + CLIENT_ID + "/callback";
const APP_CALLBACK_URL = "plasmic-desktop://oauth/callback";

class DesktopUnifiedLogin extends EventEmitter {
  constructor({ session, studioOrigin, request, credentials, now = Date.now }) {
    super();
    this.credentials = credentials;
    this.now = now;
    this.lastActivity = -Infinity;
    this.expiresAt = 0;
    this.session = session;
    this.studioOrigin = studioOrigin;
    this.request = request;
  }
  async start({ returnUrl, openBrowser, signal, onAuthorizationUrl }) {
    const target = new URL(returnUrl);
    if (
      target.origin !== this.studioOrigin ||
      target.pathname.startsWith("/desktop/")
    ) {
      throw uiError("Invalid sign-in destination");
    }
    if (signal?.aborted) {
      throw uiError("Sign-in cancelled");
    }
    const verifier = randomBytes(32).toString("base64url");
    const state = randomBytes(32).toString("base64url");
    let finish, fail;
    const callback = new Promise((resolve, reject) => {
      finish = resolve;
      fail = reject;
    });
    callback.catch(() => {});
    if (this.signingIn) {
      throw uiError("Sign-in already in progress");
    }
    this.signingIn = true;
    this.emit("session-changed");
    try {
      await this.restoring;
    } catch {}
    if (signal?.aborted) {
      this.signingIn = false;
      throw uiError("Sign-in cancelled");
    }
    this.pending = { state, finish, fail };
    const abort = () => fail(uiError("Sign-in cancelled"));
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(
      () => fail(uiError("Sign-in timed out. Please try again.")),
      10 * 60_000,
    );
    try {
      const redirectUri = REDIRECT_URI;
      const url = new URL("/oauth/authorize", AUTH_ORIGIN);
      for (const [key, value] of Object.entries({
        client_id: CLIENT_ID,
        response_type: "code",
        redirect_uri: redirectUri,
        scope: "web:session offline_access",
        state,
        code_challenge_method: "S256",
        code_challenge: createHash("sha256")
          .update(verifier)
          .digest("base64url"),
      })) {
        url.searchParams.set(key, value);
      }
      onAuthorizationUrl?.(url.href);
      await openBrowser(url.href);
      const code = await callback;
      if (signal?.aborted) {
        throw uiError("Sign-in cancelled");
      }
      const tokens = await this.post(
        "/oauth/token",
        {
          grant_type: "authorization_code",
          client_id: CLIENT_ID,
          code,
          redirect_uri: redirectUri,
          code_verifier: verifier,
        },
        signal,
      );
      await this.establish(tokens, target.href, signal);
      return target.href;
    } finally {
      this.signingIn = false;
      this.emit("session-changed");
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      if (this.pending?.state === state) {
        this.pending = undefined;
      }
    }
  }
  async establish(tokens, returnUrl, signal) {
    if (
      tokens.token_type?.toLowerCase() !== "bearer" ||
      typeof tokens.access_token !== "string" ||
      !tokens.access_token
    ) {
      throw uiError("Invalid Shiguang token response");
    }
    if (this.credentials) {
      if (
        typeof tokens.refresh_token !== "string" ||
        !tokens.refresh_token ||
        !Number.isFinite(tokens.expires_in) ||
        tokens.expires_in <= 0
      ) {
        throw uiError("Invalid Shiguang token response");
      }
      this.credentials.write({ refreshToken: tokens.refresh_token });
    }
    const ticket = await this.post(
      "/oauth/web-session-ticket",
      { return_to: returnUrl },
      signal,
      tokens.access_token,
    );
    // IAM alone sets cookies; refresh credentials stay in the main process.
    const ticketUrl = new URL(ticket.url);
    if (
      ticketUrl.origin !== AUTH_ORIGIN ||
      ticketUrl.pathname !== "/oauth/web-session" ||
      !ticketUrl.searchParams.get("ticket")
    ) {
      throw uiError("Invalid Shiguang session ticket");
    }
    await consumeSessionTicket({
      session: this.session,
      url: ticketUrl.href,
      returnUrl: returnUrl,
      signal,
      request: this.request,
    });
    this.expiresAt =
      this.now() + Math.max(0, (tokens.expires_in || 0) * 1000 - 60_000);
  }
  isActive() {
    return this.now() - this.lastActivity < 60_000;
  }
  noteActivity() {
    const wasActive = this.isActive();
    this.lastActivity = this.now();
    return this.restore({ force: !wasActive });
  }
  async restore({ force = false } = {}) {
    if (this.restoring) {
      const active = this.restoringActive;
      const restored = await this.restoring;
      if (restored && force && this.isActive() && !active) {
        return this.restore({ force: true });
      }
      return restored;
    }
    if (!this.credentials || this.signingIn || this.signingOut) {
      return false;
    }
    if (!force && this.expiresAt > this.now()) {
      return true;
    }
    const stored = this.credentials.read();
    if (!stored) {
      return false;
    }
    const userActivity = this.isActive();
    this.restoringActive = userActivity;
    this.restoring = (async () => {
      let tokens;
      try {
        tokens = await this.post("/oauth/token", {
          grant_type: "refresh_token",
          client_id: CLIENT_ID,
          refresh_token: stored.refreshToken,
          user_activity: String(userActivity),
        });
      } catch (error) {
        if (error.oauthError === "invalid_grant") {
          this.credentials.clear();
          this.expiresAt = 0;
          this.emit("session-changed");
          return false;
        }
        throw error;
      }
      await this.establish(tokens, this.studioOrigin + "/");
      return true;
    })();
    try {
      return await this.restoring;
    } finally {
      this.restoring = undefined;
    }
  }
  async signOut() {
    this.signingOut = true;
    this.emit("session-changed");
    // Wait for a rotation before reading the credential to revoke.
    try {
      await this.restoring;
    } catch {}
    try {
      const stored = this.credentials?.read();
      if (stored) {
        await this.post("/oauth/revoke", { token: stored.refreshToken });
      }
    } finally {
      this.credentials?.clear();
      this.expiresAt = 0;
      this.signingOut = false;
      this.emit("session-changed");
    }
  }
  acceptCallback(raw) {
    let url;
    try {
      url = new URL(raw);
    } catch {
      return false;
    }
    const supplied = url.searchParams.get("state") || "";
    const pending = this.pending;
    if (
      !pending ||
      url.searchParams.getAll("state").length !== 1 ||
      url.searchParams.getAll("code").length > 1 ||
      url.searchParams.getAll("error").length > 1 ||
      (url.searchParams.has("error") && url.searchParams.has("code")) ||
      url.protocol !== "plasmic-desktop:" ||
      url.host !== "oauth" ||
      url.pathname !== "/callback" ||
      url.username ||
      url.password ||
      url.hash ||
      !/^[A-Za-z0-9_-]{43}$/.test(supplied) ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(pending.state))
    ) {
      return false;
    }
    const code = url.searchParams.get("code");
    if (
      !url.searchParams.has("error") &&
      !/^[A-Za-z0-9_-]{43}$/.test(code || "")
    ) {
      return false;
    }
    this.pending = undefined;
    if (url.searchParams.has("error")) {
      pending.fail(
        uiError(
          url.searchParams.get("error") === "access_denied"
            ? "Shiguang sign-in was cancelled"
            : "Shiguang sign-in was not completed",
        ),
      );
    } else {
      pending.finish(code);
    }
    return true;
  }
  async post(path, form, signal, accessToken) {
    const response = await this.session.fetch(AUTH_ORIGIN + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: new URLSearchParams(form).toString(),
      bypassCustomProtocolHandlers: true,
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(30_000)])
        : AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      const error = uiError("Shiguang authorization returned {status}", {
        status: response.status,
      });
      const data = await response.json().catch(() => ({}));
      error.oauthError = data.error;
      throw error;
    }
    return response.json();
  }
}
module.exports = {
  DesktopUnifiedLogin,
  AUTH_ORIGIN,
  CLIENT_ID,
  REDIRECT_URI,
  APP_CALLBACK_URL,
};
