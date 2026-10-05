const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
function setup() {
  let handle, copied, sent;
  const parent = {
    webContents: {
      send: (channel) => {
        sent = channel;
      },
    },
  };
  const source = fs.readFileSync(
    require.resolve("../src/mcp-settings.cjs"),
    "utf8",
  );
  const module = { exports: {} };
  vm.runInNewContext(source, {
    module,
    URL,
    require: () => ({
      ipcMain: {
        handle: (_, callback) => {
          handle = callback;
        },
      },
      clipboard: {
        writeText: (text) => {
          copied = text;
        },
      },
    }),
  });
  const clients = [{ id: "codex", enabled: false }];
  const integrations = {
    status: () => clients,
    customConfig: () => "fixture",
    set: () => clients,
  };
  const open = module.exports.createMcpSettings(
    integrations,
    () => parent,
    "https://studio.example.org",
  );
  const frame = { url: "https://studio.example.org/projects/fixture" };
  parent.webContents.mainFrame = frame;
  const event = { sender: parent.webContents, senderFrame: frame };
  return {
    handle,
    event,
    open,
    clients,
    copied: () => copied,
    sent: () => sent,
  };
}
test("native menu requests the Studio Modal and IPC only accepts the main Studio frame", () => {
  const s = setup();
  s.open();
  assert.equal(s.sent(), "desktop:mcp-settings-open");
  assert.throws(() => s.handle({ ...s.event, sender: {} }, "get"), /Invalid/);
  assert.throws(
    () =>
      s.handle(
        { ...s.event, senderFrame: { url: s.event.senderFrame.url } },
        "get",
      ),
    /Invalid/,
  );
  s.event.senderFrame.url = "https://untrusted.example.org/";
  assert.throws(() => s.handle(s.event, "get"), /Invalid/);
});
test("Studio reads and updates clients, copies config, and cannot invoke removed settings commands", () => {
  const s = setup();
  assert.equal(s.handle(s.event, "get").config, "fixture");
  assert.equal(
    s.handle(s.event, "set", { id: "codex", enabled: true }).clients,
    s.clients,
  );
  assert.equal(s.handle(s.event, "copy"), true);
  assert.equal(s.copied(), "fixture");
  assert.throws(
    () => s.handle(s.event, "image-set", {}),
    /Invalid MCP settings command/,
  );
});
