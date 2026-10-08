import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { validateRelease } from "./release-artifacts.mjs";

const desktop = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export const releaseTargets = [
  { id: "mac-arm64", platform: "darwin", arch: "arm64", extension: ".dmg" },
  { id: "mac-x64", platform: "darwin", arch: "x64", extension: ".dmg" },
  { id: "windows", platform: "win32", arch: "x64", extension: ".exe" },
  { id: "linux", platform: "linux", arch: "x64", extension: ".AppImage" },
];

export async function buildDistribution(input, output, version, updateUrl) {
  const base = new URL(updateUrl.replace(/\/?$/, "/"));
  if (
    base.protocol !== "https:" ||
    /^[\d.]+$/.test(base.hostname) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  ) {
    throw new Error("Downloads require a public HTTPS domain");
  }
  const installers = [];
  for (const target of releaseTargets) {
    const directory = path.join(input, `${target.platform}-${target.arch}`);
    const release = await validateRelease(
      directory,
      target.platform,
      version,
      target.arch,
    );
    if (target.platform === "darwin" && !release.manifest.files.some((entry) => entry.url.endsWith(".zip"))) throw new Error(`Missing ${target.arch} macOS update archive`);
    const file = release.manifest.files.find((entry) =>
      entry.url.endsWith(target.extension),
    );
    if (!file) throw new Error(`Missing ${target.id} installer`);
    const partition = `${target.platform}/${target.arch}`;
    const destination = path.join(output, partition);
    await mkdir(destination, { recursive: true });
    for (const name of [...release.files, release.name]) {
      await cp(path.join(directory, name), path.join(destination, name));
    }
    installers.push({
      id: target.id,
      platform: target.platform,
      arch: target.arch,
      version,
      size: file.size,
      sha512: file.sha512,
      url: new URL(`${partition}/${file.url}`, base).href,
    });
  }
  const manifest = { schemaVersion: 1, version, installers };
  await writeFile(
    path.join(output, "latest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  return manifest;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { values } = parseArgs({
    options: { from: { type: "string" }, output: { type: "string" } },
  });
  const metadata = JSON.parse(
    await readFile(path.join(desktop, "package.json"), "utf8"),
  );
  const config = JSON.parse(
    await readFile(path.join(desktop, "desktop.config.json"), "utf8"),
  );
  if (
    process.env.GITHUB_REF_NAME &&
    process.env.GITHUB_REF_NAME !== `desktop-v${metadata.version}`
  ) {
    throw new Error("Desktop tag must match package.json version");
  }
  const manifest = await buildDistribution(
    values.from || path.join(desktop, "dist", metadata.version),
    values.output || path.join(desktop, "public/desktop-updates"),
    metadata.version,
    config.updateUrl,
  );
  console.log(
    `Prepared all installers and latest.json for ${manifest.version}`,
  );
}
