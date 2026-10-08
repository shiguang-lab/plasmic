const { test } = require("node:test");
const assert = require("node:assert/strict");
const { forwardRemoteRequest } = require("../src/remote-fetch.cjs");
test("forwarding retains the browser origin, credentials and POST body", async () => {
  const request = new Request("https://studio.example/api/auth/logout", {
    method: "POST",
    referrer: "https://studio.example/projects",
    body: "fixture",
  });
  const session = {
    fetch: async (original, init) => {
      assert.equal(original, request);
      assert.equal(await original.text(), "fixture");
      assert.equal(init.headers.get("origin"), "https://studio.example");
      assert.equal(init.credentials, "include");
      assert.equal(init.bypassCustomProtocolHandlers, true);
      return Response.json({ ok: true });
    },
  };
  assert.equal((await forwardRemoteRequest(session, request)).status, 200);
});
test("forwarding never replaces an existing origin or invents one for GET", async () => {
  for (const options of [
    {
      method: "POST",
      headers: { Origin: "https://untrusted.example" },
      expected: "https://untrusted.example",
    },
    { method: "GET", expected: null },
  ]) {
    const request = new Request("https://studio.example/api/auth/logout", {
      ...options,
      referrer: "https://studio.example/",
    });
    await forwardRemoteRequest(
      {
        fetch: async (_, init) => {
          assert.equal(init.headers.get("origin"), options.expected);
        },
      },
      request,
    );
  }
});
