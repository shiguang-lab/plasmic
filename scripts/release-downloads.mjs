import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DESKTOP_FEEDS,
  RESOURCE_FILES,
  RESOURCE_RELEASE,
} from "./release-download-contract.mjs";

const begin = "\t# BEGIN PLASMIC RELEASE DOWNLOADS";
const end = "\t# END PLASMIC RELEASE DOWNLOADS";
const repository = "shiguang-lab/plasmic";
const version = "(?:0|[1-9][0-9]*)\\.(?:0|[1-9][0-9]*)\\.(?:0|[1-9][0-9]*)";
const immutable = "public, max-age=31536000, immutable";
const rules = [
  ...Object.entries({
    ...DESKTOP_FEEDS,
    "plasmic/latest.json": "plasmic-latest.json",
  }).map(([route, asset]) => ({
    path: "/desktop-updates/" + route,
    target: `/${repository}/releases/latest/download/${asset}`,
    cache: "no-store",
  })),
  ...[
    ["darwin/arm64", "mac-arm64\\.(?:dmg|zip)"],
    ["darwin/x64", "mac-x64\\.(?:dmg|zip)"],
    ["win32/x64", "win-x64\\.exe"],
    ["linux/x64", "linux-x86_64\\.AppImage"],
  ].map(([directory, suffix]) => ({
    pattern: `^/desktop-updates/${directory}/(Plasmic-(${version})-${suffix}(?:\\.blockmap)?)$`,
    target: `/${repository}/releases/download/\${2}/\${1}`,
    cache: immutable,
  })),
  ...RESOURCE_FILES.map((file) => ({
    pattern: `^/desktop-updates/plasmic/releases/([a-f0-9]{64})/${file.replaceAll(".", "\\.")}$`,
    target: `/${repository}/releases/download/${RESOURCE_RELEASE}/\${1}-${file}`,
    cache: immutable,
  })),
];
export function downloadTarget(uri) {
  for (const rule of rules) {
    if (rule.path === uri) return { target: rule.target, cache: rule.cache };
    const match = rule.pattern && uri.match(new RegExp(rule.pattern));
    if (match)
      return {
        target: rule.target.replace(
          /\$\{(\d+)\}/g,
          (_all, index) => match[index],
        ),
        cache: rule.cache,
      };
  }
}
const indent = (text) =>
  text
    .split("\n")
    .map((line) => "\t" + line)
    .join("\n");
const upstreamHeaders = (host) => `header_up Host ${host}
header_up -Cookie
header_up -Authorization
header_up -X-SG-*
header_up -X-Forwarded-*
header_up -Forwarded
header_up Accept-Encoding identity`;
function githubProxy(followLatest) {
  const name = followLatest ? "direct" : "latest";
  return `reverse_proxy https://github.com {
${indent(`lb_try_duration 10s
${upstreamHeaders("github.com")}
${
  followLatest
    ? `@plasmic_latest_redirect {
\tstatus 302
\theader Location https://github.com/shiguang-lab/plasmic/releases/download/*
}
handle_response @plasmic_latest_redirect {
\tmap {rp.header.Location} {plasmic_latest_uri} {
\t\t~^https://github[.]com(/shiguang-lab/plasmic/releases/download/${version}/[A-Za-z0-9._-]+)$ \${1}
\t\tdefault ""
\t}
\t@plasmic_invalid_latest expression \`{plasmic_latest_uri} == ""\`
\trespond @plasmic_invalid_latest 502
\trewrite {plasmic_latest_uri}?plasmic_proxy={http.request.uuid}
${indent(githubProxy(false))}
}
`
    : ""
}@plasmic_asset_${name} {
\tstatus 302
\theader Location https://release-assets.githubusercontent.com/*
}
handle_response @plasmic_asset_${name} {
\tmap {rp.header.Location} {plasmic_asset_uri_${name}} {
\t\t~^https://release-assets[.]githubusercontent[.]com(/.*)$ \${1}
\t}
\trewrite {plasmic_asset_uri_${name}}?
\treverse_proxy https://release-assets.githubusercontent.com {
\t\tlb_try_duration 10s
${indent(indent(upstreamHeaders("release-assets.githubusercontent.com")))}
\t\t@plasmic_asset_redirect_${name} status 3xx
\t\thandle_response @plasmic_asset_redirect_${name} {
\t\t\trespond 502
\t\t}
\t}
}
@plasmic_redirect_${name} status 3xx
handle_response @plasmic_redirect_${name} {
\trespond 502
}`)}
}`;
}
export function renderDownloadProxy() {
  const rows = rules
    .map(
      (rule) =>
        `\t\t${rule.path ?? "~" + rule.pattern} ${rule.target} "${rule.cache}"`,
    )
    .join("\n");
  return `${begin}
\tmap {http.request.uri.path} {plasmic_target} {plasmic_cache} {
${rows}
\t\tdefault "" ""
\t}
\t@plasmic_release expression \`{plasmic_target} != ""\`
\thandle @plasmic_release {
\t\troute {
\t\t\tvars plasmic_response_cache {plasmic_cache}
\t\t\theader {
\t\t\t\tCache-Control {http.vars.plasmic_response_cache}
\t\t\t\tmatch {
\t\t\t\t\tstatus 200 206 304
\t\t\t\t}
\t\t\t\tdefer
\t\t\t}
\t\t\theader {
\t\t\t\t>Cache-Control no-store
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
\t\t\trewrite {plasmic_target}?plasmic_proxy={http.request.uuid}
${indent(indent(indent(githubProxy(true))))}
\t\t}
\t}
${end}`;
}
export function patchCaddyfile(text) {
  const block = renderDownloadProxy(),
    start = text.indexOf(begin);
  if (start !== -1) {
    const stop = text.indexOf(end, start);
    if (stop === -1) throw new Error("Unclosed Plasmic download block");
    return text.slice(0, start) + block + text.slice(stop + end.length);
  }
  const site = text.indexOf("https://plasmic-studio.shiguanglab.com:8454 {");
  const insertion = text.indexOf(
    "\treverse_proxy http://100.87.115.78:3600 {",
    site,
  );
  if (site === -1 || insertion === -1 || insertion > text.indexOf("\n}", site))
    throw new Error("Cannot locate Plasmic Studio gateway");
  return text.slice(0, insertion) + block + "\n" + text.slice(insertion);
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (process.argv.length > 3)
    throw new Error(
      "Use release-downloads.mjs [Caddyfile]; versions are not configuration inputs",
    );
  if (process.argv[2])
    await writeFile(
      process.argv[2],
      patchCaddyfile(await readFile(process.argv[2], "utf8")),
    );
  console.log(renderDownloadProxy());
}
