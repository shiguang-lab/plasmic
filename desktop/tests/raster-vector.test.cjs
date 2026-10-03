const { test } = require("node:test");
const assert = require("node:assert/strict");
const { PNG } = require("pngjs");
const { tracePng } = require("../src/raster-vector.cjs");
test("raster tracing creates actual SVG geometry for two color blocks", () => {
  const image = new PNG({ width: 16, height: 16 });
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const i = (y * 16 + x) * 4;
      image.data[i] = x < 8 ? 255 : 0;
      image.data[i + 2] = x < 8 ? 0 : 255;
      image.data[i + 3] = 255;
    }
  const result = tracePng(PNG.sync.write(image), 2);
  assert.equal(result.width, 16);
  assert.match(result.svg, /<path[^>]+d="M/);
  assert.match(result.svg, /rgb\(255,0,0\)/);
  assert.match(result.svg, /rgb\(0,0,255\)/);
});
