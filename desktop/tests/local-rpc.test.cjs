const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { setTimeout: delay } = require("node:timers/promises");
const { startRpc, requestRpc, connectRpcSession, MCP_REGISTER_CALLER } = require("../src/local-rpc.cjs");

test("caller identity is registered once, scoped to its lifecycle connection, and retained by accepted work", async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-rpc-callers-"));
  let release, entered;
  const started = new Promise((resolve) => { entered = resolve; });
  const paused = new Promise((resolve) => { release = resolve; });
  const stop = await startRpc(profile, async (method, input, caller) => {
    if (method === "paused") { entered(); await paused; }
    return { input, caller };
  });
  const first = await connectRpcSession(profile), second = await connectRpcSession(profile);
  try {
    await assert.rejects(requestRpc(profile, "read", {}, first.callerId), /not registered/);
    await requestRpc(profile, MCP_REGISTER_CALLER, { clientInfo: { name: "codex_cli_rs", version: "1" } }, first.callerId);
    await requestRpc(profile, MCP_REGISTER_CALLER, { clientInfo: { name: "chatgpt", version: "1" } }, second.callerId);
    await assert.rejects(requestRpc(profile, MCP_REGISTER_CALLER, { clientInfo: { name: "changed" } }, first.callerId), /once per connection/);
    assert.deepEqual(await requestRpc(profile, "read", { value: "same" }, first.callerId), {
      input: { value: "same" }, caller: { id: first.callerId, name: "Codex" },
    });
    const pending = requestRpc(profile, "paused", {}, first.callerId);
    await started;
    const closed = new Promise((resolve) => first.once("close", resolve));
    first.end();
    await closed;
    await assert.rejects(requestRpc(profile, "read", {}, first.callerId), /session has closed/);
    release();
    assert.equal((await pending).caller.name, "Codex");
    assert.equal((await requestRpc(profile, "read", {}, second.callerId)).caller.name, "ChatGPT");
    assert.deepEqual(await requestRpc(profile, "read"), { input: {} }, "unowned script calls do not inherit the last agent");
  } finally {
    release(); first.destroy(); second.destroy();
    await stop(); await fs.rm(profile, { recursive: true, force: true });
  }
});

test("Desktop shutdown disconnects every MCP session even while clients keep their sockets open", async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-rpc-sessions-"));
  const calls = [];
  const stop = await startRpc(profile, async (method) => { calls.push(method); return {}; });
  const sessions = await Promise.all([connectRpcSession(profile), connectRpcSession(profile)]);
  const closed = sessions.map((connection) => new Promise((resolve) => connection.once("close", resolve)));
  try {
    assert.deepEqual(calls, [], "Lifecycle connections never invoke editor operations");
    await requestRpc(profile, "get_app_state");
    assert.deepEqual(calls, ["get_app_state"]);
    await stop();
    await Promise.all(closed);
    assert.ok(sessions.every((connection) => connection.destroyed));
    await assert.rejects(connectRpcSession(profile), /Start Plasmic/);
  } finally {
    for (const connection of sessions) connection.destroy();
    await fs.rm(profile, { recursive: true, force: true });
  }
});

test("MCP sessions reject invalid credentials without reaching the editor", async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-rpc-sessions-"));
  const stop = await startRpc(profile, async () => { throw new Error("Must not dispatch"); });
  try {
    const file = path.join(profile, "mcp-connection.json");
    const address = JSON.parse(await fs.readFile(file, "utf8"));
    await fs.writeFile(file, JSON.stringify({ ...address, token: "wrong" }));
    await assert.rejects(connectRpcSession(profile), /Unauthorized/);
  } finally {
    await stop();
    await fs.rm(profile, { recursive: true, force: true });
  }
});

test("opt-in RPC audit retains complete payloads/errors/images and correlates metrics without logging authentication", async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-rpc-audit-"));
  const previous = { audit: process.env.PLASMIC_RPC_AUDIT, metrics: process.env.PLASMIC_RPC_METRICS };
  process.env.PLASMIC_RPC_AUDIT = path.join(profile, "audit.jsonl");
  process.env.PLASMIC_RPC_METRICS = path.join(profile, "metrics.jsonl");
  const result = { data: "complete-image-base64", nested: { text: "完整返回体" } };
  const stop = await startRpc(profile, async (method) => {
    if (method === "fail") throw Object.assign(new Error("wrong mode"), { context: { code: "CONTEXT_MISMATCH" } });
    return result;
  });
  try {
    const input = { name: "read", source: "完整请求体" };
    await requestRpc(profile, "execute", input);
    await assert.rejects(requestRpc(profile, "fail"), /wrong mode/);
    const rows = (await fs.readFile(process.env.PLASMIC_RPC_AUDIT, "utf8")).trim().split("\n").map(JSON.parse);
    const metrics = (await fs.readFile(process.env.PLASMIC_RPC_METRICS, "utf8")).trim().split("\n").map(JSON.parse);
    const { token } = JSON.parse(await fs.readFile(path.join(profile, "mcp-connection.json")));
    assert.deepEqual(rows[0].input, input); assert.deepEqual(rows[0].response, { result });
    assert.equal(rows[1].response.error.code, "CONTEXT_MISMATCH");
    assert.equal(rows[0].requestId, metrics[0].requestId); assert.notEqual(rows[0].requestId, rows[1].requestId);
    assert.ok(rows.every((row) => row.ms >= 0));
    assert.ok(!JSON.stringify(rows).includes(token));
    if (process.platform !== "win32") assert.equal((await fs.stat(process.env.PLASMIC_RPC_AUDIT)).mode & 0o777, 0o600);
  } finally {
    for (const [key, value] of [["PLASMIC_RPC_AUDIT", previous.audit], ["PLASMIC_RPC_METRICS", previous.metrics]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    await stop(); await fs.rm(profile, { recursive: true, force: true });
  }
});

test("opt-in metrics count script RPC bytes without retaining content or credentials", async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-rpc-metrics-"));
  const previous = process.env.PLASMIC_RPC_METRICS;
  process.env.PLASMIC_RPC_METRICS = path.join(profile, "metrics.jsonl");
  const result = { secret: "never-record-returned-content" };
  const stop = await startRpc(profile, async () => result);
  try {
    const input = { name: "read", privateValue: "never-record-input-content" };
    await requestRpc(profile, "execute", input);
    const text = await fs.readFile(process.env.PLASMIC_RPC_METRICS, "utf8");
    const record = JSON.parse(text);
    assert.equal(record.operation, "read");
    assert.equal(record.inputBytes, Buffer.byteLength(JSON.stringify(input)));
    assert.equal(record.responseBytes, Buffer.byteLength(JSON.stringify({ result })));
    assert.equal(record.failed, false);
    assert.ok(!text.includes("never-record") && !text.includes("token"));
    const project = { name: "never-record-project-name" };
    await requestRpc(profile, "create_project", project);
    const all = await fs.readFile(process.env.PLASMIC_RPC_METRICS, "utf8");
    const creation = all.trim().split("\n").map(JSON.parse)[1];
    assert.equal(creation.method, "create_project");
    assert.equal(creation.operation, undefined);
    assert.equal(creation.inputBytes, Buffer.byteLength(JSON.stringify(project)));
    assert.ok(!all.includes("never-record"));
  } finally {
    if (previous === undefined) delete process.env.PLASMIC_RPC_METRICS;
    else process.env.PLASMIC_RPC_METRICS = previous;
    await stop();
    await fs.rm(profile, { recursive: true, force: true });
  }
});

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
    assert.match(denied.error.message, /Unauthorized/);
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
