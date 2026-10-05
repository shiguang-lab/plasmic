const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { setTimeout: delay } = require("node:timers/promises");
const { startRpc, requestRpc } = require("../src/local-rpc.cjs");

test("RPC authenticates local clients, returns tool errors and removes its address on stop", async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-rpc-"));
  let calls = 0;
  const stop = await startRpc(profile, async (method, input) => {
    calls++;
    if (method === "fail") {
      throw new Error("Editor rejected input");
    }
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
    await assert.rejects(requestRpc(profile, "read"), /Start Plasmic/);
    await fs.rm(profile, { recursive: true, force: true });
  }
});

test("RPC preserves request text when a socket chunk splits a UTF-8 character", async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-rpc-"));
  const text = "有效期至 · 客群详情";
  const stop = await startRpc(profile, async (_method, input) => input);
  try {
    const address = JSON.parse(
      await fs.readFile(path.join(profile, "mcp-connection.json"), "utf8"),
    );
    const response = await new Promise((resolve, reject) => {
      const connection = net.createConnection(address.socket);
      connection.setEncoding("utf8");
      let data = "";
      connection.on("error", reject);
      connection.on("data", (chunk) => {
        data += chunk;
      });
      connection.on("end", () => resolve(JSON.parse(data)));
      connection.on("connect", async () => {
        const request = Buffer.from(
          JSON.stringify({
            token: address.token,
            method: "read",
            input: { text },
          }) + "\n",
        );
        const split = request.indexOf(Buffer.from(text)) + 1;
        connection.write(request.subarray(0, split));
        await delay(30);
        connection.write(request.subarray(split));
      });
    });
    assert.deepEqual(response, { result: { text } });
  } finally {
    await stop();
    await fs.rm(profile, { recursive: true, force: true });
  }
});

test("RPC preserves response text when a socket chunk splits a UTF-8 character", async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-rpc-"));
  const text = "有效期至 · 客群详情";
  const socket =
    process.platform === "win32"
      ? "\\\\.\\pipe\\plasmic-rpc-test-" + path.basename(profile)
      : path.join(profile, "response.sock");
  const server = net.createServer((connection) => {
    connection.once("data", async () => {
      const response = Buffer.from(JSON.stringify({ result: { text } }) + "\n");
      const split = response.indexOf(Buffer.from(text)) + 1;
      connection.write(response.subarray(0, split));
      await delay(30);
      connection.end(response.subarray(split));
    });
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(socket, resolve);
  });
  try {
    await fs.writeFile(
      path.join(profile, "mcp-connection.json"),
      JSON.stringify({ socket, token: "test" }),
    );
    assert.deepEqual(await requestRpc(profile, "read"), { text });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(profile, { recursive: true, force: true });
  }
});
