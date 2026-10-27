import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compareVersions, validateManifest } from "../packages/plasmic-cli/src/protocol.mjs";

const prefix = "/desktop-updates/";
const begin = "\t# BEGIN PLASMIC RELEASE DOWNLOADS";
const end = "\t# END PLASMIC RELEASE DOWNLOADS";
const repository = "shiguang-lab/plasmic";
const feeds = {
  "latest.json": "desktop-latest.json",
  "darwin/arm64/latest-mac.yml": "latest-mac-arm64.yml",
  "darwin/x64/latest-mac.yml": "latest-mac-x64.yml",
  "win32/x64/latest.yml": "latest.yml",
  "linux/x64/latest-linux.yml": "latest-linux.yml",
};
const platforms = {
  "mac-arm64": ["darwin/arm64", "dmg", "zip"],
  "mac-x64": ["darwin/x64", "dmg", "zip"],
  "win-x64": ["win32/x64", "exe"],
  "linux-x86_64": ["linux/x64", "AppImage"],
};

export function updateRoutes(previous, release, resourceManifest) {
  const tag = release.tag_name;
  if (!/^\d+\.\d+\.\d+$/.test(tag) || release.draft || release.prerelease) throw new Error("Use a published numeric release");
  compareVersions(tag, tag);
  if (previous.schemaVersion !== 1 || !previous.routes) throw new Error("Invalid download route state");
  const next = structuredClone(previous);
  const assets = new Map(release.assets.map((asset) => [asset.name, asset]));
  const add = (route, asset, mutable = false) => {
    if (!assets.has(asset)) throw new Error(`Missing Release asset: ${asset}`);
    const key = prefix + route;
    const entry = { tag, asset, mutable };
    if (next.routes[key] && !mutable && JSON.stringify(next.routes[key]) !== JSON.stringify(entry)) throw new Error(`Immutable download route differs: ${key}`);
    next.routes[key] = entry;
  };
  if (assets.has("desktop-latest.json")) {
    if (next.desktopVersion && compareVersions(tag, next.desktopVersion) < 0) throw new Error("Desktop download downgrade");
    for (const [route, asset] of Object.entries(feeds)) add(route, asset, true);
    for (const [suffix, [directory, ...extensions]] of Object.entries(platforms)) {
      for (const extension of extensions) {
        const file = `Plasmic-${tag}-${suffix}.${extension}`;
        add(`${directory}/${file}`, file);
        add(`${directory}/${file}.blockmap`, file + ".blockmap");
      }
    }
    next.desktopVersion = tag;
  }
  if (assets.has("plasmic-latest.json")) {
    if (next.resourceVersion && compareVersions(tag, next.resourceVersion) < 0) throw new Error("Resource download downgrade");
    const manifest = validateManifest(resourceManifest);
    if (manifest.version !== tag) throw new Error("Resource version differs from Release tag");
    add("plasmic/latest.json", "plasmic-latest.json", true);
    add(`plasmic/releases/${manifest.releaseId}/manifest.json`, "plasmic-manifest.json");
    for (const artifact of Object.values(manifest.artifacts)) {
      const asset = assets.get(artifact.file);
      if (asset?.digest !== `sha256:${artifact.sha256}` || asset.size !== artifact.size) throw new Error(`Resource Release asset differs: ${artifact.file}`);
      add(`plasmic/releases/${manifest.releaseId}/${artifact.file}`, artifact.file);
    }
    next.resourceVersion = tag;
  }
  return next;
}

