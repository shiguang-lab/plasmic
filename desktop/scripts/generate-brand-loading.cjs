// Run with desktop/node_modules/.bin/electron desktop/scripts/generate-brand-loading.cjs.
// Rasterize the original construction at 60fps; playback needs no SVG animation.
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");
const sharp = require("sharp");
const brand = require("../../platform/wab/src/wab/shared/branding.json");
const duration = 3192;
const frames = 192;
const size = 200;
const smooth = (value) => {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
};
app
  .whenReady()
  .then(async () => {
    const window = new BrowserWindow({ show: false });
    await window.loadURL("about:blank");
    const images = [];
    for (let i = 0; i <= frames; i++) {
      const time = (i * duration) / frames;
      const progress = time / 5600;
      const ready = smooth((progress - 0.08) / 0.49);
      const gradient = brand.gradient;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}">
      <defs><linearGradient id="fill" gradientUnits="userSpaceOnUse" x1="${gradient.x1}" y1="${gradient.y1}" x2="${gradient.x2}" y2="${gradient.y2}">${gradient.stops.map((stop) => `<stop offset="${stop.offset}" stop-color="${stop.color}"/>`).join("")}</linearGradient>
      <linearGradient id="reveal" x1="0" y1="0" x2="0" y2="1"><stop offset="${Math.max(0, ready * 1.22 - 0.22)}" stop-color="white"/><stop offset="${Math.min(1, ready * 1.22)}" stop-color="black"/></linearGradient><mask id="mask" maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32"><rect width="32" height="32" fill="url(#reveal)"/></mask></defs>
      <g fill="none" stroke-width=".16" stroke-linecap="round" stroke-linejoin="round" opacity="${1 - smooth((progress - 0.39) / 0.18)}">${brand.paths.map((d, index) => [0.22, 0.13, 0.035].map((length, k) => `<path d="${d}" pathLength="1" stroke="#cfbfff" opacity="${[0.2, 0.45, 1][k]}" stroke-dasharray="${length} ${1 - length}" stroke-dashoffset="${length - index * 0.28 - time / (5600 * 0.64)}"/>`).join("")).join("")}</g>
      <g opacity="${smooth((progress - 0.06) / 0.17)}" fill="url(#fill)" ${ready === 1 ? "" : 'mask="url(#mask)"'}>${brand.paths.map((d) => `<path d="${d}"/>`).join("")}</g></svg>`;
      const png = await window.webContents.executeJavaScript(`(async () => {
      const image = new Image();
      image.src = "data:image/svg+xml," + encodeURIComponent(${JSON.stringify(svg)});
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = ${size};
      canvas.getContext("2d").drawImage(image, 0, 0);
      return canvas.toDataURL().split(",")[1];
    })()`);
      images.push(
        await sharp(Buffer.from(png, "base64")).ensureAlpha().raw().toBuffer(),
      );
    }
    const data = await sharp(Buffer.concat(images), {
      raw: {
        width: size,
        height: size * images.length,
        channels: 4,
        pageHeight: size,
      },
    })
      .webp({
        lossless: true,
        effort: 6,
        loop: 1,
        minSize: true,
        delay: images.map((_, i) =>
          i === frames
            ? 1000
            : Math.round(((i + 1) * duration) / frames) -
              Math.round((i * duration) / frames),
        ),
      })
      .toBuffer();
    const name = `brand-loading-construction.${createHash("sha256").update(data).digest("hex").slice(0, 12)}.webp`;
    const repo = path.resolve(__dirname, "../..");
    await fs.writeFile(
      path.join(repo, "platform/wab/public/static/img", name),
      data,
    );
    await fs.writeFile(
      path.join(repo, "platform/wab/src/wab/shared/brand-loading.json"),
      JSON.stringify({ file: name, duration }, null, 2) + "\n",
    );
    console.log(
      `${name}: ${data.length} bytes, ${images.length} lossless frames`,
    );
    window.destroy();
    app.exit(0);
  })
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
