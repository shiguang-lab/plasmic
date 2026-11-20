const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { createUpdateFeed } = require("../src/update-feed.cjs");
const { parseManifest } = require("../src/mac-updater.cjs");
const { UpdateManager } = require("../src/update-manager.cjs");

const studioOrigin = "https://studio.test";
const partition = "darwin/arm64";
const feedUrl = `${studioOrigin}/desktop-updates/${partition}/`;
const manifestName = "latest-mac.yml";

for (const [selected, release, expected] of [
  [401, "1.0.0", "1.0.0"],
  [403, "1.0.0", "1.0.0"],
  [404, "1.0.0", "1.0.0"],
  [503, "1.0.0", "1.0.0"],
  ["1.0.0-beta.10", "1.0.0", "1.0.0"],
  ["1.1.0-beta.1", "1.2.0", "1.2.0"],
  ["1.10.0-beta.10", "1.9.9", "1.10.0-beta.10"],
]) {
  test(`discovery ${selected}, public ${release} selects ${expected}`, async () => {
    const calls = [];
    const session = {
      fetch: async (url, options) => {
        calls.push([url, options.credentials]);
        if (url === feedUrl + manifestName)
          return Response.json({ version: release });
        if (url.endsWith("/desktop-updates/latest.json"))
          return typeof selected === "number"
            ? new Response(null, { status: selected })
            : Response.json({ version: selected });
        return Response.json({
          version: selected,
          files: [
            {
              url: `Plasmic-${selected}-mac-arm64.zip`,
              size: 5,
              sha512: "A".repeat(86) + "==",
            },
          ],
        });
      },
    };
    const feed = createUpdateFeed({
      session,
      studioOrigin,
      partition,
      feedUrl,
      manifestName,
    });
    const info = await feed.latest();
    assert.equal(info.version, expected);
    assert.deepEqual(calls.slice(0, 2), [
      [feedUrl + manifestName, "omit"],
      [studioOrigin + "/desktop-updates/latest.json", "include"],
    ]);
    if (expected === release) {
      assert.equal(calls.length, 2);
    } else {
      const base = `${studioOrigin}/api/v1/desktop-beta/${selected}/${partition}/`;
      assert.deepEqual(calls[2], [base + manifestName, "include"]);
      assert.equal(
        parseManifest(info, release, feedUrl, "arm64", feed.betaUrl).file.url,
        base + info.files[0].url,
      );
    }
  });
}

test("a revoked beta cannot install explicitly or on quit", async () => {
  const updater = new EventEmitter();
  let installs = 0;
  updater.prepareInstallOnQuit = updater.quitAndInstall = async () =>
    installs++;
  const manager = new UpdateManager({
    updater,
    enabled: true,
    version: "1.0.0",
    beforeInstall: async () => {},
    canInstallBeta: async () => false,
  });
  for (const quit of [true, false]) {
    updater.emit("update-downloaded", { version: "1.1.0-beta.1" });
    assert.equal(updater.autoInstallOnAppQuit, false);
    if (quit) await manager.prepareQuit();
    else await manager.command("install");
    assert.equal(installs, 0);
    assert.equal(manager.ready, undefined);
  }
});
