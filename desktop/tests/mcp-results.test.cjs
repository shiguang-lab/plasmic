const test = require("node:test");
const assert = require("node:assert/strict");
const { McpResults, MAX_JSON_BYTES, message } = require("../src/mcp-results.cjs");
const { readLayout } = require("../src/layout-read.cjs");
const decode = (result) => {
  assert.ok(Buffer.byteLength(JSON.stringify(result)) <= MAX_JSON_BYTES);
  assert.equal(result.structuredContent, undefined);
  return JSON.parse(result.content[0].text);
};
function recover(store, resultId, path = []) {
  let offset = 0, result;
  do {
    const page = store.read({ resultId, path, offset, limit: 16000 });
    decode(message(page));
    if (page.type === "string") result = (result || "") + page.text;
    else if (page.entries) {
      result ??= page.type === "array" ? [] : {};
      for (const entry of page.entries) {
        const value = entry.reference ? recover(store, resultId, [...path, entry.key]) : entry.value;
        Object.defineProperty(result, entry.key, { value, enumerable: true, writable: true, configurable: true });
      }
    } else return page.value;
    offset = page.nextOffset;
  } while (offset !== undefined);
  return result;
}
test("large native models, unicode strings and CDP trees can be recovered exactly under the wire budget", () => {
  const store = new McpResults();
  const original = {
    props: { options: Array.from({ length: 250 }, (_, i) => ({ id: i, text: "业务😀\n\"".repeat(400) })) },
    markup: "<div>😀业务</div>".repeat(20000),
    empty: [], nullable: null,
  };
  const reference = decode(store.output(original));
  assert.equal(reference.__type, "ResultReference");
  assert.deepEqual(recover(store, reference.resultId), original);
  assert.deepEqual(store.read({ resultId: reference.resultId, path: ["props", "options", 249, "id"] }).value, 249);
  assert.throws(() => store.read({ resultId: reference.resultId, path: ["constructor"] }), /does not exist/);
});
test("references are connection-local snapshots with explicit eviction, and small values are returned once", () => {
  const store = new McpResults();
  const first = store.retain({ text: "first" });
  for (let i = 0; i < 15; i++) store.retain({ i });
  assert.deepEqual(recover(store, first.resultId), { text: "first" });
  store.retain({ i: 16 });
  assert.throws(() => store.read(first), /expired/);
  assert.throws(() => new McpResults().read(first), /another MCP connection/);
  assert.deepEqual(decode(store.output({ created: [{ uuid: "root" }] })), { created: [{ uuid: "root" }] });
});
test("string pagination follows Unicode boundaries and accounts for escaping", () => {
  const store = new McpResults();
  const text = "😀" + "\u0000".repeat(20000) + "中".repeat(20000);
  const ref = store.retain(text);
  const first = store.read({ resultId: ref.resultId, limit: 1 });
  assert.equal(first.text, "😀");
  assert.equal(first.nextOffset, 2);
  assert.throws(() => store.read({ resultId: ref.resultId, offset: 1 }), /Unicode/);
  assert.equal(recover(store, ref.resultId), text);
});
test("layout summaries keep complete counts and problems, scoped pages and full evidence stay recoverable", () => {
  const layout = { ready: true, frameUuid: "frame", width: 1000, height: 800, truncated: false,
    elements: Array.from({ length: 2400 }, (_, index) => ({ index, elementUuid: `node${index}`, text: "Label", horizontalOverflow: index > 2339 })),
    images: [{ src: "data:image/png;base64," + "x".repeat(200000), loaded: false }],
  };
  const summary = readLayout(layout);
  assert.equal(summary.elements, undefined);
  assert.deepEqual(summary.counts, { elements: 2400, images: 1, problems: 61 });
  assert.equal(summary.problems.length, 50);
  assert.equal(summary.nextOffset, 50);
  const next = readLayout(layout, { view: "problems", offset: summary.nextOffset });
  assert.equal(next.problems.length, 11);
  const node = readLayout(layout, { view: "elements", elementUuid: "node2399", fields: ["elementUuid"] });
  assert.deepEqual(node.elements, [{ elementUuid: "node2399" }]);
  const geometry = readLayout(layout, { view: "elements", limit: 1 });
  assert.equal(geometry.elements[0].text, undefined);
  assert.equal(geometry.read.fields.includes("elementUuid"), true);
  assert.equal(geometry.read.fields.includes("text"), false);
  assert.equal(readLayout(layout, { view: "elements", limit: 1, fields: ["text"] }).elements[0].text, "Label");
  const full = readLayout(layout, { view: "full" });
  assert.deepEqual(full.elements, layout.elements);
  assert.deepEqual(full.images, layout.images);
});

test("errors keep a short msg while retaining complete diagnostics within the response budget", () => {
  const store = new McpResults();
  const detail = { message: "Invalid target", code: "TARGET_INVALID", operationExecuted: false,
    cause: { stack: '诊断\n"'.repeat(40000) }, recovery: [{ tool: "get_app_state", arguments: {} }] };
  const response = store.error("Tool call failed.", detail);
  assert.equal(response.isError, true);
  const payload = decode(response);
  assert.equal(payload.msg, "Tool call failed.");
  assert.equal(payload.detail.__type, "ResultReference");
  assert.deepEqual(recover(store, payload.detail.resultId), detail);
  assert.deepEqual(decode(store.error("Tool call failed.", { message: "Original exception" })), {
    msg: "Tool call failed.", detail: { message: "Original exception" },
  });
});
