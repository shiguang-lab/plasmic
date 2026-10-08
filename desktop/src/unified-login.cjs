const { randomBytes, createHash, timingSafeEqual } = require("node:crypto");
const { createServer } = require("node:http");
const { sendLoginResult } = require("./login-result.cjs");
const { consumeSessionTicket } = require("./session-ticket.cjs");
const AUTH_ORIGIN = "https://shiguanglab.com";
const CLIENT_ID = "plasmicapp";

class DesktopUnifiedLogin {
  constructor({ session, studioOrigin, request }) {
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
      throw new Error("Invalid sign-in destination");
    }
    if (signal?.aborted) {
      throw new Error("Sign-in cancelled");
    }
    const verifier = randomBytes(32).toString("base64url");
    const state = randomBytes(32).toString("base64url");
    let finish, fail;
    const callback = new Promise((resolve, reject) => {
      finish = resolve;
      fail = reject;
    });
    callback.catch(() => {});
    let consumed = false;
    let browserResponse;
    const server = createServer((req, res) => {
      let url;
      try {
        url = new URL(req.url, "http://127.0.0.1");
      } catch {
        res.writeHead(400);
        res.end("Invalid authorization callback");
        return;
      }
      const supplied = url.searchParams.get("state") || "";
      if (
        req.method !== "GET" ||
        url.pathname !== "/callback" ||
        req.headers.host !== `127.0.0.1:${server.address().port}` ||
        !/^[A-Za-z0-9_-]{43}$/.test(supplied) ||
        !timingSafeEqual(Buffer.from(supplied), Buffer.from(state)) ||
        consumed
      ) {
        res.writeHead(400);
        res.end("Invalid authorization callback");
        return;
      }
      consumed = true;
      browserResponse = res;
      const code = url.searchParams.get("code");
      if (url.searchParams.has("error") || !code) {
        fail(new Error("Shiguang sign-in was not completed"));
      } else {
        finish(code);
      }
    });
    const abort = () => fail(new Error("Sign-in cancelled"));
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(
      () => fail(new Error("Sign-in timed out. Please try again.")),
      10 * 60_000,
    );
    try {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
      });
      const redirectUri = `http://127.0.0.1:${server.address().port}/callback`;
      const url = new URL("/oauth/authorize", AUTH_ORIGIN);
      for (const [key, value] of Object.entries({
        client_id: CLIENT_ID,
        response_type: "code",
        redirect_uri: redirectUri,
        scope: "web:session",
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
        throw new Error("Sign-in cancelled");
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
      if (
        tokens.token_type?.toLowerCase() !== "bearer" ||
        typeof tokens.access_token !== "string" ||
        !tokens.access_token
      ) {
        throw new Error("Invalid Shiguang token response");
      }
      const ticket = await this.post(
        "/oauth/web-session-ticket",
        { return_to: target.href },
        signal,
        tokens.access_token,
      );
      // OAuth credentials stay in this function; only IAM sets the shared cookie.
      const ticketUrl = new URL(ticket.url);
      if (
        ticketUrl.origin !== AUTH_ORIGIN ||
        ticketUrl.pathname !== "/oauth/web-session" ||
        !ticketUrl.searchParams.get("ticket")
      ) {
        throw new Error("Invalid Shiguang session ticket");
      }
      await consumeSessionTicket({
        session: this.session,
        url: ticketUrl.href,
        returnUrl: target.href,
        signal,
        request: this.request,
      });
      if (!browserResponse.destroyed)
        await sendLoginResult(browserResponse, true);
      browserResponse = undefined;
      return target.href;
    } catch (error) {
      if (browserResponse && !browserResponse.destroyed) {
        await sendLoginResult(browserResponse, false);
      }
      throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      server.close();
      server.closeAllConnections();
    }
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
      throw new Error(`Shiguang authorization returned ${response.status}`);
    }
    return response.json();
  }
}
module.exports = { DesktopUnifiedLogin, AUTH_ORIGIN, CLIENT_ID };
