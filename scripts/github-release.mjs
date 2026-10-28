import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  compareVersions,
  validateManifest,
  verifyArtifact,
} from "../packages/plasmic-cli/src/protocol.mjs";
import {
  DESKTOP_FEEDS,
  RESOURCE_RELEASE,
  resourceAssetName,
} from "./release-download-contract.mjs";

async function checksum(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return "sha256:" + hash.digest("hex");
}

export async function collectRelease(plan, root = ".") {
  compareVersions(plan.tag, plan.tag);
  const artifacts = path.resolve(root, "release-artifacts");
  const assets = [];
  const notes = [`Release ${plan.tag}`, ""];
  const add = (name, file) => assets.push({ name, file });
  if (plan.studio) {
    notes.push(
      "Studio images:",
      ...["server", "web", "preview"].map(
        (image) => `- ghcr.io/shiguang-lab/plasmic-${image}:${plan.tag}`,
      ),
      "",
    );
  }
  if (plan.desktop) {
    notes.push(
      await readFile(
        path.join(root, `desktop/release-notes/${plan.tag}.md`),
        "utf8",
      ),
      "",
    );
    const distribution = path.join(artifacts, "desktop-distribution");
    const manifest = JSON.parse(
      await readFile(path.join(distribution, "latest.json"), "utf8"),
    );
    if (manifest.version !== plan.tag)
      throw new Error("Desktop distribution version mismatch");
    add("desktop-latest.json", path.join(distribution, "latest.json"));
    for (const [platform, arch, manifestName, assetName] of [
      ["darwin", "arm64", "latest-mac.yml", "latest-mac-arm64.yml"],
      ["darwin", "x64", "latest-mac.yml", "latest-mac-x64.yml"],
      ["win32", "x64", "latest.yml", "latest.yml"],
      ["linux", "x64", "latest-linux.yml", "latest-linux.yml"],
    ]) {
      add(assetName, path.join(distribution, platform, arch, manifestName));
      const directory = path.join(artifacts, `${platform}-${arch}`);
      const files = (await readdir(directory)).filter((name) =>
        name.startsWith(`Plasmic-${plan.tag}-`),
      );
      if (!files.length)
        throw new Error(`Missing ${platform}-${arch} installers`);
      for (const name of files) add(name, path.join(directory, name));
    }
  }
  if (plan.resources) {
    const directory = path.join(artifacts, `plasmic-resources-${plan.tag}`);
    const manifest = validateManifest(
      JSON.parse(await readFile(path.join(directory, "latest.json"), "utf8")),
    );
    if (manifest.version !== plan.tag)
      throw new Error("Resource distribution version mismatch");
    const release = path.join(directory, "releases", manifest.releaseId);
    const immutable = validateManifest(
      JSON.parse(await readFile(path.join(release, "manifest.json"), "utf8")),
    );
    if (immutable.releaseId !== manifest.releaseId)
      throw new Error("Resource manifest mismatch");
    add("plasmic-latest.json", path.join(directory, "latest.json"));
    add("plasmic-manifest.json", path.join(release, "manifest.json"));
    for (const kind of ["cli", "resources"]) {
      const artifact = manifest.artifacts[kind];
      const file = path.join(release, artifact.file);
      verifyArtifact(await readFile(file), artifact);
      add(artifact.file, file);
    }
    notes.push(
      `Workflow resources ${manifest.version}; npm CLI ${manifest.cliVersion}.`,
      `Resource release ID: ${manifest.releaseId}`,
      "",
    );
  } else if (plan.cli) {
    add("plasmic-cli.tgz", path.join(artifacts, "plasmic-cli/plasmic-cli.tgz"));
  }
  const names = new Set();
  for (const asset of assets) {
    if (names.has(asset.name))
      throw new Error(`Duplicate release asset: ${asset.name}`);
    names.add(asset.name);
    asset.size = (await stat(asset.file)).size;
    asset.digest = await checksum(asset.file);
  }
  return { assets, notes: notes.join("\n") };
}