export function renderRoutes(state) {
  const rows = Object.entries(state.routes).sort(([a], [b]) => a.localeCompare(b)).map(([route, entry]) => {
    if (!/^\/desktop-updates\/[A-Za-z0-9/._-]+$/.test(route) || !/^\d+\.\d+\.\d+$/.test(entry.tag) || !/^[A-Za-z0-9._-]+$/.test(entry.asset) || typeof entry.mutable !== "boolean") throw new Error("Invalid download route");
    return `\t\t${route} ${entry.tag} ${entry.asset} "${entry.mutable ? "no-store" : "public, max-age=31536000, immutable"}"`;
  });
  return `${begin}
\tmap {http.request.uri.path} {plasmic_tag} {plasmic_asset} {plasmic_cache} {
${rows.join("\n")}
\t\tdefault "" "" ""
\t}
\t@plasmic_release expression \`{plasmic_tag} != ""\`
\thandle @plasmic_release {
\t\troute {
\t\t\tvars plasmic_response_cache {plasmic_cache}
\t\t\theader {
\t\t\t\t>Cache-Control {http.vars.plasmic_response_cache}
\t\t\t\t>Access-Control-Allow-Origin "*"
\t\t\t\t>Access-Control-Allow-Methods "GET, HEAD, OPTIONS"
\t\t\t\t>Access-Control-Allow-Headers "Range, If-Range"
\t\t\t\t>Access-Control-Expose-Headers "Content-Length, Content-Range, Accept-Ranges, ETag"
\t\t\t\t-Set-Cookie
\t\t\t\t-Location
\t\t\t}
\t\t\t@plasmic_write not method GET HEAD OPTIONS
\t\t\trespond @plasmic_write 405
\t\t\t@plasmic_options method OPTIONS
\t\t\trespond @plasmic_options 204
\t\t\trewrite /${repository}/releases/download/{plasmic_tag}/{plasmic_asset}?plasmic_proxy={http.request.uuid}
\t\t\treverse_proxy https://github.com {
\t\t\t\theader_up Host github.com
\t\t\t\theader_up -Cookie
\t\t\t\theader_up -Authorization
\t\t\t\theader_up -X-SG-*
\t\t\t\theader_up -X-Forwarded-*
\t\t\t\theader_up -Forwarded
\t\t\t\theader_up Accept-Encoding identity
\t\t\t\t@plasmic_asset_redirect {
\t\t\t\t\tstatus 302
\t\t\t\t\theader Location https://release-assets.githubusercontent.com/*
\t\t\t\t}
\t\t\t\thandle_response @plasmic_asset_redirect {
\t\t\t\t\tmap {rp.header.Location} {plasmic_asset_uri} {
\t\t\t\t\t\t~^https://release-assets[.]githubusercontent[.]com(/.*)$ \${1}
\t\t\t\t\t}
\t\t\t\t\t# Explicit ? preserves the expanded signed query on Caddy 2.10.
\t\t\t\t\trewrite {plasmic_asset_uri}?
\t\t\t\t\treverse_proxy https://release-assets.githubusercontent.com {
\t\t\t\t\t\theader_up Host release-assets.githubusercontent.com
\t\t\t\t\t\theader_up -Cookie
\t\t\t\t\t\theader_up -Authorization
\t\t\t\t\t\theader_up -X-SG-*
\t\t\t\t\t\theader_up -X-Forwarded-*
\t\t\t\t\t\theader_up -Forwarded
\t\t\t\t\t\theader_up Accept-Encoding identity
\t\t\t\t\t\t@plasmic_unexpected_asset_redirect status 3xx
\t\t\t\t\t\thandle_response @plasmic_unexpected_asset_redirect {
\t\t\t\t\t\t\trespond 502
\t\t\t\t\t\t}
\t\t\t\t\t}
\t\t\t\t}
\t\t\t\t@plasmic_unexpected_redirect status 3xx
\t\t\t\thandle_response @plasmic_unexpected_redirect {
\t\t\t\t\trespond 502
\t\t\t\t}
\t\t\t}
\t\t}
\t}
${end}`;
}

export function patchCaddyfile(text, block) {
  const start = text.indexOf(begin);
  if (start !== -1) {
    const stop = text.indexOf(end, start);
    if (stop === -1) throw new Error("Unclosed Plasmic download block");
    return text.slice(0, start) + block + text.slice(stop + end.length);
  }
  const site = text.indexOf("https://plasmic-studio.shiguanglab.com:8454 {");
  const target = "\treverse_proxy http://100.87.115.78:3600 {";
  const insertion = text.indexOf(target, site);
  if (site === -1 || insertion === -1 || insertion > text.indexOf("\n}", site)) throw new Error("Cannot locate Plasmic Studio gateway");
  return text.slice(0, insertion) + block + "\n" + text.slice(insertion);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const tag = process.argv[2];
  if (!/^\d+\.\d+\.\d+$/.test(tag || "")) throw new Error("Use release-downloads.mjs X.Y.Z [Caddyfile]");
  const stateFile = new URL("../deploy/release-downloads.json", import.meta.url);
  let previous;
  try { previous = JSON.parse(await readFile(stateFile, "utf8")); }
  catch (error) { if (error.code !== "ENOENT") throw error; previous = { schemaVersion: 1, routes: {} }; }
  const response = await fetch(`https://api.github.com/repos/${repository}/releases/tags/${tag}`, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Release API: ${response.status}`);
  const release = await response.json();
  let resourceManifest;
  const asset = release.assets.find((entry) => entry.name === "plasmic-latest.json");
  if (asset) {
    const result = await fetch(asset.browser_download_url, { signal: AbortSignal.timeout(60000) });
    if (!result.ok) throw new Error(`Resource manifest download: ${result.status}`);
    const bytes = Buffer.from(await result.arrayBuffer());
    if (bytes.length !== asset.size || `sha256:${createHash("sha256").update(bytes).digest("hex")}` !== asset.digest) throw new Error("Resource manifest download differs");
    resourceManifest = JSON.parse(bytes.toString("utf8"));
  }
  const state = updateRoutes(previous, release, resourceManifest);
  const block = renderRoutes(state);
  if (process.argv[3]) {
    const original = await readFile(process.argv[3], "utf8");
    await writeFile(process.argv[3], patchCaddyfile(original, block));
  }
  await writeFile(stateFile, JSON.stringify(state, null, 2) + "\n");
  console.log(block);
}
