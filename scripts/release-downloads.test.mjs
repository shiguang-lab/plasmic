import assert from "node:assert/strict";
import test from "node:test";
import {
  DESKTOP_FEEDS,
  RESOURCE_FILES,
  RESOURCE_RELEASE,
} from "./release-download-contract.mjs";
import {
  downloadTarget,
  patchCaddyfile,
  renderDownloadProxy,
} from "./release-downloads.mjs";

test("all six latest routes use GitHub latest and versioned installers use their own numeric tag", () => {
  for (const [route, file] of Object.entries({
    ...DESKTOP_FEEDS,
    "plasmic/latest.json": "plasmic-latest.json",
  }))
    assert.deepEqual(downloadTarget("/desktop-updates/" + route), {
      target: "/shiguang-lab/plasmic/releases/latest/download/" + file,
      cache: "no-store",
    });
  for (const version of ["0.5.0", "0.5.2", "1.2.3", "10.20.30"])
    for (const [directory, suffix, extensions] of [
      ["darwin/arm64", "mac-arm64", ["dmg", "zip"]],
      ["darwin/x64", "mac-x64", ["dmg", "zip"]],
      ["win32/x64", "win-x64", ["exe"]],
      ["linux/x64", "linux-x86_64", ["AppImage"]],
    ])
      for (const ext of extensions)
        for (const sidecar of ["", ".blockmap"]) {
          const file = `Plasmic-${version}-${suffix}.${ext}${sidecar}`;
          assert.deepEqual(
            downloadTarget(`/desktop-updates/${directory}/${file}`),
            {
              target: `/shiguang-lab/plasmic/releases/download/${version}/${file}`,
              cache: "public, max-age=31536000, immutable",
            },
          );
        }
  assert.equal(renderDownloadProxy().includes("0.5.2"), false);
});
test("content-hash resources resolve to append-only GitHub assets without a version lookup", () => {
  for (const id of ["a".repeat(64), "0123456789abcdef".repeat(4)])
    for (const file of RESOURCE_FILES)
      assert.deepEqual(
        downloadTarget(`/desktop-updates/plasmic/releases/${id}/${file}`),
        {
          target: `/shiguang-lab/plasmic/releases/download/${RESOURCE_RELEASE}/${id}-${file}`,
          cache: "public, max-age=31536000, immutable",
        },
      );
});
test("routing rejects malformed versions, cross-platform names, traversal and arbitrary upstreams", () => {
  for (const route of [
    "/desktop-updates/darwin/arm64/Plasmic-01.2.3-mac-arm64.zip",
    "/desktop-updates/darwin/arm64/Plasmic-1.2.3-win-x64.exe",
    "/desktop-updates/darwin/arm64/Plasmic-1.2.3-beta-mac-arm64.zip",
    "/desktop-updates/https://example.com/file",
    "/desktop-updates/../secret",
    "/desktop-updates/latest.json/extra",
    "/desktop-updates/plasmic/releases/short/resources.json.gz",
  ])
    assert.equal(downloadTarget(route), undefined, route);
  const block = renderDownloadProxy();
  assert.match(block, /map \{rp.header.Location\} \{plasmic_latest_uri\}/);
  assert.match(
    block,
    /header Location https:\/\/release-assets\.githubusercontent\.com\/\*/,
  );
  assert.match(block, /rewrite \{plasmic_asset_uri_direct\}\?/);
  assert.match(block, /header_up -Cookie/);
  assert.match(block, /header_up -Authorization/);
  assert.match(block, /not method GET HEAD OPTIONS/);
  assert.doesNotMatch(block, /plasmic_original_uri|plasmic_missing|100\.87\.115\.78/);
});
test("one-time Caddy installation preserves unrelated sites and replaces the old version map", () => {
  const block = renderDownloadProxy(),
    other = "https://other.example {\n\trespond 200\n}\n";
  const source =
    other +
    "https://plasmic-studio.shiguanglab.com:8454 {\n\treverse_proxy http://100.87.115.78:3600 {\n\t}\n}\n" +
    other;
  const patched = patchCaddyfile(source);
  assert.equal(patched.replace(block + "\n", ""), source);
  assert.equal(patchCaddyfile(patched), patched);
  const old = source.replace(
    "\treverse_proxy",
    "\t# BEGIN PLASMIC RELEASE DOWNLOADS\n\trespond old\n\t# END PLASMIC RELEASE DOWNLOADS\n\treverse_proxy",
  );
  assert.equal(patchCaddyfile(old), patched);
  assert.throws(() => patchCaddyfile(other), /locate/);
});
