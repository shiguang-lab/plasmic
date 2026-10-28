const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const { startRpc } = require("../src/local-rpc.cjs");

test("MCP advertises and routes library discovery, inspection, component search, install and upgrade", async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-libraries-"));
  const calls = [];
  const names = ["listLibraries", "getLibrary", "searchLibraryComponents", "installLibrary", "upgradeLibrary"];
  const stop = await startRpc(profile, async (method, input) => {
    calls.push({ method, input });
    return { operation: input.name, projectId: input.input.projectId ?? "library-icons" };
  });
  const client = new Client({ name: "library-test", version: "1.0.0" });
  try {
    await client.connect(new StdioClientTransport({ command: process.execPath,
      args: ["-e", `require(${JSON.stringify(require.resolve("../src/mcp.cjs"))}).serveMcp(${JSON.stringify(profile)})`], stderr: "pipe" }));
    const { tools } = await client.listTools();
    const execute = tools.find((tool) => tool.name === "execute");
    const state = tools.find((tool) => tool.name === "get_app_state");
    const batch = tools.find((tool) => tool.name === "execute_batch");
    assert.match(execute.description, /listLibraries.*getLibrary.*searchLibraryComponents.*installLibrary\/upgradeLibrary/);
    for (const name of names) {
      assert.ok(execute.inputSchema.properties.name.enum.includes(name), name);
      assert.ok(state.inputSchema.properties.toolNames.items.enum.includes(name), name);
      assert.ok(!batch.inputSchema.properties.operations.items.properties.name.enum.includes(name), name);
      const input = name === "listLibraries" ? { query: "icons" }
        : name === "searchLibraryComponents" ? { query: "AccountBook" } : { projectId: "library-icons" };
      const envelope = { name, input };
      const result = await client.callTool({ name: "execute", arguments: envelope });
      assert.equal(result.isError, false, result.content[0].text);
      assert.deepEqual(calls.at(-1), { method: "execute", input: envelope });
      assert.equal(JSON.parse(result.content[0].text).operation, name);
    }
    const invalid = await client.callTool({ name: "execute_batch", arguments: { operations: [{ name: "listLibraries", input: {} }] } });
    assert.equal(invalid.isError, true);
    assert.equal(calls.length, names.length);
  } finally {
    await client.close(); await stop();
    await fs.rm(profile, { recursive: true, force: true });
  }
});

test("MCP transports batch bindings, compact receipts and explicit read projections", async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-model-"));
  const calls = [];
  const receipt = { operations: [{ name: "createComponent", as: "page", created: [{ kind: "Component", uuid: "native-page", rootElementUuid: "native-root" }] }] };
  const stop = await startRpc(profile, async (method, input) => {
    calls.push({ method, input });
    return method === "execute_batch" ? receipt : { results: [{ uuid: "native-page" }], read: { fields: ["uuid"], depth: 0 } };
  });
  const client = new Client({ name: "model-test", version: "1.0.0" });
  try {
    await client.connect(new StdioClientTransport({
      command: process.execPath,
      args: ["-e", `require(${JSON.stringify(require.resolve("../src/mcp.cjs"))}).serveMcp(${JSON.stringify(profile)})`],
      stderr: "pipe",
    }));
    const batch = { operations: [
      { as: "page", name: "createComponent", input: { name: "Records", type: "page" } },
      { name: "changeElement", input: { componentUuid: "$page", elementUuid: "$page.root", name: "Root" } },
    ] };
    const result = await client.callTool({ name: "execute_batch", arguments: batch });
    assert.equal(result.isError, false);
    assert.deepEqual(calls[0], { method: "execute_batch", input: batch });
    assert.deepEqual(JSON.parse(result.content[0].text), receipt);
    assert.equal(result.structuredContent, undefined);
    assert.equal(JSON.stringify(result).includes("baseVariantTplTree"), false);
    const read = { name: "read", input: { componentUuids: ["native-page"], fields: ["uuid"], depth: 0 } };
    await client.callTool({ name: "execute", arguments: read });
    assert.deepEqual(calls[1], { method: "execute", input: read });
  } finally {
    await client.close();
    await stop();
    await fs.rm(profile, { recursive: true, force: true });
  }
});

test("MCP pages mutation receipts, SVG and CDP output without repeating RPC operations", async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-bounded-"));
  const calls = [];
  const receipt = { created: Array.from({ length: 2000 }, (_, i) => ({ uuid: `native-${i}`, name: "业务😀".repeat(30) })) };
  const svg = "<svg>" + "<path d='M0 0L1 1'/>".repeat(10000) + "</svg>";
  const stop = await startRpc(profile, async (method) => {
    calls.push(method);
    if (method === "execute_batch") return receipt;
    if (method === "make_vector") return { svg, area: 1, bounds: { width: 1, height: 1 } };
    return { result: { nodes: receipt.created } };
  });
  const client = new Client({ name: "bounded-test", version: "1.0.0" });
  try {
    await client.connect(new StdioClientTransport({ command: process.execPath,
      args: ["-e", `require(${JSON.stringify(require.resolve("../src/mcp.cjs"))}).serveMcp(${JSON.stringify(profile)})`], stderr: "pipe" }));
    const call = async (name, input) => {
      const response = await client.callTool({ name, arguments: input });
      assert.equal(response.isError, false, response.content[0].text);
      assert.ok(Buffer.byteLength(JSON.stringify(response)) <= 64 * 1024);
      assert.equal(response.structuredContent, undefined);
      return JSON.parse(response.content[0].text);
    };
    const ref = await call("execute_batch", { operations: [{ name: "createComponent", input: { name: "Page" } }] });
    assert.equal(ref.__type, "ResultReference");
    const recovered = [];
    let offset = 0;
    do {
      const page = await call("read_result", { resultId: ref.resultId, path: ["created"], offset });
      recovered.push(...page.entries.map((entry) => entry.value));
      offset = page.nextOffset;
    } while (offset !== undefined);
    assert.deepEqual(recovered, receipt.created);
    assert.deepEqual(calls, ["execute_batch"]);
    const vector = await call("make_vector", { width: 10, height: 10, paths: ["M0 0L1 1Z"] });
    let recoveredSvg = "";
    offset = 0;
    do {
      const page = await call("read_result", { resultId: vector.svg.resultId, offset, limit: 16000 });
      recoveredSvg += page.text;
      offset = page.nextOffset;
    } while (offset !== undefined);
    assert.equal(recoveredSvg, svg);
    const cdp = await call("reference_browser", { action: "cdp", method: "DOM.getDocument" });
    const node = await call("read_result", { resultId: cdp.resultId, path: ["result", "nodes", 1999, "uuid"] });
    assert.equal(node.text, "native-1999");
    assert.deepEqual(calls, ["execute_batch", "make_vector", "reference_browser"]);
  } finally {
    await client.close(); await stop();
    await fs.rm(profile, { recursive: true, force: true });
  }
});
