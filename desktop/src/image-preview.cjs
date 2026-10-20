const sharp = require("sharp");

// Compress the captured pixels, never the live viewport or the saved asset.
async function encodeImagePreview(input, { lossless = false } = {}) {
  const image = sharp(input);
  const source = await image.metadata();
  if (lossless && (source.width > 16383 || source.height > 16383)) {
    throw new Error("WebP screenshots must fit within 16383 pixels per side; capture a smaller region");
  }
  if (!lossless) {
    image.resize({
      width: 2048,
      height: 2048,
      fit: "inside",
      withoutEnlargement: true,
    });
  }
  const { data, info } = await image
    .webp({ lossless, quality: 85, alphaQuality: 100, effort: 4 })
    .toBuffer({ resolveWithObject: true });
  return {
    data: data.toString("base64"),
    mimeType: "image/webp",
    width: info.width,
    height: info.height,
    sourceImageSize: { width: source.width, height: source.height },
    encoding: lossless ? "lossless" : "lossy",
  };
}

module.exports = { encodeImagePreview };
