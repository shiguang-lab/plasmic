import { build, Platform, Arch } from "electron-builder";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { desktopSources, hashFiles, sourceIdentity } from "../../scripts/build-identity.mjs";

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
if (
  manifest.build?.kind === "local" &&
  manifest.build.sourceHash !==
    (await sourceIdentity(path.dirname(root))).sourceHash
) {
  throw new Error(
    "Studio sources changed; run package:local before packaging.",
  );
}
for (const key of ["studioOrigin", "canvasOrigin", "webImage"]) {
  if (config[key] !== manifest[key]) {
    throw new Error("Run npm run assets before packaging.");
  }
}
if (manifest.build?.rendererHash !== await hashFiles(path.join(root, "renderer"), ["."], ["desktop-assets.json"]) ||
    manifest.build?.desktopHash !== await hashFiles(root, desktopSources)) {
  throw new Error("Bundled assets or desktop sources changed; run assets before packaging.");
}
const [platform = process.platform, arch = process.arch] =
  process.argv.slice(2);
const platforms = { darwin: Platform.MAC, win32: Platform.WINDOWS, linux: Platform.LINUX };
if (!platforms[platform] || !["arm64", "x64"].includes(arch)) throw new Error("Unsupported platform or architecture");
const notesIndex = process.argv.indexOf("--notes");
const releaseNotes = notesIndex < 0 ? undefined : await readFile(process.argv[notesIndex + 1], "utf8");
const outputs = await build({
  projectDir: root,
  targets: platforms[platform].createTarget(undefined, Arch[arch]),
  publish: "never",
  config: {
    appId: "cn.publib.plasmic.desktop",
    productName: "Plasmic",
    electronVersion: metadata.devDependencies.electron,
    directories: { output: `dist/${metadata.version}/${platform}-${arch}`, buildResources: "assets" },
    files: ["src/**/*", "mcp-guide.md", "renderer/**/*", "assets/**/*", "desktop.config.json", "package.json"],
    asar: true,
    npmRebuild: false,
    artifactName: "Plasmic-${version}-${os}-${arch}.${ext}",
    protocols: [{ name: "Plasmic login", schemes: ["plasmic-desktop"] }],
    publish: { provider: "generic", url: `${config.updateUrl}/${platform}/${arch}/`, useMultipleRangeRequest: false },
    releaseInfo: releaseNotes ? { releaseNotes } : undefined,
    mac: { target: ["dmg", "zip"], icon: "assets/icon.icns", identity: "-", hardenedRuntime: false },
    win: { target: ["nsis"], icon: "assets/icon.ico" },
    nsis: { oneClick: true, perMachine: false, deleteAppDataOnUninstall: false },
    linux: { target: ["AppImage"], icon: "assets/icon.png", category: "Development" },
  },
});
console.log(outputs.join("\n"));
