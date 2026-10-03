const test = require("node:test");
const assert = require("node:assert/strict");
const { makeVector } = require("../src/vector.cjs");
const input = {
  width: 100,
  height: 100,
  paths: ["M0 0h40v40h-40z", "M20 0h40v40h-40z"],
  fill: "#123456",
};
for (const [operation, area] of [
  ["unite", 2400],
  ["intersect", 800],
  ["subtract", 800],
  ["exclude", 1600],
]) {
  test(operation + " computes actual closed geometry", () => {
    const result = makeVector({ ...input, operation });
    assert.ok(
      Math.abs(result.area - area) < 1e-8,
      `Expected area ${area}, got ${result.area}`,
    );
    assert.match(result.svg, /<path d="M/);
    assert.match(result.svg, /fill="#123456"/);
  });
}
test("rejects open boolean paths and unsafe SVG attribute values", () => {
  assert.throws(
    () => makeVector({ ...input, paths: ["M0 0L20 20"], operation: "unite" }),
    /closed paths/,
  );
  assert.throws(
    () => makeVector({ ...input, fill: 'red" onload="alert(1)' }),
    /solid fill/,
  );
});
