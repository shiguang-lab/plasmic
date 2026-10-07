const test = require("node:test");
const assert = require("node:assert/strict");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");

test("MCP bootstrap works without an open editor or a bundled workflow file", async (t) => {
  const client = new Client({ name: "skill-test", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["-e", `require(${JSON.stringify(require.resolve("../src/mcp.cjs"))}).serveMcp("unused")`],
    stderr: "pipe",
  });
  t.after(() => client.close());
  await client.connect(transport);
  const result = await client.callTool({ name: "read_skill", arguments: {} });
  assert.ok(!result.isError);
  const bootstrap = JSON.parse(result.content.find((item) => item.type === "text").text);
  assert.match(bootstrap.instructions, /context resolve/);
  assert.match(bootstrap.instructions, /--mode prototype/);
  assert.match(bootstrap.instructions, /--mode codegen/);
  assert.equal(bootstrap.resourceManifestUrl, require("../desktop.config.json").updateUrl + "/plasmic/latest.json");
});
