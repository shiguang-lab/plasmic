const { mcpTransport } = require("./fixtures/mcp.cjs");
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
    await client.connect(new StdioClientTransport(mcpTransport(profile)));
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

test("MCP cancellation and session disconnect reach only their own running RPC", { timeout: 10000 }, async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-mcp-cancel-"));
  const calls = [];
  let nextCall;
  const waitForCall = () => new Promise(resolve => { nextCall = resolve; });
  const stop = await startRpc(profile, async (_method, _input, caller, signal) => {
    let release, aborted;
    const released = new Promise(resolve => { release = resolve; });
    const cancelled = new Promise(resolve => { aborted = resolve; });
    signal.addEventListener("abort", aborted, { once: true });
    const call = { caller, signal, release, cancelled };
    calls.push(call); nextCall(call);
    await released;
    return {};
  });
  const clients = [];
  const connect = async name => {
    const client = new Client({ name, version: "1" }); clients.push(client);
    await client.connect(new StdioClientTransport(mcpTransport(profile)));
    return client;
  };
  try {
    const first = await connect("codex"), second = await connect("chatgpt");
    const abort = new AbortController();
    let entered = waitForCall();
    const a = first.callTool({ name: "get_app_state", arguments: {} }, undefined, { signal: abort.signal });
    const failed = assert.rejects(a);
    const firstCall = await entered;
    entered = waitForCall();
    const b = second.callTool({ name: "get_app_state", arguments: {} });
    const secondCall = await entered;
    abort.abort();
    await failed; await firstCall.cancelled;
    assert.equal(secondCall.signal.aborted, false);
    firstCall.release(); secondCall.release(); await b;
    entered = waitForCall();
    const disconnected = second.callTool({ name: "get_app_state", arguments: {} });
    const closed = assert.rejects(disconnected);
    const lastCall = await entered;
    await second.close(); await closed; await lastCall.cancelled;
    assert.equal(lastCall.signal.aborted, true);
  } finally {
    calls.forEach(call => call.release());
    await Promise.all(clients.map(client => client.close()));
    await stop(); await fs.rm(profile, { recursive: true, force: true });
  }
});

test("STDIO starts offline and reconnects each caller on demand after Desktop restarts", { timeout: 15000 }, async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-mcp-reconnect-"));
  const clients = [], transports = [];
  const calls = [];
  let stop;
  const start = () => startRpc(profile, async (method, input, caller) => {
    calls.push({ method, input, caller });
    return method === "execute" ? { text: "snapshot".repeat(20000) } : { caller };
  });
  const decoded = result => JSON.parse(result.content[0].text);
  try {
    for (const name of ["codex", "chatgpt"]) {
      const client = new Client({ name, version: "1" });
      const transport = new StdioClientTransport(mcpTransport(profile, { env: { ...process.env, PLASMIC_DESKTOP_PROFILE: profile } }));
      clients.push(client); transports.push(transport);
      await client.connect(transport);
      assert.ok((await client.listTools()).tools.length);
    }
    const pids = transports.map(transport => transport.pid);
    const offline = await clients[0].callTool({ name: "get_app_state", arguments: {} });
    assert.equal(offline.isError, true);
    assert.equal(decoded(offline).detail.code, "DESKTOP_UNAVAILABLE");
    assert.equal(decoded(offline).detail.operationExecuted, false);

    stop = await start();
    await Promise.all([0, 0, 1].map(index => clients[index].callTool({ name: "get_app_state", arguments: {} })));
    const codexCalls = calls.filter(call => call.caller.name === "Codex");
    assert.equal(codexCalls.length, 2);
    assert.equal(codexCalls[0].caller.id, codexCalls[1].caller.id, "Concurrent calls share a single registered session");
    assert.notEqual(codexCalls[0].caller.id, calls.find(call => call.caller.name === "ChatGPT").caller.id);
    const firstCaller = codexCalls[0].caller.id;
    const ref = decoded(await clients[0].callTool({ name: "execute", arguments: { name: "read", input: {} } }));
    await stop(); stop = undefined;
    const snapshot = await clients[0].callTool({ name: "read_result", arguments: { resultId: ref.resultId } });
    assert.equal(snapshot.isError, false, "Detached snapshots remain readable while Desktop is offline");
    const failed = await clients[0].callTool({ name: "get_app_state", arguments: {} });
    assert.equal(failed.isError, true);
    assert.equal(decoded(failed).detail.operationExecuted, false);
    stop = await start();
    for (const client of clients) {
      const result = await client.callTool({ name: "get_app_state", arguments: {} });
      assert.equal(result.isError, false, result.content[0].text);
    }
    assert.notEqual(calls.at(-2).caller.id, firstCaller);
    assert.notEqual(calls.at(-2).caller.id, calls.at(-1).caller.id);
    assert.deepEqual(transports.map(transport => transport.pid), pids, "The same STDIO processes survive restart");
    assert.equal(calls.filter(call => call.method === "execute").length, 1);
  } finally {
    await Promise.all(clients.map(client => client.close()));
    await stop?.(); await fs.rm(profile, { recursive: true, force: true });
  }
});

test("Desktop loss during a mutation reports unknown execution and never replays it", { timeout: 10000 }, async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-mcp-no-replay-"));
  let mutations = 0;
  let stop = await startRpc(profile, async () => {
    mutations++;
    await stop();
    return { saved: true };
  });
  const client = new Client({ name: "codex", version: "1" });
  try {
    await client.connect(new StdioClientTransport(mcpTransport(profile, { env: { ...process.env, PLASMIC_DESKTOP_PROFILE: profile } })));
    const result = await client.callTool({ name: "execute", arguments: { name: "save" } });
    assert.equal(result.isError, true);
    const { detail } = JSON.parse(result.content[0].text);
    assert.equal(detail.code, "DESKTOP_CONNECTION_LOST");
    assert.equal(detail.operationExecuted, null);
    assert.equal(mutations, 1);
    stop = await startRpc(profile, async () => ({ mutations }));
    const recovered = await client.callTool({ name: "get_app_state", arguments: {} });
    assert.equal(recovered.isError, false);
    assert.deepEqual(JSON.parse(recovered.content[0].text), { mutations: 1 });
  } finally {
    await client.close(); await stop(); await fs.rm(profile, { recursive: true, force: true });
  }
});
