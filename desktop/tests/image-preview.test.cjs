const { test } = require("node:test");
const assert = require("node:assert/strict");
const sharp = require("sharp");
const { encodeImagePreview } = require("../src/image-preview.cjs");

test("lossless screenshots preserve every decoded pixel and do not shrink wide UI", async () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="160"><rect width="2400" height="160" fill="white"/><path d="M0 20H2400M30 0V160" stroke="#1677ff"/><text x="40" y="60" font-size="12">Table / 123456789 / Details</text></svg>');
  const png = await sharp(svg).png().toBuffer();
  const original = Buffer.from(png);
  const result = await encodeImagePreview(png, { lossless: true });
  const webp = Buffer.from(result.data, "base64");
  assert.equal(result.mimeType, "image/webp");
  assert.equal(result.encoding, "lossless");
  assert.deepEqual(result.sourceImageSize, { width: 2400, height: 160 });
  assert.equal(result.width, 2400);
  assert.equal(result.height, 160);
  assert.equal((await sharp(webp).metadata()).format, "webp");
  assert.deepEqual(await sharp(webp).ensureAlpha().raw().toBuffer(), await sharp(png).ensureAlpha().raw().toBuffer());
  assert.deepEqual(png, original);
});

test("asset previews keep aspect ratio, cap the long edge and never upscale", async () => {
  for (const [width, height, expected] of [[4096, 1024, [2048, 512]], [1024, 4096, [512, 2048]], [32, 24, [32, 24]]]) {
    const png = await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 128, b: 255, alpha: 0.5 } } }).png().toBuffer();
    const result = await encodeImagePreview(png);
    const metadata = await sharp(Buffer.from(result.data, "base64")).metadata();
    assert.equal(result.encoding, "lossy");
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.hasAlpha, true);
    assert.deepEqual([result.width, result.height], expected);
    assert.deepEqual([metadata.width, metadata.height], expected);
    assert.deepEqual(result.sourceImageSize, { width, height });
  }
});

test("both encoding modes retain transparent and semi-transparent alpha", async () => {
  const rgba = Buffer.from([0, 0, 0, 0, 20, 40, 60, 64, 40, 80, 120, 128, 60, 120, 180, 255]);
  const png = await sharp(rgba, { raw: { width: 4, height: 1, channels: 4 } }).png().toBuffer();
  for (const lossless of [false, true]) {
    const result = await encodeImagePreview(png, { lossless });
    const decoded = await sharp(Buffer.from(result.data, "base64")).ensureAlpha().raw().toBuffer();
    assert.deepEqual([...decoded].filter((_, index) => index % 4 === 3), [0, 64, 128, 255]);
    if (lossless) assert.deepEqual(decoded, rgba);
  }
});

test("oversized lossless screenshots request a crop rather than silently changing geometry", async () => {
  const png = await sharp({ create: { width: 1, height: 16384, channels: 3, background: "white" } }).png().toBuffer();
  await assert.rejects(encodeImagePreview(png, { lossless: true }), /capture a smaller region/);
  await assert.rejects(encodeImagePreview(Buffer.from("invalid image")));
});
