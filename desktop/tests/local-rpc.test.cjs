const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { startRpc, requestRpc } = require("../src/local-rpc.cjs");

test("RPC authenticates local clients, returns tool errors and removes its address on stop", async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-rpc-"));
  let calls = 0;
  const stop = await startRpc(profile, async (method, input) => {
    calls++;
    if (method === "fail") throw new Error("Editor rejected input");
    return { method, input };
  });
  try {
    assert.deepEqual(await requestRpc(profile, "read", { id: "page" }), {
      method: "read",
      input: { id: "page" },
    });
    await assert.rejects(requestRpc(profile, "fail"), /Editor rejected input/);
    const address = JSON.parse(
      await fs.readFile(path.join(profile, "mcp-connection.json"), "utf8"),
    );
    if (process.platform !== "win32") {
      assert.equal(
        (await fs.stat(path.join(profile, "mcp-connection.json"))).mode & 0o777,
        0o600,
      );
      assert.equal((await fs.stat(address.socket)).mode & 0o777, 0o600);
    }
    const denied = await new Promise((resolve, reject) => {
      const connection = net.createConnection(address.socket);
      let data = "";
      connection.on("error", reject);
      connection.on("connect", () =>
        connection.write(
          JSON.stringify({ token: "wrong", method: "read" }) + "\n",
        ),
      );
      connection.on("data", (chunk) => (data += chunk));
      connection.on("end", () => resolve(JSON.parse(data)));
    });
    assert.match(denied.error, /Unauthorized/);
    assert.equal(calls, 2);
  } finally {
    await stop();
    await assert.rejects(requestRpc(profile, "read"), /Start Plasmic Desktop/);
    await fs.rm(profile, { recursive: true, force: true });
  }
});
