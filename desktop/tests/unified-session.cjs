const { app, net, session } = require("electron");
const { createServer } = require("node:http");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { consumeSessionTicket } = require("../src/session-ticket.cjs");
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "plasmic-session-test-"));
app.setPath("userData", profile);
let destinationRequests = 0;
let origin;
const server = createServer((req, res) => {
  if (req.url === "/ticket") {
    res.writeHead(302, {
      "Set-Cookie":
        "fixture_session=issued-by-iam; Path=/; HttpOnly; SameSite=Lax",
      Location: origin + "/studio",
    });
  } else if (req.url === "/rejected") {
    res.writeHead(302, { Location: origin + "/untrusted" });
  } else if (req.url === "/invalid") {
    res.writeHead(400);
  } else if (req.url === "/cookie-check") {
    res.end(
      req.headers.cookie === "fixture_session=issued-by-iam"
        ? "authenticated"
        : "unauthenticated",
    );
    return;
  } else {
    destinationRequests++;
    res.writeHead(200);
  }
  res.end();
});
const timeout = setTimeout(() => app.exit(1), 30_000);
app
  .whenReady()
  .then(async () => {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
    const ses = session.fromPartition("session-ticket-fixture");
    await assert.rejects(
      ses.fetch(origin + "/ticket", {
        redirect: "manual",
        credentials: "include",
      }),
      /Redirect was cancelled/,
    );
    await ses.clearStorageData();
    const options = {
      session: ses,
      returnUrl: origin + "/studio",
      request: net.request,
    };
    await consumeSessionTicket({ ...options, url: origin + "/ticket" });
    assert.equal(
      await (
        await ses.fetch(origin + "/cookie-check", { credentials: "include" })
      ).text(),
      "authenticated",
    );
    await assert.rejects(
      consumeSessionTicket({ ...options, url: origin + "/rejected" }),
      /ticket was rejected/,
    );
    await assert.rejects(
      consumeSessionTicket({ ...options, url: origin + "/invalid" }),
      /ticket was rejected/,
    );
    const aborted = new AbortController();
    aborted.abort();
    await assert.rejects(
      consumeSessionTicket({
        ...options,
        url: origin + "/ticket",
        signal: aborted.signal,
      }),
      /cancelled/,
    );
    assert.equal(
      destinationRequests,
      0,
      "Neither accepted nor untrusted destinations should be requested",
    );
    clearTimeout(timeout);
    server.close();
    console.log(
      "Native Electron session redirect, IAM cookie retention, destination validation and cancellation passed",
    );
    app.exit(0);
  })
  .catch((error) => {
    console.error(error);
    server.close();
    app.exit(1);
  });