const gh = (args) =>
  execFileSync("gh", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

export async function publishGitHubRelease(
  { plan, repository, root = ".", rebuild = false },
  runGh = gh,
) {
  if (!plan.publish) return { skipped: true };
  const { assets, notes } = await collectRelease(plan, root);
  const inspect = async (tag = plan.tag) => {
    const endpoint = (
      await runGh([
        "release",
        "view",
        tag,
        "--repo",
        repository,
        "--json",
        "apiUrl",
        "--jq",
        ".apiUrl",
      ])
    ).trim();
    return JSON.parse(await runGh(["api", endpoint]));
  };
  const findRelease = async (tag) => {
    try {
      return await inspect(tag);
    } catch (error) {
      if (!/release not found|HTTP 404/i.test(String(error.stderr)))
        throw error;
    }
  };
  const pages = JSON.parse(
    await runGh([
      "api",
      "--paginate",
      "--slurp",
      `repos/${repository}/releases?per_page=100`,
    ]),
  );
  const history = pages
    .flat()
    .filter(
      (release) =>
        !release.draft &&
        !release.prerelease &&
        /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(release.tag_name),
    )
    .sort((a, b) => compareVersions(b.tag_name, a.tag_name));
  if (
    history.some((release) => compareVersions(release.tag_name, plan.tag) > 0)
  )
    throw new Error(
      "A newer release is already published; refusing to downgrade latest",
    );
  let release = await findRelease(plan.tag);
  const temporary = await mkdtemp(
    path.join(tmpdir(), "plasmic-github-release-"),
  );
  try {
    const body = path.join(temporary, "notes.md");
    await writeFile(body, notes);
    if (!release) {
      await runGh([
        "release",
        "create",
        plan.tag,
        "--repo",
        repository,
        "--verify-tag",
        "--draft",
        "--latest=false",
        "--title",
        plan.tag,
        "--notes-file",
        body,
      ]);
      release = await inspect();
    }
    const downloaded = new Map();
    const download = async (source, name) => {
      const key = `${source.tag_name}/${name}`;
      if (downloaded.has(key)) return downloaded.get(key);
      const expected = source.assets.find(
        (asset) => asset.name === name && asset.state === "uploaded",
      );
      if (!expected?.digest?.startsWith("sha256:"))
        throw new Error(`Missing verified published asset: ${key}`);
      const directory = path.join(temporary, source.tag_name);
      await mkdir(directory, { recursive: true });
      await runGh([
        "release",
        "download",
        source.tag_name,
        "--repo",
        repository,
        "--pattern",
        name,
        "--dir",
        directory,
      ]);
      const file = path.join(directory, name);
      const asset = {
        name,
        file,
        size: (await stat(file)).size,
        digest: await checksum(file),
      };
      if (asset.size !== expected.size || asset.digest !== expected.digest)
        throw new Error(`Published download verification failed: ${key}`);
      downloaded.set(key, asset);
      return asset;
    };
    // Keep complete feed groups together; unchanged products retain their bytes and versions.
    for (const names of [
      Object.values(DESKTOP_FEEDS),
      ["plasmic-latest.json"],
    ]) {
      const present = names.filter((name) =>
        assets.some((asset) => asset.name === name),
      );
      if (present.length === names.length) continue;
      if (present.length) throw new Error("Incomplete newly built feed group");
      const source = history.find(
        (item) =>
          compareVersions(item.tag_name, plan.tag) < 0 &&
          names.every((name) =>
            item.assets.some(
              (asset) => asset.name === name && asset.state === "uploaded",
            ),
          ),
      );
      if (!source)
        throw new Error(
          `No published feed group to reuse: ${names.join(", ")}`,
        );
      for (const name of names) assets.push(await download(source, name));
    }
    const desktop = JSON.parse(
      await readFile(
        assets.find((asset) => asset.name === "desktop-latest.json").file,
        "utf8",
      ),
    );
    compareVersions(desktop.version, desktop.version);
    if (compareVersions(desktop.version, plan.tag) > 0)
      throw new Error("Desktop feed points to a future version");
    for (const name of Object.values(DESKTOP_FEEDS).filter((name) =>
      name.endsWith(".yml"),
    )) {
      const text = await readFile(
        assets.find((asset) => asset.name === name).file,
        "utf8",
      );
      if (
        text.match(
          /^version:\s*["']?([0-9]+\.[0-9]+\.[0-9]+)["']?\r?$/m,
        )?.[1] !== desktop.version
      )
        throw new Error(`Desktop feed versions differ: ${name}`);
    }
    const currentResources = validateManifest(
      JSON.parse(
        await readFile(
          assets.find((asset) => asset.name === "plasmic-latest.json").file,
          "utf8",
        ),
      ),
    );
    if (compareVersions(currentResources.version, plan.tag) > 0)
      throw new Error("Resource feed points to a future version");

    async function upload(tag, existingRelease, selected, allowRebuild) {
      const files = [];
      for (const asset of selected) {
        const existing = existingRelease.assets.find(
          (entry) => entry.name === asset.name,
        );
        if (
          existing?.state === "uploaded" &&
          existing.size === asset.size &&
          existing.digest === asset.digest
        )
          continue;
        if (
          existing &&
          (tag === RESOURCE_RELEASE ||
            (!existingRelease.draft && !allowRebuild))
        )
          throw new Error(
            `Published asset differs: ${asset.name}; publish a new version`,
          );
        const file =
          path.basename(asset.file) === asset.name
            ? asset.file
            : path.join(temporary, asset.name);
        if (file !== asset.file) await copyFile(asset.file, file);
        files.push(file);
      }
      if (files.length)
        await runGh([
          "release",
          "upload",
          tag,
          "--repo",
          repository,
          "--clobber",
          ...files,
        ]);
      const uploaded = await inspect(tag);
      for (const asset of selected) {
        const actual = uploaded.assets.find(
          (entry) => entry.name === asset.name,
        );
        if (
          actual?.state !== "uploaded" ||
          actual.size !== asset.size ||
          actual.digest !== asset.digest
        )
          throw new Error(`Release upload verification failed: ${asset.name}`);
      }
      return uploaded;
    }

    let pool = await findRelease(RESOURCE_RELEASE);
    if (!pool) {
      const poolNotes = path.join(temporary, "resources.md");
      await writeFile(
        poolNotes,
        "Immutable CLI/Skill resources addressed by content hash. Assets are append-only; this release is never latest.\n",
      );
      await runGh([
        "release",
        "create",
        RESOURCE_RELEASE,
        "--repo",
        repository,
        "--target",
        plan.tag,
        "--draft",
        "--latest=false",
        "--title",
        "Plasmic immutable resources",
        "--notes-file",
        poolNotes,
      ]);
      pool = await inspect(RESOURCE_RELEASE);
    }
    // Seed pre-existing numeric resource releases once; old content-hash URLs stay valid.
    const sources = history.filter((item) =>
      item.assets.some((asset) => asset.name === "plasmic-manifest.json"),
    );
    const localManifest = assets.find(
      (asset) => asset.name === "plasmic-manifest.json",
    );
    if (localManifest)
      sources.unshift({ tag_name: plan.tag, local: true, assets });
    for (const source of sources) {
      const original = source.assets.find(
        (asset) => asset.name === "plasmic-manifest.json",
      );
      const known = pool.assets.find(
        (asset) =>
          /^[a-f0-9]{64}-manifest[.]json$/.test(asset.name) &&
          asset.state === "uploaded" &&
          asset.digest === original.digest,
      );
      if (
        known &&
        ["plasmic-cli.tgz", "resources.json.gz"].every((file) =>
          pool.assets.some(
            (asset) =>
              asset.name === known.name.slice(0, 64) + "-" + file &&
              asset.state === "uploaded" &&
              asset.digest ===
                source.assets.find((original) => original.name === file)
                  ?.digest &&
              asset.size ===
                source.assets.find((original) => original.name === file)?.size,
          ),
        )
      )
        continue;
      const manifestAsset = source.local
        ? original
        : await download(source, "plasmic-manifest.json");
      const manifest = validateManifest(
        JSON.parse(await readFile(manifestAsset.file, "utf8")),
      );
      if (manifest.version !== source.tag_name)
        throw new Error("Historical resource manifest version differs");
      const selected = [
        {
          ...manifestAsset,
          name: resourceAssetName(manifest.releaseId, "manifest.json"),
        },
      ];
      for (const artifact of Object.values(manifest.artifacts)) {
        const asset = source.local
          ? assets.find((asset) => asset.name === artifact.file)
          : await download(source, artifact.file);
        verifyArtifact(await readFile(asset.file), artifact);
        selected.push({
          ...asset,
          name: resourceAssetName(manifest.releaseId, artifact.file),
        });
      }
      // The pool is append-only even when repairing/rebuilding a numeric release.
      pool = await upload(RESOURCE_RELEASE, pool, selected, false);
    }
    const manifestName = resourceAssetName(
      currentResources.releaseId,
      "manifest.json",
    );
    if (
      !pool.assets.some(
        (asset) => asset.name === manifestName && asset.state === "uploaded",
      )
    )
      throw new Error(
        "Current resource manifest is missing from the immutable resource release",
      );
    for (const artifact of Object.values(currentResources.artifacts)) {
      const actual = pool.assets.find(
        (asset) =>
          asset.name ===
          resourceAssetName(currentResources.releaseId, artifact.file),
      );
      if (
        actual?.state !== "uploaded" ||
        actual.size !== artifact.size ||
        actual.digest !== `sha256:${artifact.sha256}`
      )
        throw new Error("Current immutable resource artifact differs");
    }
    if (pool.draft)
      await runGh([
        "release",
        "edit",
        RESOURCE_RELEASE,
        "--repo",
        repository,
        "--draft=false",
        "--latest=false",
      ]);
    const uploaded = await upload(plan.tag, release, assets, rebuild);
    if (release.draft || rebuild)
      await runGh([
        "release",
        "edit",
        plan.tag,
        "--repo",
        repository,
        "--draft=false",
        "--latest",
        "--notes-file",
        body,
      ]);
    return {
      url: uploaded.html_url,
      assets: assets.map((asset) => asset.name),
    };
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  console.log(
    JSON.stringify(
      await publishGitHubRelease({
        plan: JSON.parse(process.env.RELEASE_PLAN),
        repository: process.env.GITHUB_REPOSITORY,
        root: process.env.RELEASE_ROOT || ".",
        rebuild: process.env.RELEASE_REBUILD === "true",
      }),
      null,
      2,
    ),
  );
}
