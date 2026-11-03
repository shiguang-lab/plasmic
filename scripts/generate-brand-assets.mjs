import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireDesktop = createRequire(path.join(root, "desktop/package.json"));
const sharp = requireDesktop("sharp");
const brand = JSON.parse(
  await readFile(
    path.join(root, "platform/wab/src/wab/shared/branding.json"),
    "utf8",
  ),
);
const { stops, ...coordinates } = brand.gradient;
const gradient = `<linearGradient id="brand-gradient" gradientUnits="userSpaceOnUse" ${Object.entries(
  coordinates,
)
  .map(([key, value]) => `${key}="${value}"`)
  .join(" ")}>
${stops.map(({ offset, color }) => `<stop offset="${offset}" stop-color="${color}"/>`).join("\n")}
</linearGradient>`;
const mark = `<g fill="url(#brand-gradient)">${brand.paths.map((d) => `<path d="${d}"/>`).join("")}</g>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs>${gradient}</defs>${mark}</svg>\n`;
const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
<defs>${gradient}<linearGradient id="background" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#30293f"/><stop offset="1" stop-color="#191622"/></linearGradient></defs>
<rect x="96" y="96" width="832" height="832" rx="186" fill="url(#background)"/>
<rect x="97" y="97" width="830" height="830" rx="185" fill="none" stroke="#fff" stroke-opacity=".08" stroke-width="2"/>
<g transform="translate(160 160) scale(22)">${mark}</g>
</svg>\n`;
const write = (file, data) => writeFile(path.join(root, file), data);
const png = (source, size) =>
  sharp(Buffer.from(source)).resize(size, size).png().toBuffer();

async function ico(source, sizes) {
  const images = await Promise.all(sizes.map((size) => png(source, size)));
  const header = Buffer.alloc(6 + sizes.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  sizes.forEach((size, i) => {
    const entry = 6 + i * 16;
    header[entry] = header[entry + 1] = size === 256 ? 0 : size;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(images[i].length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += images[i].length;
  });
  return Buffer.concat([header, ...images]);
}

async function icns(source) {
  const entries = [
    ["icp4", 16],
    ["icp5", 32],
    ["icp6", 64],
    ["ic07", 128],
    ["ic08", 256],
    ["ic09", 512],
    ["ic10", 1024],
    ["ic11", 32],
    ["ic12", 64],
    ["ic13", 256],
    ["ic14", 512],
  ];
  const chunks = await Promise.all(
    entries.map(async ([type, size]) => {
      const image = await png(source, size);
      const header = Buffer.alloc(8);
      header.write(type);
      header.writeUInt32BE(image.length + 8, 4);
      return Buffer.concat([header, image]);
    }),
  );
  const header = Buffer.alloc(8);
  header.write("icns");
  header.writeUInt32BE(
    8 + chunks.reduce((sum, chunk) => sum + chunk.length, 0),
    4,
  );
  return Buffer.concat([header, ...chunks]);
}

await Promise.all([
  write("platform/wab/public/favicon.svg", svg),
  write(
    "platform/wab/src/wab/client/plasmic/plasmic_kit_design_system/images/image4.svg",
    svg,
  ),
  write("platform/wab/public/favicon.ico", await ico(svg, [16, 32, 48, 64])),
  write("platform/wab/public/static/img/plasmic-mark.png", await png(svg, 512)),
  write("platform/wab/public/static/img/logo.png", await png(svg, 32)),
  write("desktop/assets/icon.svg", icon),
  write("desktop/assets/icon.png", await png(icon, 1024)),
  write(
    "desktop/assets/icon.ico",
    await ico(icon, [16, 24, 32, 48, 64, 128, 256]),
  ),
  write("desktop/assets/icon.icns", await icns(icon)),
]);

// Desktop windows use inline SVGs so their marks need no renderer or network.
for (const [file, anchor] of [
  ["desktop/src/unified-login.html", '<div class="chrome-brand">'],
  ["desktop/src/reference-browser.html", 'id="app-menu"'],
]) {
  const text = await readFile(path.join(root, file), "utf8");
  const start = text.indexOf("<svg", text.indexOf(anchor));
  const end = text.indexOf("</svg", start) + "</svg".length;
  if (start < 0 || end < start) throw new Error(`Missing brand in ${file}`);
  await write(
    file,
    text.slice(0, start) +
      `<svg viewBox="0 0 32 32" aria-hidden="true"><defs>${gradient}</defs>${mark}</svg` +
      text.slice(end),
  );
}

const welcomeFile = "packages/create-plasmic-app/src/templates/welcomePage.ts";
const welcome = await readFile(path.join(root, welcomeFile), "utf8");
const jsx = svg
  .trim()
  .replace(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">',
    '<svg xmlns="http://www.w3.org/2000/svg" width={40} height={40} viewBox="0 0 32 32">',
  )
  .replaceAll('id="brand-gradient"', "id={gradientId}")
  .replaceAll(
    'fill="url(#brand-gradient)"',
    'fill={"url(#" + gradientId + ")"}',
  )
  .replaceAll("stop-color=", "stopColor=");
await write(
  welcomeFile,
  `export const PLASMIC_LOGO = \`function PlasmicLogo() {\n  const gradientId = React.useId();\n  return (${jsx});\n}\n\`;\n\n` +
    welcome.slice(welcome.indexOf("export function WELCOME_PAGE")),
);
console.log(
  "Generated Studio, Desktop, favicon and starter template brand assets.",
);
