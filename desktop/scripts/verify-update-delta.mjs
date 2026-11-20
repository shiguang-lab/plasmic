// Measure archive bytes with the production downloader before publishing.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { appendFile, copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import semver from "semver";
import YAML from "yaml";
import { buildBlockMap } from "app-builder-lib/out/targets/blockmap/blockmap.js";
import { computeOperations, OperationKind } from "electron-updater/out/differentialDownloader/downloadPlanBuilder.js";
import { downloadArchive, parseBlockmap } from "../src/update-download.cjs";
import { digest, manifestNames } from "./release-artifacts.mjs";
import { verifyMacSignature } from "./local-signing.mjs";

const [directory, platform, arch, localBase] = process.argv.slice(2);
const extension = { darwin: ".zip", win32: ".exe", linux: ".AppImage" }[platform];
const manifestName = manifestNames[platform];
const target = YAML.parse(await readFile(path.join(directory, manifestName), "utf8"));
const file = target.files.find(entry => entry.url.endsWith(extension));
const archive = path.join(directory, file.url);
const temp = await mkdtemp(path.join(os.tmpdir(), "delta-"));

async function baseline() {
  if (localBase) {
    const version = /^Plasmic-(\d+\.\d+\.\d+(?:-beta\.\d+)?)-/.exec(path.basename(localBase))?.[1];
    assert(semver.valid(version) && semver.lt(version, target.version), "Expected an older versioned installer");
    return { archive: localBase, version };
  }
  const config = JSON.parse(await readFile(new URL("../desktop.config.json", import.meta.url), "utf8"));
  const feed = new URL(`${config.updateUrl}/${platform}/${arch}/`);
  const res = await fetch(new URL(manifestName, feed), { signal: AbortSignal.timeout(30000) });
  if (res.status === 404) return;
  if (!res.ok) throw new Error(`Cannot read deployed version (HTTP ${res.status})`);
  const previous = YAML.parse(await res.text());
  if (!semver.lt(previous.version, target.version)) return;
  const installer = previous.files.find(entry => entry.url.endsWith(extension));
  assert.equal(path.basename(installer.url), installer.url);
  // The public feed proxies these immutable GitHub Release assets. Download
  // them directly on build runners and verify against the deployed manifest.
  const release = new URL(`https://github.com/shiguang-lab/plasmic/releases/download/${previous.version}/`);
  const result = await fetch(new URL(installer.url, release), { signal: AbortSignal.timeout(300000) });
  if (!result.ok) throw new Error(`Cannot download baseline (HTTP ${result.status})`);
  const saved = path.join(temp, installer.url);
  await pipeline(Readable.fromWeb(result.body), createWriteStream(saved));
  assert.equal(await digest(saved), installer.sha512, "Deployed baseline SHA-512");
  // Use the release's actual map, including maps made by older builders.
  const map = await fetch(new URL(installer.url + ".blockmap", release), { signal: AbortSignal.timeout(30000) });
  if (!map.ok) throw new Error(`Cannot download baseline blockmap (HTTP ${map.status})`);
  await writeFile(saved + ".blockmap", Buffer.from(await map.arrayBuffer()));
  return { archive: saved, version: previous.version };
}

