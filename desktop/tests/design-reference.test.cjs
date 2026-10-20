const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { DesignReference } = require("../src/design-reference.cjs");

test("reference reads execute bounded read-only Pen snippets and retain native layout/child IDs", async () => {
  const reader = new DesignReference("/unused"), calls = [];
  reader.connect = async () => ({ callTool: async (request) => {
    calls.push(request);
    let printed;
    vm.runInNewContext(request.arguments.input, {
      Get: (id, visitor, options) => {
        assert.equal(id, "frame"); assert.equal(options.depth, 1); assert.equal(options.resolveVariables, true); assert.equal(options.resolveInstances, true);
        visitor({ id, type: "frame", layout: "vertical", gap: 16, children: [{ id: "child" }] }, { depth: 0, bounds: { width: 800, height: 600 } });
        visitor({ id: "child", type: "text", content: "标题" }, { depth: 1, bounds: { width: 80, height: 24 } });
      }, Print: (line) => printed = line,
    });
    return { content: [{ type: "text", text: printed }] };
  } });
  const first = await reader.read({ action: "read", filePath: "/tmp/source.pen", nodeId: "frame", limit: 1 });
  assert.deepEqual(first.items[0].children, ["child"]);
  assert.equal(first.items[0].gap, 16); assert.equal(first.nextOffset, 1);
  const next = await reader.read({ action: "read", filePath: "/tmp/source.pen", nodeId: "frame", limit: 1, offset: first.nextOffset });
  assert.equal(next.items[0].content, "标题"); assert.equal(next.nextOffset, undefined);
  assert.equal(calls.length, 2); assert.equal(first.source.provider, "pen-mcp");
});

test("index traverses only top-level Pen nodes", async () => {
  const reader = new DesignReference("/unused");
  reader.connect = async () => ({ callTool: async (request) => {
    let printed;
    vm.runInNewContext(request.arguments.input, { Get: (visitor, options) => {
      assert.equal(options.depth, 0);
      visitor({ id: "frame", name: "List", type: "frame" }, { depth: 0, bounds: { width: 1440, height: 1024 } });
    }, Print: (line) => printed = line });
    return { content: [{ type: "text", text: printed }] };
  } });
  const result = await reader.read({ action: "index", filePath: "/tmp/source.pen" });
  assert.equal(result.items[0].id, "frame"); assert.equal(result.total, 1);
});

test("local RPC cannot interpolate code through pagination or request a mutation", async () => {
  const reader = new DesignReference("/unused");
  reader.connect = async () => { throw Error("must validate before connecting"); };
  const base = { action: "read", filePath: "/tmp/source.pen", nodeId: "frame" };
  for (const input of [{ depth: "1});Delete('frame');" }, { limit: 51 }, { offset: -1 }, { fields: ["children;Delete"] }, { action: "delete" }, { nodeId: "frame');Delete()" }]) {
    await assert.rejects(reader.read({ ...base, ...input }), /bounded|Unsupported|native Pen/);
  }
});
