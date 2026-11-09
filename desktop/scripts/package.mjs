import { build, Platform, Arch } from "electron-builder";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { desktopSources, hashFiles, sourceIdentity } from "../../scripts/build-identity.mjs";
import { assertDesktopBrowserTarget } from "../../scripts/studio-build-target.mjs";
import { macSigningCertificate, verifyMacSignature } from "./local-signing.mjs";
import runtimeSecurity from "../src/runtime-security.cjs";
import { installMacLauncher } from "./mac-launcher.mjs";
import { buildMcp } from "./build-mcp.mjs";
import { prepareComponentReuse } from "./prepare-component-reuse.mjs";
import { verifyComponentReuseRuntime } from "./component-reuse-runtime.mjs";
import { buildBlockMap } from "app-builder-lib/out/targets/blockmap/blockmap.js";

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
assertDesktopBrowserTarget(manifest.build?.browserTarget, metadata.devDependencies.electron);
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
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    "local-adhoc": { type: "boolean", default: false },
    output: { type: "string" },
    notes: { type: "string" },
  },
});
const [platform = process.platform, arch = process.arch] = positionals;
const platforms = { darwin: Platform.MAC, win32: Platform.WINDOWS, linux: Platform.LINUX };
if (positionals.length > 2 || !platforms[platform] || !["arm64", "x64"].includes(arch)) throw new Error("Unsupported platform or architecture");
if (values["local-adhoc"] && platform !== "darwin") throw new Error("Local ad-hoc packaging requires macOS");
const signingCertificate = platform === "darwin" && !values["local-adhoc"] ? macSigningCertificate() : undefined;
if (platform === "darwin" && !values["local-adhoc"] && process.env.GITHUB_ACTIONS !== "true" && !signingCertificate) {
  throw new Error("Create or import a valid Apple Development identity in the build Mac keychain before packaging");
}
const releaseNotes = values.notes ? await readFile(values.notes, "utf8") : undefined;
const mcpDirectory = await buildMcp(platform, arch);
const componentReuseDirectory = await prepareComponentReuse(platform, arch);
const outputs = await build({
  projectDir: root,
  targets: platforms[platform].createTarget(undefined, Arch[arch]),
  publish: "never",
  config: {
    appId: "cn.publib.plasmic.desktop",
    productName: "Plasmic",
    electronVersion: metadata.devDependencies.electron,
    directories: { output: values.output ? path.resolve(values.output) : `dist/${metadata.version}/${platform}-${arch}`, buildResources: "assets" },
    files: ["src/**/*", "renderer/**/*", "assets/**/*", "desktop.config.json", "package.json"],
    asar: true,
    extraResources: [
      { from: componentReuseDirectory, to: "component-reuse" },
      { from: path.join(mcpDirectory, platform === "win32" ? "plasmic-mcp.exe" : "plasmic-mcp"), to: "mcp/" + (platform === "win32" ? "plasmic-mcp.exe" : "plasmic-mcp") },
      { from: path.join(mcpDirectory, "LICENSES.mcp.txt"), to: "mcp/LICENSES.mcp.txt" },
    ],
    npmRebuild: false,
    electronFuses: runtimeSecurity.productionFuses,
    forceCodeSigning: platform === "darwin" && !values["local-adhoc"],
    afterPack: async (context) => {
      if (platform !== "darwin" || process.platform !== "darwin") return;
      const bundle = path.join(context.appOutDir, "Plasmic.app/Contents");
      const architectures = [arch === "arm64" ? "arm64" : "x86_64"];
      const actual = execFileSync("/usr/bin/lipo", ["-archs", path.join(bundle, "MacOS/Plasmic")], { encoding: "utf8" }).trim().split(/\s+/);
      if (actual.length !== architectures.length || !architectures.every((name) => actual.includes(name))) throw new Error("Packaged macOS architecture mismatch");
      const resources = path.join(bundle, "Resources/app.asar");
      execFileSync(path.join(bundle, "MacOS/Plasmic"), ["-e", `
        const { createRequire } = require("node:module");
        const packaged = createRequire(process.argv[1] + "/package.json");
        const metadata = packaged("./package.json");
        for (const name of Object.keys(metadata.dependencies)) {
          packaged(name);
        }
        console.log("Packaged runtime dependencies verified before disabling Node launch modes");
      `, resources], { env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, stdio: "inherit" });
      if (arch === process.arch) {
        const helper = path.join(bundle, "Resources/mcp/plasmic-mcp");
        const version = JSON.parse(execFileSync(helper, ["--version"], { encoding: "utf8" }));
        if (!version.go || version.version !== metadata.version) throw new Error("Packaged Go MCP verification failed");
      }
      installMacLauncher(path.dirname(bundle), arch);
    },
    afterSign: async (context) => {
      if (platform !== "darwin" || process.platform !== "darwin") return;
      verifyMacSignature(path.join(context.appOutDir, "Plasmic.app"), signingCertificate);
      if (arch === process.arch) await verifyComponentReuseRuntime(path.join(context.appOutDir, "Plasmic.app/Contents/Resources/component-reuse"));
    },
    artifactName: "Plasmic-${version}-${os}-${arch}.${ext}",
    protocols: [{ name: "Plasmic login", schemes: ["plasmic-desktop"] }],
    publish: { provider: "generic", url: `${config.updateUrl}/${platform}/${arch}/`, useMultipleRangeRequest: false },
    releaseInfo: releaseNotes ? { releaseNotes } : undefined,
    mac: { target: ["dmg", "zip"], icon: "assets/icon.icns", identity: signingCertificate ? signingCertificate.fingerprint.replaceAll(":", "") : "-", type: "development", hardenedRuntime: false, notarize: false,
      // Start without a Dock identity before JavaScript can distinguish --mcp.
      extendInfo: { LSUIElement: true } },
    win: { target: ["nsis"], icon: "assets/icon.ico" },
    nsis: { oneClick: true, perMachine: false, deleteAppDataOnUninstall: false },
    linux: { target: ["AppImage"], executableName: "plasmic", icon: "assets/icon.png", category: "Development" },
  },
});
// Keep AppImage's embedded blockmap for existing clients and also publish a
// sidecar covering the complete file for the shared resumable downloader.
for (const output of outputs.filter((file) => file.endsWith(".AppImage"))) {
  await buildBlockMap(output, "gzip", output + ".blockmap");
}
console.log(outputs.join("\n"));
