import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import {
  MODE_REFERENCES,
  releaseId,
  sha256,
} from "../../packages/plasmic-cli/src/protocol.mjs";
import { collectRelease } from "../github-release.mjs";

export async function fixture(t, products, tag = "1.2.3") {
  const root = await mkdtemp(path.join(tmpdir(), "github-release-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const plan = { tag, publish: true, ...products };
  const put = async (name, content) => {
    const file = path.join(root, name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
  };
  const base = "release-artifacts/";
  if (plan.cli) await put(base + "plasmic-cli/plasmic-cli.tgz", "CLI");
  if (plan.desktop) {
    await put(`desktop/release-notes/${plan.tag}.md`, "Desktop fixes");
    await put(
      base + "desktop-distribution/latest.json",
      JSON.stringify({ version: plan.tag }),
    );
    for (const [platform, arch, manifest, suffix] of [
      ["darwin", "arm64", "latest-mac.yml", "mac-arm64.zip"],
      ["darwin", "x64", "latest-mac.yml", "mac-x64.zip"],
      ["win32", "x64", "latest.yml", "win-x64.exe"],
      ["linux", "x64", "latest-linux.yml", "linux-x86_64.AppImage"],
    ]) {
      await put(
        base + `${platform}-${arch}/Plasmic-${plan.tag}-${suffix}`,
        "installer",
      );
      await put(
        base + `${platform}-${arch}/Plasmic-${plan.tag}-${suffix}.blockmap`,
        "blockmap",
      );
      await put(base + `${platform}-${arch}/${manifest}`, "original manifest");
      await put(
        base + `desktop-distribution/${platform}/${arch}/${manifest}`,
        `version: ${plan.tag}\n# localized ${arch}`,
      );
    }
  }
  if (plan.resources) {
    const files = [
      ...new Set([
        "references/guide.md",
        "references/desktop-mcp.md",
        "references/inspect.md",
        "references/prototype.md",
        "references/codegen.md",
        ...Object.values(MODE_REFERENCES).flat(),
      ]),
    ].map((name) => ({ path: name, content: "reference" }));
    const resources = gzipSync(JSON.stringify({ schemaVersion: 1, files }));
    const cli = Buffer.from("CLI");
    const manifest = {
      schemaVersion: 1,
      version: plan.tag,
      cliVersion: "1.2.2",
      minCliVersion: "0.0.59",
      entrypoints: Object.fromEntries(
        ["guide", "inspect", "prototype", "codegen"].map((mode) => [
          mode,
          `references/${mode}.md`,
        ]),
      ),
      files: files.map((file) => ({
        path: file.path,
        size: Buffer.byteLength(file.content),
        sha256: sha256(file.content),
      })),
      artifacts: {
        cli: { file: "plasmic-cli.tgz", size: cli.length, sha256: sha256(cli) },
        resources: {
          file: "resources.json.gz",
          size: resources.length,
          sha256: sha256(resources),
        },
      },
    };
    manifest.releaseId = releaseId(manifest);
    const directory = base + `plasmic-resources-${plan.tag}/`;
    await put(directory + "latest.json", JSON.stringify(manifest));
    await put(
      directory + `releases/${manifest.releaseId}/manifest.json`,
      JSON.stringify(manifest),
    );
    await put(
      directory + `releases/${manifest.releaseId}/plasmic-cli.tgz`,
      cli,
    );
    await put(
      directory + `releases/${manifest.releaseId}/resources.json.gz`,
      resources,
    );
  }
  return { root, plan, repository: "example/plasmic" };
}

export async function githubFixture(
  t,
  { failOnce = false, wrongDigest = false, seed = true, existing } = {},
) {
  const calls = [],
    releases = new Map(),
    bodies = new Map();
  let latest;
  const add = (tag, assets, draft = false) => {
    const record = {
      id: releases.size + 1,
      tag_name: tag,
      draft,
      prerelease: false,
      assets: [],
      html_url: `https://github.com/example/plasmic/releases/tag/${tag}`,
    };
    for (const asset of assets)
      record.assets.push({
        name: asset.name,
        size: asset.size,
        digest: asset.digest,
        state: "uploaded",
      });
    releases.set(tag, record);
    return record;
  };
  if (seed) {
    const baseline = await fixture(
      t,
      { desktop: true, resources: true },
      "1.2.2",
    );
    const collected = await collectRelease(baseline.plan, baseline.root);
    add("1.2.2", collected.assets);
    for (const asset of collected.assets)
      bodies.set(`1.2.2/${asset.name}`, await readFile(asset.file));
    latest = "1.2.2";
  }
  if (existing) Object.assign(add("1.2.3", []), existing);
  const run = async (args) => {
    calls.push(args);
    if (args[0] === "api") {
      if (args.includes("--paginate"))
        return JSON.stringify([[...releases.values()]]);
      const record = args[1].includes("/tags/")
        ? releases.get(args[1].split("/").at(-1))
        : [...releases.values()].find(
            (record) => String(record.id) === args[1].split("/").at(-1),
          );
      if (!record || (args[1].includes("/tags/") && record.draft))
        throw Object.assign(new Error("Not found"), { stderr: "HTTP 404" });
      return JSON.stringify(record);
    }
    const tag = args[2];
    if (args[1] === "view") {
      if (!releases.has(tag))
        throw Object.assign(new Error("Not found"), {
          stderr: "release not found",
        });
      return `https://api.github.com/repos/example/plasmic/releases/${releases.get(tag).id}\n`;
    }
    if (args[1] === "create") add(tag, [], true);
    if (args[1] === "download") {
      const name = args[args.indexOf("--pattern") + 1];
      await writeFile(
        path.join(args[args.indexOf("--dir") + 1], name),
        bodies.get(`${tag}/${name}`),
      );
    }
    if (args[1] === "upload") {
      const record = releases.get(tag);
      for (const file of args.slice(args.indexOf("--clobber") + 1)) {
        const name = path.basename(file),
          bytes = await readFile(file);
        const asset = {
          name,
          size: bytes.length,
          digest: "sha256:" + sha256(bytes),
          state: "uploaded",
        };
        if (wrongDigest) asset.digest = "sha256:wrong";
        record.assets = record.assets
          .filter((entry) => entry.name !== name)
          .concat(asset);
        bodies.set(`${tag}/${name}`, bytes);
        if (failOnce) {
          failOnce = false;
          throw new Error("Upload interrupted");
        }
      }
    }
    if (args[1] === "edit") {
      releases.get(tag).draft = false;
      if (args.includes("--latest")) latest = tag;
    }
    return "";
  };
  return {
    calls,
    run,
    releases,
    bodies,
    release: (tag = "1.2.3") => releases.get(tag),
    latest: () => latest,
  };
}
