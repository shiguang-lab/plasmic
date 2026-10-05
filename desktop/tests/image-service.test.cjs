const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const {
  requestImage,
  imageServiceStatus,
} = require("../src/image-service.cjs");
const png = Buffer.from("test-pixels");
const nativeImage = {
  createFromBuffer: (buffer) => ({
    isEmpty: () => !buffer.equals(png),
    toPNG: () => png,
    getSize: () => ({ width: 2, height: 3 }),
  }),
};
test("Images generation and background editing send correct requests and never overwrite", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-image-"));
  const requests = [];
  const server = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) {
      body += chunk;
    }
    requests.push({ url: req.url, headers: req.headers, body });
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ data: [{ b64_json: png.toString("base64") }] }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await fs.writeFile(
      path.join(dir, "image-service.json"),
      JSON.stringify({
        baseUrl: `http://127.0.0.1:${server.address().port}/v1`,
        model: "fixture-model",
        apiKey: "fixture-key",
      }),
    );
    assert.deepEqual(await imageServiceStatus(dir), {
      configured: true,
      model: "fixture-model",
    });
    const outputPath = path.join(dir, "generated.png");
    const result = await requestImage(
      dir,
      { action: "generate", prompt: "a blue circle", outputPath },
      nativeImage,
    );
    assert.equal(result.width, 2);
    assert.equal(requests[0].url, "/v1/images/generations");
    assert.equal(JSON.parse(requests[0].body).prompt, "a blue circle");
    await assert.rejects(
      requestImage(
        dir,
        { action: "generate", prompt: "again", outputPath },
        nativeImage,
      ),
      /EEXIST/,
    );
    assert.equal(requests.length, 1);
    await requestImage(
      dir,
      {
        action: "remove_background",
        path: outputPath,
        outputPath: path.join(dir, "transparent.png"),
      },
      nativeImage,
    );
    assert.equal(requests[1].url, "/v1/images/edits");
    assert.match(requests[1].body, /name="background"\r\n\r\ntransparent/);
    assert.match(requests[1].body, /name="image"; filename="input.png"/);
    await assert.rejects(
      requestImage(
        dir,
        {
          action: "edit",
          path: outputPath,
          outputPath: path.join(dir, "bad.png"),
        },
        nativeImage,
      ),
      /prompt/,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(dir, { recursive: true, force: true });
  }
});
test("missing service reports unconfigured without credentials", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-image-"));
  try {
    assert.deepEqual(await imageServiceStatus(dir), { configured: false });
    await assert.rejects(
      requestImage(
        dir,
        {
          action: "generate",
          prompt: "x",
          outputPath: path.join(dir, "out.png"),
        },
        nativeImage,
      ),
      /Configure/,
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
