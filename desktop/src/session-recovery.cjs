const { AUTH_PATH } = require("./unified-auth-window.cjs");

function createSessionRecovery({
  session,
  studioOrigin,
  auth,
  restore,
  isActive = () => true,
}) {
  let pending;
  return async function recover(response, requestUrl) {
    const request = new URL(requestUrl);
    if (
      response.status !== 401 ||
      request.origin !== studioOrigin ||
      !request.pathname.startsWith("/api/v1/") ||
      auth.window.isDestroyed()
    ) {
      return;
    }
    if (!isActive()) {
      return;
    }
    if (pending) {
      return pending;
    }
    const current = new URL(auth.window.webContents.getURL());
    if (current.origin !== studioOrigin || current.pathname === AUTH_PATH) {
      return;
    }
    pending = (async () => {
      // A resource permission failure also uses 401. Only IAM can confirm that
      // the shared login session has expired; never clear a valid session.
      let expired;
      try {
        const status = await session.fetch(studioOrigin + "/api/auth/session", {
          bypassCustomProtocolHandlers: true,
          credentials: "include",
          redirect: "manual",
          cache: "no-store",
        });
        expired =
          status.status === 401 &&
          (await status.json()).authenticated === false;
      } catch {
        return;
      }
      if (!expired || auth.window.isDestroyed()) {
        return;
      }
      if (restore) {
        try {
          if (await restore()) {
            return true;
          }
        } catch {
          // A storage, network, or IAM failure is not a sign-out.
          return;
        }
      }
      const destination = new URL(auth.window.webContents.getURL());
      if (
        destination.origin !== studioOrigin ||
        destination.pathname === AUTH_PATH
      ) {
        return;
      }
      const login = new URL("/login", studioOrigin);
      login.searchParams.set(
        "continueTo",
        destination.pathname + destination.search + destination.hash,
      );
      await auth.show(login.toString(), { sessionExpired: true });
    })();
    try {
      return await pending;
    } finally {
      pending = undefined;
    }
  };
}

module.exports = { createSessionRecovery };
