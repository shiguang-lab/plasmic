const { PNG } = require("pngjs");
const tracer = require("imagetracerjs");
function tracePng(buffer, colors = 16) {
  const decoded = PNG.sync.read(buffer);
  if (decoded.width * decoded.height > 1024 * 1024)
    throw new Error("Trace images at most 1 megapixel; resize before tracing");
  if (!Number.isInteger(colors) || colors < 2 || colors > 32)
    throw new Error("colors must be 2–32");
  const svg = tracer.imagedataToSVG(
    { width: decoded.width, height: decoded.height, data: decoded.data },
    {
      numberofcolors: colors,
      colorsampling: 2,
      pathomit: 1,
      roundcoords: 2,
      ltres: 1,
      qtres: 1,
    },
  );
  return { svg, width: decoded.width, height: decoded.height };
}
module.exports = { tracePng };
