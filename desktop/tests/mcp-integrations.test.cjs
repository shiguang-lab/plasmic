const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const toml = require("smol-toml");
const jsonc = require("jsonc-parser");
const { McpIntegrations, NAME } = require("../src/mcp-integrations.cjs");
function fixture(t, extra = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "plasmic-integrations-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const options = {
    home: root,
    userData: path.join(root, "profile"),
    env: {},
    platform: "darwin",
    command: "/Applications/Plasmic.app/Contents/MacOS/Plasmic",
    args: ["--mcp"],
    ...extra,
  };
  return { options, manager: new McpIntegrations(options) };
}
function save(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}
for (const id of [
  "claude",
  "codex",
  "gemini",
  "antigravity",
  "opencode",
  "kiro",
  "claude-desktop",
]) {
  test(`${id}: register, restore with moved executable, and remove only Plasmic`, (t) => {
    const { manager, options } = fixture(t);
    const file = manager.clients.find((c) => c.id === id).file;
    const original =
      id === "codex"
        ? '# Keep this comment\nmodel = "example"\n[mcp_servers.other]\ncommand = "other"\n'
        : '{\n// Keep this comment\n"theme":"dark", "' +
          (id === "opencode" ? "mcp" : "mcpServers") +
          '":{"other":{"command":"other"}}\n}';
    save(file, original);
    manager.set(id, true);
    const parse = (text) =>
      id === "codex" ? toml.parse(text) : jsonc.parse(text);
    const key =
      id === "codex" ? "mcp_servers" : id === "opencode" ? "mcp" : "mcpServers";
    let content = fs.readFileSync(file, "utf8");
    assert.match(content, /Keep this comment/);
    assert.deepEqual({ ...parse(content)[key][NAME] }, manager.entry(id));
    const moved = new McpIntegrations({ ...options, command: "/new/Plasmic" });
    moved.restore();
    assert.deepEqual(
      { ...parse(fs.readFileSync(file, "utf8"))[key][NAME] },
      moved.entry(id),
    );
    assert.equal(moved.status().find((c) => c.id === id).enabled, true);
    moved.set(id, false);
    content = fs.readFileSync(file, "utf8");
    assert.match(content, /Keep this comment/);
    assert.equal(parse(content)[key][NAME], undefined);
    assert.deepEqual({ ...parse(content)[key].other }, { command: "other" });
    assert.equal(new McpIntegrations(options).preferences[id].enabled, false);
  });
}
test("conflicting entries and invalid config are never overwritten", (t) => {
  const { manager } = fixture(t);
  const file = manager.clients[0].file;
  for (const original of [
    '{"mcpServers":{"plasmic-desktop":{"command":"someone-else"}}}',
    '{"broken":',
    '{"mcpServers":[]}',
    "[]",
  ]) {
    save(file, original);
    assert.throws(() => manager.set("claude", true));
    assert.throws(() => manager.set("claude", false));
    assert.equal(fs.readFileSync(file, "utf8"), original);
    assert.ok(manager.status()[0].error);
  }
});
test("TOML managed block cannot remove unrelated settings", (t) => {
  const { manager } = fixture(t);
  const file = manager.clients[1].file;
  manager.set("codex", true);
  const text = fs
    .readFileSync(file, "utf8")
    .replace(
      "# END Plasmic Desktop MCP",
      '[other]\nsecret = "preserve"\n# END Plasmic Desktop MCP',
    );
  save(file, text);
  assert.throws(() => manager.set("codex", false), /other settings/);
  assert.equal(fs.readFileSync(file, "utf8"), text);
});
test("startup does not register clients without an explicit selection", (t) => {
  const { manager } = fixture(t);
  manager.restore();
  for (const client of manager.clients) {
    assert.equal(fs.existsSync(client.file), false);
  }
  assert.throws(() => manager.set("unknown", true));
  assert.throws(() => manager.set("codex", "true"));
});
test("restore repairs selected missing configuration and leaves unselected clients alone", (t) => {
  const { manager, options } = fixture(t);
  manager.set("gemini", true);
  const file = manager.clients[2].file;
  fs.unlinkSync(file);
  const next = new McpIntegrations(options);
  next.restore();
  assert.equal(next.status()[2].enabled, true);
  assert.equal(fs.existsSync(manager.clients[0].file), false);
});
test("OpenCode JSONC comments and other settings survive, custom config has no secrets", (t) => {
  const { manager, options } = fixture(t);
  const file = manager.clients[4].file + "c";
  save(
    file,
    '{ // comment\n"mcp":{"other":{"type":"remote","url":"https://example.test"}}, "theme":"dark", }',
  );
  const next = new McpIntegrations(options);
  next.set("opencode", true);
  assert.match(fs.readFileSync(file, "utf8"), /\/\/ comment/);
  assert.deepEqual(
    jsonc.parse(fs.readFileSync(file, "utf8")).mcp[NAME].command,
    [options.command, "--mcp"],
  );
  assert.deepEqual(JSON.parse(next.customConfig()), {
    mcpServers: { [NAME]: { command: options.command, args: ["--mcp"] } },
  });
});
test("platform-specific paths and documented environment overrides", (t) => {
  const { manager } = fixture(t, {
    platform: "win32",
    env: {
      APPDATA: "/roaming",
      CODEX_HOME: "/codex-home",
      XDG_CONFIG_HOME: "/xdg",
    },
  });
  assert.equal(
    manager.clients[1].file,
    path.join("/codex-home", "config.toml"),
  );
  assert.equal(
    manager.clients[4].file,
    path.join("/xdg", "opencode", "opencode.json"),
  );
  assert.equal(
    manager.clients[6].file,
    path.join("/roaming", "Claude", "claude_desktop_config.json"),
  );
  const linux = fixture(t, { platform: "linux" }).manager;
  assert.throws(() => linux.set("claude-desktop", true), /Linux/);
});
test("startup reports a failed restoration instead of marking it successful", (t) => {
  const { manager, options } = fixture(t);
  manager.set("codex", true);
  const file = manager.clients[1].file;
  const text = fs
    .readFileSync(file, "utf8")
    .replace("# BEGIN Plasmic Desktop MCP\n", "")
    .replace("# END Plasmic Desktop MCP\n", "");
  save(file, text);
  const moved = new McpIntegrations({ ...options, command: "/moved/app" });
  moved.restore();
  assert.match(moved.status()[1].error, /managed manually/);
  assert.equal(fs.readFileSync(file, "utf8"), text);
});
test("Codex existing explicit parent table is not redefined", (t) => {
  const { manager } = fixture(t);
  const file = manager.clients[1].file;
  const original =
    '# keep\n[mcp_servers]\n[mcp_servers.other]\ncommand = "other"\n';
  save(file, original);
  manager.set("codex", true);
  assert.deepEqual(
    { ...toml.parse(fs.readFileSync(file, "utf8")).mcp_servers[NAME] },
    manager.entry("codex"),
  );
  manager.set("codex", false);
  assert.equal(fs.readFileSync(file, "utf8"), original);
});
