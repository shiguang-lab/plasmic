const { chromium } = require("../../node_modules/playwright");
const {
  PNG,
} = require("../../../node_modules/.pnpm/playwright-core@1.60.0/node_modules/playwright-core/lib/utilsBundle.js");
const fs = require("fs");
const assert = require("node:assert/strict");
const http = require("http");
const red = new PNG({ width: 16, height: 16 });
for (let i = 0; i < red.data.length; i += 4) {
  red.data[i] = 255;
  red.data[i + 3] = 255;
}
const server = http.createServer((req, res) => {
  res.setHeader("content-type", "image/png");
  res.end(PNG.sync.write(red));
});
(async () => {
  await new Promise((r) => server.listen(3218, "127.0.0.1", r));
  const browser = await chromium.launch({
    headless: true,
    args: ["--enable-unsafe-swiftshader"],
  });
  try {
    const page = await browser.newPage();
    await page.goto("http://127.0.0.1:3217/?count=0");
    await page.waitForFunction(() => !!window.coverProbe);
    const result = await page.evaluate(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 16;
      const image = new Image();
      image.src = "http://127.0.0.1:3218/red.png";
      await image.decode();
      canvas.getContext("2d").drawImage(image, 0, 0);
      let tainted;
      try {
        canvas.toDataURL();
        tainted = "unexpectedly-exportable";
      } catch (e) {
        tainted = e.name;
      }
      const glResults = [];
      for (const preserve of [false, true]) {
        const c = document.createElement("canvas");
        c.width = c.height = 16;
        document.body.append(c);
        const gl = c.getContext("webgl", { preserveDrawingBuffer: preserve });
        if (!gl) {
          glResults.push({ preserve, available: false });
          continue;
        }
        gl.clearColor(1, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        await new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        );
        const pixels = new Uint8Array(4);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        glResults.push({ preserve, pixel: [...pixels], png: c.toDataURL() });
        gl.getExtension("WEBGL_lose_context")?.loseContext();
        c.width = c.height = 0;
        c.remove();
      }
      return { tainted, glResults };
    });
    assert.equal(result.tainted, "SecurityError");
    assert.deepEqual(
      result.glResults.find((r) => !r.preserve).pixel,
      [0, 0, 0, 0],
    );
    assert.deepEqual(
      result.glResults.find((r) => r.preserve).pixel,
      [255, 0, 0, 255],
    );
    fs.writeFileSync(
      "/tmp/plasmic-cover-probe/canvas-edge.json",
      JSON.stringify(result, null, 2),
    );
    console.log(
      JSON.stringify(
        result,
        (k, v) => (k === "png" ? v.slice(0, 40) : v),
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  server.close();
  process.exitCode = 1;
});
