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
  const screenshotInputs = [];
  const fullContent = { method: "expanded-scroll-regions", coverage: "rendered-dom", scrollRegions: [], width: 32, height: 24 };
  const stop = await startRpc(profile, async (method, input) => {
    if (method === "get_screenshot") screenshotInputs.push(input);
    return {
      ...(await encodeImagePreview(png, { lossless: !["read_image", "generate_image"].includes(method) })),
      ...(method === "generate_image" ? { path: "/tmp/generated.png", fileMimeType: "image/png" } : {}),
      ...(method === "get_screenshot" ? { sourceViewport: { width: 32, height: 24 }, resized: false } : {}),
      ...(method === "get_screenshot" && input.fullContent ? { fullContent } : {}),
    };
  });
  const client = new Client({ name: "image-test", version: "1.0.0" });
  try {
    await client.connect(new StdioClientTransport({
      command: process.execPath,
      args: ["-e", `require(${JSON.stringify(require.resolve("../src/mcp.cjs"))}).serveMcp(${JSON.stringify(profile)})`],
      stderr: "pipe",
    }));
    const listing = await client.listTools();
    const screenshot = listing.tools.find((tool) => tool.name === "get_screenshot");
    assert.ok(screenshot, "AI clients must discover the screenshot tool");
    assert.equal(screenshot.inputSchema.properties.fullContent.type, "boolean");
    assert.match(screenshot.description, /fullContent:true/);
    assert.ok(screenshot.inputSchema.properties.fullContent.description);
    for (const [name, input] of [
      ["get_screenshot", {}],
      ["get_screenshot", { fullContent: true }],
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
        if (input.fullContent) assert.deepEqual(metadata.fullContent, fullContent);
      }
    }
    assert.deepEqual(screenshotInputs, [{}, { fullContent: true }]);
  } finally {
    await client.close();
    await stop();
    await fs.rm(profile, { recursive: true, force: true });
  }
});