async function reconstruct(base, version, label) {
  const cache = path.join(temp, label);
  await mkdir(cache);
  const cached = path.join(cache, `Plasmic-${version}${extension}`);
  await copyFile(base, cached);
  await copyFile(base + ".blockmap", cached + ".blockmap");
  const previous = { size: (await stat(cached)).size, sha512: await digest(cached) };
  await writeFile(cached + ".json", JSON.stringify({ arch, version, file: previous }));
  const oldMap = parseBlockmap(await readFile(cached + ".blockmap"), previous.size);
  const newMap = parseBlockmap(await readFile(archive + ".blockmap"), file.size);
  const planned = computeOperations(oldMap, newMap, { info() {}, warn: console.warn })
    .filter(op => op.kind === OperationKind.DOWNLOAD)
    .reduce((total, op) => total + op.end - op.start, 0);
  const output = path.join(cache, `Plasmic-${target.version}${extension}`);
  let bytes = 0, ranges = 0;
  await downloadArchive({
    arch, archive: output, info: { version: target.version, file }, onProgress() {},
    fetch: async (url, options) => {
      if (url === file.url + ".blockmap") return new Response(await readFile(archive + ".blockmap"));
      assert.equal(url, file.url);
      const range = options.headers.Range;
      if (!range) {
        bytes += file.size;
        return new Response(Readable.toWeb(createReadStream(archive)));
      }
      const [, first, last] = /^bytes=(\d+)-(\d+)$/.exec(range);
      const start = Number(first), end = Number(last);
      ranges++;
      bytes += end - start + 1;
      return new Response(Readable.toWeb(createReadStream(archive, { start, end, signal: options.signal })), {
        status: 206, headers: { "Content-Range": `bytes ${start}-${end}/${file.size}` },
      });
    },
  });
  assert.equal(bytes, planned, "Downloader must reuse every matching block in the plan");
  assert.equal(await digest(output), file.sha512, "Reconstructed installer SHA-512");
  const line = `${platform}/${arch} ${version} → ${target.version} (${label}): ${bytes} / ${file.size} archive bytes, ${ranges} ranges, SHA-512 verified`;
  console.log(line);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, line + "\n\n");
  return output;
}

async function verifyMacStartup(zip) {
  execFileSync("/usr/bin/ditto", ["-x", "-k", zip, temp]);
  const app = path.join(temp, "Plasmic.app");
  verifyMacSignature(app);
  const version = execFileSync("/usr/bin/plutil", ["-extract", "CFBundleShortVersionString", "raw", "-o", "-", path.join(app, "Contents/Info.plist")], { encoding: "utf8" }).trim();
  assert.equal(version, target.version);
  const profile = path.join(temp, "profile");
  const child = spawn(path.join(app, "Contents/MacOS/Plasmic"), [], {
    env: { ...process.env, PLASMIC_DESKTOP_PROFILE: profile }, stdio: "ignore",
  });
  const exited = new Promise((resolve, reject) => { child.once("exit", resolve); child.once("error", reject); });
  try {
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
      const log = await readFile(path.join(profile, "logs/lifecycle.log"), "utf8").catch(error => {
        if (error.code !== "ENOENT") throw error;
        return "";
      });
      if (log.includes('"event":"startup.ready"')) { console.log(`Verified macOS startup ${version}`); return; }
      if (child.exitCode !== null || child.signalCode || log.includes('"event":"startup.failed"')) throw new Error("Reconstructed application failed to start: " + log.slice(-2000));
      await Promise.race([delay(250), exited]);
    }
    throw new Error("Timed out waiting for packaged startup");
  } finally {
    if (child.pid && child.exitCode === null && !child.signalCode) {
      child.kill("SIGTERM");
      const timeout = setTimeout(() => child.kill("SIGKILL"), 5000);
      try { await exited; } finally { clearTimeout(timeout); }
    }
  }
}

try {
  const previous = await baseline();
  let verified = archive;
  if (previous) {
    verified = await reconstruct(previous.archive, previous.version, localBase ? "local-baseline" : "deployed-format");
    if (platform === "darwin" && !localBase) {
      const before = await digest(previous.archive);
      execFileSync("go", ["run", fileURLToPath(new URL("./mac-update-zip.go", import.meta.url)), previous.archive]);
      if (await digest(previous.archive) !== before) {
        await buildBlockMap(previous.archive, "gzip", previous.archive + ".blockmap");
        verified = await reconstruct(previous.archive, previous.version, "repacked-baseline");
      }
    }
  } else {
    console.log(`No older deployed ${platform}/${arch} release to compare with ${target.version}`);
  }
  if (platform === "darwin") await verifyMacStartup(verified);
} finally {
  await rm(temp, { recursive: true, force: true });
}
