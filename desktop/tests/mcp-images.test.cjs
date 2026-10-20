const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const sharp = require("sharp");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const { startRpc } = require("../src/local-rpc.cjs");
const { encodeImagePreview } = require("../src/image-preview.cjs");

test("all MCP image routes deliver WebP once, with dimensions and original-file metadata", async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-images-"));
  const png = await sharp({ create: { width: 32, height: 24, channels: 4, background: "transparent" } }).png().toBuffer();
  const stop = await startRpc(profile, async (method) => ({
    ...(await encodeImagePreview(png, { lossless: !["read_image", "generate_image"].includes(method) })),
    ...(method === "generate_image" ? { path: "/tmp/generated.png", fileMimeType: "image/png" } : {}),
    ...(method === "get_screenshot" ? { sourceViewport: { width: 32, height: 24 }, resized: false } : {}),
  }));
  const client = new Client({ name: "image-test", version: "1.0.0" });
  try {
    await client.connect(new StdioClientTransport({
      command: process.execPath,
      args: ["-e", `require(${JSON.stringify(require.resolve("../src/mcp.cjs"))}).serveMcp(${JSON.stringify(profile)})`],
      stderr: "pipe",
    }));
    for (const [name, input] of [
      ["get_screenshot", {}],
      ["read_image", { src: "https://studio.example/image.png" }],
      ["capture_browser", { url: "https://example.org" }],
      ["generate_image", { action: "generate", prompt: "Test", outputPath: "/tmp/generated.png" }],
      ["preview", { action: "screenshot" }],
      ["design_reference", { action: "screenshot", filePath: "/tmp/reference.pen", nodeId: "frame" }],
      ["reference_browser", { action: "capture" }],
      ["reference_browser", { action: "cdp", method: "Page.captureScreenshot" }],
    ]) {
      const result = await client.callTool({ name, arguments: input });
      assert.equal(result.isError, false, result.content?.[0]?.text);
      assert.deepEqual(result.content.map((block) => block.type), ["text", "image"]);
      const metadata = JSON.parse(result.content[0].text);
      assert.deepEqual(JSON.parse(result.content[0].text), metadata);
      assert.equal(metadata.data, undefined);
      assert.equal(result.content[1].mimeType, "image/webp");
      const decoded = await sharp(Buffer.from(result.content[1].data, "base64")).metadata();
      assert.equal(decoded.format, "webp");
      assert.deepEqual([decoded.width, decoded.height], [metadata.width, metadata.height]);
      assert.deepEqual(metadata.sourceImageSize, { width: 32, height: 24 });
      if (name === "generate_image") {
        assert.equal(metadata.path, "/tmp/generated.png");
        assert.equal(metadata.fileMimeType, "image/png");
      }
      if (name === "get_screenshot") {
        assert.deepEqual(metadata.sourceViewport, { width: 32, height: 24 });
        assert.equal(metadata.resized, false);
      }
    }
  } finally {
    await client.close();
    await stop();
    await fs.rm(profile, { recursive: true, force: true });
  }
});
