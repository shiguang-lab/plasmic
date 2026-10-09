const { uiError } = require("./ui-error.cjs");
// Electron fetch rejects manual redirects rather than returning a 302 Response.
// Observe IAM's redirect with the native client, retaining its Set-Cookie without
// requesting the destination through the intercepted desktop asset protocol.
async function consumeSessionTicket({
  session,
  url,
  returnUrl,
  signal,
  request,
}) {
  const createRequest = request || require("electron").net.request;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  const combined = signal
    ? AbortSignal.any([signal, controller.signal])
    : controller.signal;
  try {
    await new Promise((resolve, reject) => {
      if (combined.aborted) return reject(uiError("Sign-in cancelled"));
      const client = createRequest({
        session,
        url,
        redirect: "manual",
        credentials: "include",
        bypassCustomProtocolHandlers: true,
      });
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        combined.removeEventListener("abort", abort);
        client.abort();
        error ? reject(error) : resolve();
      };
      const abort = () => finish(uiError("Sign-in cancelled or timed out"));
      combined.addEventListener("abort", abort, { once: true });
      client.once("redirect", (status, method, destination) => {
        let accepted = false;
        try {
          accepted =
            status === 302 &&
            method === "GET" &&
            new URL(destination).href === returnUrl;
        } catch {}
        finish(
          accepted
            ? undefined
            : uiError("Shiguang session ticket was rejected"),
        );
      });
      client.once("response", (response) => {
        response.resume();
        finish(uiError("Shiguang session ticket was rejected"));
      });
      client.on("error", finish);
      client.end();
    });
    await session.cookies.flushStore();
  } finally {
    clearTimeout(timeout);
  }
}
module.exports = { consumeSessionTicket };
