const semver = require("semver");
const YAML = require("yaml");
const { stable, beta } = require("./release-version.cjs");

function createUpdateFeed({
  session,
  feedUrl,
  studioOrigin,
  partition,
  manifestName,
}) {
  const indexUrl = new URL("../../latest.json", feedUrl).href;
  const betaRoot = studioOrigin + "/api/v1/desktop-beta/";
  for (const url of [feedUrl, studioOrigin]) {
    if (new URL(url).protocol !== "https:")
      throw new Error("Updates require HTTPS");
  }
  const betaUrl = (version) => `${betaRoot}${version}/${partition}/`;
  function fetchFile(url, options = {}) {
    const accountRequest =
      (url === indexUrl && new URL(url).origin === studioOrigin) ||
      String(url).startsWith(betaRoot);
    return session.fetch(url, {
      ...options,
      credentials: accountRequest ? "include" : "omit",
      bypassCustomProtocolHandlers: true,
      redirect: "error",
    });
  }
  async function selectedVersion() {
    const response = await fetchFile(indexUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return null;
    return (await response.json()).version;
  }
  async function read(base, timeout) {
    const response = await fetchFile(base + manifestName, {
      cache: "no-store",
      signal: AbortSignal.timeout(timeout),
    });
    if (!response.ok)
      throw new Error(`Update feed returned HTTP ${response.status}`);
    return YAML.parse(await response.text());
  }
  return {
    fetchFile,
    betaUrl,
    async latest() {
      const [release, version] = await Promise.all([
        read(feedUrl, 30000),
        selectedVersion().catch(() => null),
      ]);
      if (!stable.test(release?.version) || !semver.valid(release.version))
        throw new Error("Invalid stable update version");
      // Recompare the actual manifest in case stable advanced during discovery.
      if (
        beta.test(version) &&
        semver.valid(version) &&
        semver.gt(version, release.version)
      ) {
        const candidate = await read(betaUrl(version), 4000).catch(() => null);
        if (candidate?.version === version) return candidate;
      }
      return release;
    },
    async canInstallBeta(version) {
      const selected = await selectedVersion();
      return selected === version;
    },
  };
}

module.exports = { createUpdateFeed };
