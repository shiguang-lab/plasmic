import { packager } from "@electron/packager";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const metadata = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8"),
);
const config = JSON.parse(
  await readFile(path.join(root, "desktop.config.json"), "utf8"),
);
const manifest = JSON.parse(
  await readFile(path.join(root, "renderer/desktop-assets.json"), "utf8"),
);
for (const key of ["studioOrigin", "canvasOrigin", "webImage"]) {
  if (config[key] !== manifest[key]) {
    throw new Error("Run npm run assets before packaging.");
  }
}
const [platform = process.platform, arch = process.arch] =
  process.argv.slice(2);
const outputs = await packager({
  dir: root,
  out: path.join(root, "dist", metadata.version),
  name: "Plasmic",
  icon: path.join(root, "assets", "icon"),
  appBundleId: "cn.publib.plasmic.desktop",
  appVersion: metadata.version,
  protocols: [{ name: "Plasmic login", schemes: ["plasmic-desktop"] }],
  platform,
  arch,
  asar: true,
  overwrite: true,
  prune: true,
  ignore: [/^\/(dist|scripts|tests|desktop-report)(\/|$)/, /^\/README\.md$/],
});
console.log(outputs.join("\n"));
