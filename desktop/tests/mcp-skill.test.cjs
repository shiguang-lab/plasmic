const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm, mkdir, writeFile } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { readSkillBootstrap } = require("../src/skill-bootstrap.cjs");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");

test("MCP bootstrap works without an open editor or a bundled workflow file", async (t) => {
  const agentsHome = await mkdtemp(path.join(tmpdir(), "plasmic-bootstrap-"));
  t.after(() => rm(agentsHome, { recursive: true, force: true }));
  const client = new Client({ name: "skill-test", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["-e", `require(${JSON.stringify(require.resolve("../src/mcp.cjs"))}).serveMcp("unused")`],
    stderr: "pipe",
    env: { ...process.env, DSH_AGENTS_HOME: agentsHome },
  });
  t.after(() => client.close());
  await client.connect(transport);
  assert.match(client.getInstructions(), /read_skill/);
  assert.match(client.getInstructions(), /mustRead/);
  assert.match(client.getInstructions(), /current task and mode/);
  const { tools } = await client.listTools();
  assert.match(tools.find((tool) => tool.name === "read_skill").description, /Before design inspection, creation, revision or codegen/);
  const result = await client.callTool({ name: "read_skill", arguments: {} });
  assert.ok(!result.isError);
  const bootstrap = JSON.parse(result.content.find((item) => item.type === "text").text);
  assert.match(bootstrap.instructions, /context resolve/);
  assert.match(bootstrap.instructions, /--mode inspect/);
  assert.match(bootstrap.instructions, /--mode prototype/);
  assert.match(bootstrap.instructions, /--mode codegen/);
  assert.match(bootstrap.instructions, /mustRead/);
  assert.doesNotMatch(bootstrap.instructions, /skill install|detected clients|npm install/);
  assert.doesNotMatch(bootstrap.instructions, /--target/);
  assert.equal(bootstrap.resourceManifestUrl, require("../desktop.config.json").updateUrl + "/plasmic/latest.json");
});

test("MCP honors an explicit local source and never falls back when that source is broken", async (t) => {
  const agentsHome = await mkdtemp(path.join(tmpdir(), "plasmic-bootstrap-"));
  t.after(() => rm(agentsHome, { recursive: true, force: true }));
  const skill = path.join(agentsHome, "skills/plasmic");
  await mkdir(skill, { recursive: true });
  const resolver = path.join(agentsHome, "resolver.mjs");
  await writeFile(resolver, "throw new Error('Reading bootstrap must never execute the resolver');");
  await writeFile(path.join(skill, "SKILL.md"), "Current local skill");
  const config = path.join(skill, "local-source.json");
  await writeFile(config, JSON.stringify({ source: "local", resolver }));
  const client = new Client({ name: "local-skill-test", version: "1.0.0" });
  t.after(() => client.close());
  await client.connect(new StdioClientTransport({ command: process.execPath,
    args: ["-e", `require(${JSON.stringify(require.resolve("../src/mcp.cjs"))}).serveMcp("unused")`],
    env: { ...process.env, DSH_AGENTS_HOME: agentsHome }, stderr: "pipe" }));
  const result = await client.callTool({ name: "read_skill", arguments: {} });
  assert.ok(!result.isError);
  const bootstrap = JSON.parse(result.content.find((item) => item.type === "text").text);
  assert.equal(bootstrap.source, "local");
  assert.equal(bootstrap.resolver, resolver);
  assert.equal(bootstrap.skillPath, path.join(skill, "SKILL.md"));
  assert.match(bootstrap.instructions, /mustRead/);
  assert.doesNotMatch(bootstrap.instructions, /npx|context resolve/);
  assert.equal(bootstrap.resourceManifestUrl, undefined);
  await rm(resolver);
  assert.equal((await client.callTool({ name: "read_skill", arguments: {} })).isError, true);
  await writeFile(config, JSON.stringify({ source: "local", resolver: "relative.mjs" }));
  await assert.rejects(readSkillBootstrap(agentsHome), /absolute resolver/);
  await writeFile(config, "invalid JSON");
  await assert.rejects(readSkillBootstrap(agentsHome), SyntaxError);
});

test("MCP uses the current client's non-shared skill path without falling back", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "plasmic-client-skill-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const skill = path.join(root, ".claude/skills/plasmic");
  const skillPath = path.join(skill, "SKILL.md");
  const resolver = path.join(root, "resolver.mjs");
  await mkdir(skill, { recursive: true });
  await writeFile(skillPath, "Current client's local skill");
  await writeFile(resolver, "throw new Error('Bootstrap must not execute the resolver');");
  await writeFile(path.join(skill, "local-source.json"), JSON.stringify({ source: "local", resolver }));
  const client = new Client({ name: "non-shared-skill-test", version: "1.0.0" });
  t.after(() => client.close());
  await client.connect(new StdioClientTransport({ command: process.execPath,
    args: ["-e", `require(${JSON.stringify(require.resolve("../src/mcp.cjs"))}).serveMcp("unused")`],
    env: { ...process.env, DSH_AGENTS_HOME: path.join(root, ".agents") }, stderr: "pipe" }));
  const read = async (args) => client.callTool({ name: "read_skill", arguments: args });
  const payload = (result) => JSON.parse(result.content.find((item) => item.type === "text").text);
  assert.equal(payload(await read({})).source, "published");
  const result = await read({ skillPath });
  assert.ok(!result.isError);
  assert.deepEqual([payload(result).source, payload(result).skillPath, payload(result).resolver], ["local", skillPath, resolver]);
  assert.equal((await read({ skillPath: "relative/SKILL.md" })).isError, true);
  assert.equal((await read({ skillPath: path.join(root, "missing/SKILL.md") })).isError, true);
  await rm(resolver);
  assert.equal((await read({ skillPath })).isError, true);
});
