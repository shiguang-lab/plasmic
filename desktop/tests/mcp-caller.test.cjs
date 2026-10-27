const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const { startRpc } = require("../src/local-rpc.cjs");

test("real MCP handshakes own subsequent calls without identity in tool arguments", async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-mcp-caller-"));
  const calls = [];
  const stop = await startRpc(profile, async (method, input, caller) => {
    calls.push({ method, input, caller }); return {};
  });
  const clients = [];
  const connect = async (info) => {
    const client = new Client({ ...info, version: "1" });
    clients.push(client);
    await client.connect(new StdioClientTransport({ command: process.execPath,
      args: ["-e", `require(${JSON.stringify(require.resolve("../src/mcp.cjs"))}).serveMcp(${JSON.stringify(profile)})`], stderr: "pipe" }));
    return client;
  };
  try {
    const codex = await connect({ name: "codex_cli_rs" }), chatgpt = await connect({ name: "chatgpt" });
    for (const client of [codex, chatgpt, codex]) {
      await client.listTools();
      const result = await client.callTool({ name: "execute", arguments: { name: "read", input: {} } });
      assert.equal(result.isError, false, result.content[0].text);
    }
    assert.deepEqual(calls.map((call) => call.caller.name), ["Codex", "ChatGPT", "Codex"]);
    assert.equal(calls[0].caller.id, calls[2].caller.id);
    assert.notEqual(calls[0].caller.id, calls[1].caller.id);
    assert.ok(calls.every((call) => JSON.stringify(call.input) === '{"name":"read","input":{}}'));
    await codex.close();
    const reconnected = await connect({ name: "codex_cli_rs" });
    await reconnected.callTool({ name: "get_app_state", arguments: {} });
    assert.notEqual(calls[3].caller.id, calls[0].caller.id);
    const other = await connect({ name: "custom-agent", title: "My Agent" });
    await other.callTool({ name: "get_app_state", arguments: {} });
    assert.equal(calls[4].caller.name, "My Agent");
  } finally {
    await Promise.all(clients.map((client) => client.close()));
    await stop(); await fs.rm(profile, { recursive: true, force: true });
  }
});
