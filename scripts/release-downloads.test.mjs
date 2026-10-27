import assert from "node:assert/strict";
import test from "node:test";
import { MODE_REFERENCES, releaseId } from "../packages/plasmic-cli/src/protocol.mjs";
import { patchCaddyfile, renderRoutes, updateRoutes } from "./release-downloads.mjs";

const empty = () => ({ schemaVersion: 1, routes: {} });
function release(tag, { desktop = false, resources = false } = {}) {
  const names = [];
  let manifest;
  if (desktop) {
    names.push("desktop-latest.json", "latest-mac-arm64.yml", "latest-mac-x64.yml", "latest.yml", "latest-linux.yml");
    for (const [suffix, extensions] of [["mac-arm64", ["dmg", "zip"]], ["mac-x64", ["dmg", "zip"]], ["win-x64", ["exe"]], ["linux-x86_64", ["AppImage"]]]) {
      for (const extension of extensions) names.push(`Plasmic-${tag}-${suffix}.${extension}`, `Plasmic-${tag}-${suffix}.${extension}.blockmap`);
    }
  }
  const assets = names.map((name) => ({ name }));
  if (resources) {
    const entrypoints = Object.fromEntries(["guide", "inspect", "prototype", "codegen"].map((mode) => [mode, `references/${mode}.md`]));
    manifest = {
      schemaVersion: 1, version: tag, cliVersion: "0.5.0", minCliVersion: "0.0.59", entrypoints,
      files: [...new Set([...Object.values(entrypoints), "references/desktop-mcp.md", ...Object.values(MODE_REFERENCES).flat()])].map((path) => ({ path, size: 1, sha256: "a".repeat(64) })),
      artifacts: { cli: { file: "plasmic-cli.tgz", size: 2, sha256: "b".repeat(64) }, resources: { file: "resources.json.gz", size: 3, sha256: "c".repeat(64) } },
    };
    manifest.releaseId = releaseId(manifest);
    assets.push({ name: "plasmic-latest.json" }, { name: "plasmic-manifest.json" });
    for (const artifact of Object.values(manifest.artifacts)) assets.push({ name: artifact.file, size: artifact.size, digest: "sha256:" + artifact.sha256 });
  }
  return [{ tag_name: tag, draft: false, prerelease: false, assets }, manifest];
}

test("partial releases advance only selected feeds and retain every historical download", () => {
  const initial = updateRoutes(empty(), ...release("0.5.0", { desktop: true, resources: true }));
  assert.equal(Object.keys(initial.routes).length, 21);
  const resources = updateRoutes(initial, ...release("0.5.1", { resources: true }));
  assert.equal(resources.desktopVersion, "0.5.0");
  assert.equal(resources.resourceVersion, "0.5.1");
  for (const [path, route] of Object.entries(initial.routes)) if (!route.mutable) assert.deepEqual(resources.routes[path], route);
  const desktop = updateRoutes(resources, ...release("0.5.2", { desktop: true }));
  assert.equal(desktop.resourceVersion, "0.5.1");
  assert.equal(desktop.routes["/desktop-updates/latest.json"].tag, "0.5.2");
  assert.equal(desktop.routes["/desktop-updates/plasmic/latest.json"].tag, "0.5.1");
  assert.deepEqual(updateRoutes(desktop, ...release("0.5.3")), desktop);
  assert.throws(() => updateRoutes(desktop, ...release("0.5.0", { desktop: true })), /downgrade/);
});

test("incomplete or mismatched Releases cannot replace working routes", () => {
  const [incomplete] = release("0.5.0", { desktop: true });
  incomplete.assets.pop();
  assert.throws(() => updateRoutes(empty(), incomplete), /Missing Release asset/);
  const [corrupt, manifest] = release("0.5.0", { resources: true });
  corrupt.assets.find((asset) => asset.name === "resources.json.gz").digest = "sha256:" + "0".repeat(64);
  assert.throws(() => updateRoutes(empty(), corrupt, manifest), /asset differs/);
  assert.throws(() => updateRoutes(empty(), { ...incomplete, draft: true }), /published/);
});

test("proxy routes accept only known paths and follow redirects to the fixed asset host", () => {
  const state = updateRoutes(empty(), ...release("0.5.0", { desktop: true }));
  const block = renderRoutes(state);
  assert.match(block, /com\(\/\.\*\)\$ \$\{1\}/);
  assert.match(block, /rewrite \{plasmic_asset_uri\}\?/);
  assert.match(block, /header Location https:\/\/release-assets\.githubusercontent\.com\/\*/);
  assert.match(block, /header_up -Cookie/);
  assert.match(block, /header_up -Authorization/);
  assert.match(block, /not method GET HEAD OPTIONS/);
  assert.match(block, /default "" "" ""/);
  state.routes["/desktop-updates/{arbitrary_upstream}"] = { tag: "0.5.0", asset: "file", mutable: false };
  assert.throws(() => renderRoutes(state), /Invalid download route/);
});

test("Caddy updates preserve unrelated sites and are idempotent", () => {
  const block = renderRoutes(updateRoutes(empty(), ...release("0.5.0", { desktop: true })));
  const other = "https://other.example {\n\trespond 200\n}\n";
  const source = other + "https://plasmic-studio.shiguanglab.com:8454 {\n\treverse_proxy http://100.87.115.78:3600 {\n\t}\n}\n" + other;
  const patched = patchCaddyfile(source, block);
  assert.equal(patched.replace(block + "\n", ""), source);
  assert.equal(patchCaddyfile(patched, block), patched);
  assert.throws(() => patchCaddyfile(other, block), /locate/);
});
