const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { setTimeout: delay } = require("node:timers/promises");
const { mcpTransport } = require("./fixtures/mcp.cjs");

async function deadline(promise, label) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(label)), 4000);
    })]);
  } finally { clearTimeout(timer); }
}

for (const kind of ["eof-blocked-output", "signal-blocked-output", "signal-idle", "eof-pending-handshake", "signal-pending-handshake"]) {
  test("native MCP exits on " + kind + " without draining stdout", { timeout: 15000, skip: process.platform === "win32" && (kind.startsWith("signal") || kind.endsWith("handshake")) }, async t => {
    const profile = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-mcp-stdio-"));
    let handshaking;
    if (kind.endsWith("pending-handshake")) {
      const connections = new Set();
      let entered;
      handshaking = new Promise(resolve => { entered = resolve; });
      const listener = require("node:net").createServer(connection => {
        connections.add(connection);
        connection.once("close", () => connections.delete(connection));
        entered(); // Deliberately never reply to the Desktop session handshake.
      });
      const socket = path.join(profile, "handshake.sock");
      await new Promise((resolve, reject) => { listener.once("error", reject); listener.listen(socket, resolve); });
      await fs.writeFile(path.join(profile, "mcp-connection.json"), JSON.stringify({ socket, token: "fixture" }));
      t.after(async () => {
        for (const connection of connections) connection.destroy();
        await new Promise(resolve => listener.close(resolve));
      });
    }
    const { command, args, env } = mcpTransport(profile);
    const child = spawn(command, args, { env, stdio: ["pipe", "pipe", "pipe"] });
    const exited = new Promise((resolve, reject) => {
      child.once("exit", (code, signal) => resolve({ code, signal }));
      child.once("error", reject);
    });
    let output = "", stderr = "";
    child.stderr.on("data", chunk => { stderr += chunk; });
    t.after(async () => {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
      child.stdout.resume();
      await exited;
      await fs.rm(profile, { recursive: true, force: true });
    });
    await deadline(new Promise(resolve => {
      child.stdout.on("data", chunk => {
        output += chunk;
        if (output.includes("serverInfo")) resolve();
      });
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {
        protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "stdio-regression", version: "1" },
      } }) + "\n");
    }), "MCP failed to initialize");
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
    if (handshaking) {
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "get_app_state", arguments: {} } }) + "\n");
      await deadline(handshaking, "Desktop handshake did not start");
    } else if (kind !== "signal-idle") {
      child.stdout.pause();
      for (let id = 2; id < 102; id++) {
        child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method: "tools/list", params: {} }) + "\n");
      }
      await delay(300);
    }
    assert.equal(child.exitCode, null);
    if (kind.startsWith("signal")) child.kill("SIGTERM");
    else child.stdin.end();
    assert.deepEqual(await deadline(exited, "MCP shutdown waited for stdout to drain: " + stderr), { code: 0, signal: null });
    const rows = (await fs.readFile(path.join(profile, "logs/mcp-lifecycle.log"), "utf8")).trim().split("\n").map(JSON.parse);
    assert.ok(rows.some(row => row.pid === child.pid && row.event === "process.start"));
    assert.ok(rows.some(row => row.event === (kind.startsWith("signal") ? "process.signal" : "stdin.eof")));
    assert.equal(rows.at(-1).event, "process.exit");
    assert.equal(rows.at(-1).error, undefined);
  });
}
