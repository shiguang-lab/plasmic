const test = require("node:test");
const assert = require("node:assert/strict");
const { readLayout } = require("../src/layout-read.cjs");
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
