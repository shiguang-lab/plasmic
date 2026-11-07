const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const { mcpTransport } = require("./fixtures/mcp.cjs");
const { startRpc } = require("../src/local-rpc.cjs");
const context = { purpose: "Select customer information categories and switch same-page content without route navigation" };

test("external MCP validates structured review before dispatch and transports it without stripping", async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "component-review-mcp-"));
  const calls = []; const stop = await startRpc(directory, async (method, input) => { calls.push({ method, input }); return { edited: true, componentReview: { status: "completed", suggestions: [] } }; });
  const client = new Client({ name: "review-contract-test", version: "1" });
  t.after(async () => { await client.close(); await stop(); await fs.rm(directory, { recursive: true, force: true }); });
  await client.connect(new StdioClientTransport(mcpTransport(directory)));
  const { tools } = await client.listTools(); const batch = tools.find(tool => tool.name === "execute_batch");
  const wireSchema = JSON.stringify(batch.inputSchema);
  for (const field of ["customOnly", "purpose"]) assert.ok(wireSchema.includes(field));
  assert.ok(batch.inputSchema.required.includes("reviewContext"));
  assert.deepEqual(Object.keys(batch.inputSchema.properties.reviewContext.properties).sort(), ["customOnly", "purpose"]);
  const operations = [{ name: "insertHtml", input: { componentUuid: "page", html: "<div></div>" } }];
  for (const arguments_ of [{ operations }, { operations, reviewContext: { purpose: " " } }, { operations, reviewContext: { ...context, customOnly: "true" } }]) {
    const result = await client.callTool({ name: "execute_batch", arguments: arguments_ }); assert.equal(result.isError, true);
  }
  const missing = await client.callTool({ name: "execute", arguments: { name: "insertHtml", input: operations[0].input } }); assert.equal(missing.isError, true);
  assert.equal(JSON.parse(missing.content[0].text).detail.operationExecuted, false);
  assert.equal(calls.length, 0);
  const request = { operations, reviewContext: context }; const result = await client.callTool({ name: "execute_batch", arguments: request });
  assert.equal(result.isError, false, JSON.stringify(result)); assert.deepEqual(calls[0], { method: "execute_batch", input: request });
  const single = { name: "insertHtml", input: { ...operations[0].input, reviewContext: context } };
  assert.equal((await client.callTool({ name: "execute", arguments: single })).isError, false); assert.deepEqual(calls[1], { method: "execute", input: single });
  const custom = { ...context, customOnly: true };
  assert.equal((await client.callTool({ name: "execute_batch", arguments: { operations, reviewContext: custom } })).isError, false);
  assert.equal(calls[2].input.reviewContext.customOnly, true);
  const retry = { name: "reviewComponentReuse", input: { targets: [{ componentUuid: "page", elementUuid: "region" }], reviewContext: context } };
  assert.equal((await client.callTool({ name: "execute", arguments: retry })).isError, false);
  assert.deepEqual(calls[3], { method: "execute", input: retry });
});
