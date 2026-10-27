const fs = require("node:fs/promises");
const { createReadStream, createWriteStream } = require("node:fs");
const { createHash } = require("node:crypto");
const { gunzipSync } = require("node:zlib");
const { pipeline } = require("node:stream/promises");
const { Readable, Transform } = require("node:stream");
const path = require("node:path");
// Use the planner from our pinned electron-updater, with the same session.fetch
// transport as full downloads so cookies, proxy settings and redirects agree.
const { computeOperations, OperationKind } = require("electron-updater/out/differentialDownloader/downloadPlanBuilder");
const { uiError } = require("./ui-error.cjs");

async function digest(file) {
  const hash = createHash("sha512");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("base64");
}

async function matches(file, info) {
  try {
    return (await fs.stat(file)).size === info.size && await digest(file) === info.sha512;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return false;
  }
}

function parseBlockmap(bytes, size) {
  const map = JSON.parse(gunzipSync(bytes, { maxOutputLength: 32 * 1024 * 1024 }));
  const file = map.files?.[0];
  if (map.version !== "2" || map.files.length !== 1 || file.offset !== 0 ||
      typeof file.name !== "string" || !Array.isArray(file.sizes) || !file.sizes.length ||
      !Array.isArray(file.checksums) || file.sizes.length !== file.checksums.length ||
      file.sizes.some((n) => !Number.isSafeInteger(n) || n <= 0) ||
      file.checksums.some((s) => typeof s !== "string" || !/^[A-Za-z0-9+/]{1,128}={0,2}$/.test(s)) ||
      file.sizes.reduce((a, b) => a + b, 0) !== size) {
    throw new Error("Invalid update blockmap");
  }
  return map;
}

async function readBlockmap(fetch, url, size, signal) {
  const response = await fetch(url + ".blockmap", { redirect: "error", signal });
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new Error(`Update blockmap unavailable (${response.status})`);
  }
  const chunks = [];
  let length = 0;
  try {
    for await (const chunk of response.body) {
      length += chunk.length;
      if (length > 8 * 1024 * 1024) throw new Error("Update blockmap too large");
      chunks.push(chunk);
    }
  } catch (error) {
    await response.body.cancel().catch(() => {});
    throw error;
  }
  const bytes = Buffer.concat(chunks);
  return { bytes, map: parseBlockmap(bytes, size) };
}

class RangeError extends Error {}
class IntegrityError extends Error {}

// Every returned range must describe exactly the bytes requested. A server that
// ignores Range must never have its full response appended to a partial archive.
async function request(fetch, file, start, end, ranged, signal) {
  const headers = { "Accept-Encoding": "identity" };
  if (ranged) headers.Range = `bytes=${start}-${end}`;
  const response = await fetch(file.url, { headers, signal, redirect: "error" });
  if (![200, 206, 416].includes(response.status)) {
    await response.body?.cancel();
    throw uiError("Update download failed (HTTP {status})", { status: response.status });
  }
  if (ranged && (response.status !== 206 ||
      response.headers.get("content-range") !== `bytes ${start}-${end}/${file.size}`)) {
    await response.body?.cancel();
    throw new RangeError("Update server did not return the requested range");
  }
  if (!response.ok || !response.body || (!ranged && response.status !== 200)) {
    await response.body?.cancel();
    throw uiError("Update download failed (HTTP {status})", { status: response.status });
  }
  const size = response.headers.get("content-length");
  if (size !== null && Number(size) !== end - start + 1) {
    await response.body.cancel();
    throw new RangeError("Update response size does not match request");
  }
  return response;
}

async function append(source, partial, size, progress, signal) {
  let received = 0;
  await pipeline(source, new Transform({
    transform(chunk, _encoding, done) {
      received += chunk.length;
      if (received > size) return done(new IntegrityError("Update size exceeds manifest"));
      progress(chunk.length);
      done(null, chunk);
    },
  }), createWriteStream(partial, { flags: "a", mode: 0o600 }), { signal });
  if (received !== size) throw new IntegrityError("Update checksum verification failed: incomplete response");
}

async function readJson(file) {
  try { return JSON.parse(await fs.readFile(file, "utf8")); }
  catch (error) {
    if (error.code === "ENOENT" || error instanceof SyntaxError) return null;
    throw error;
  }
}

async function resetPartial(partial, identity) {
  await fs.rm(partial, { force: true });
  await fs.writeFile(partial + ".json", JSON.stringify(identity), { mode: 0o600 });
}

// The previous updater downloaded the same ZIP but did not cache its blockmap.
// Seed that pair while this version is still the current release, so upgrading
// the updater itself does not unnecessarily require a second full download.
async function seedArchive({ fetch, info, archive, arch, source }) {
  const saved = await readJson(archive + ".json");
  if (saved?.version === info.version && saved.arch === arch &&
      saved.file?.sha512 === info.file.sha512 &&
      await fs.stat(archive).then((entry) => entry.size === info.file.size, () => false) &&
      await fs.stat(archive + ".blockmap").then(() => true, () => false)) return;
  if (!await matches(archive, info.file)) {
    if (!source || !await matches(source, info.file)) return;
    await fs.mkdir(path.dirname(archive), { recursive: true, mode: 0o700 });
    await fs.copyFile(source, archive);
  }
  try {
    const blockmap = await readBlockmap(fetch, info.file.url, info.file.size, AbortSignal.timeout(10000));
    await fs.writeFile(archive + ".blockmap", blockmap.bytes, { mode: 0o600 });
    await fs.writeFile(archive + ".json", JSON.stringify({ version: info.version, arch, file: info.file }), { mode: 0o600 });
  } catch (error) {
    console.info("Cannot seed differential update cache:", error.message);
  }
}

async function downloadArchive({ fetch, info, archive, currentVersion, arch, onProgress, signal: cancellationSignal }) {
  cancellationSignal?.throwIfAborted();
  const file = info.file;
  if (await matches(archive, file)) {
    await fs.writeFile(archive + ".json", JSON.stringify({ version: info.version, arch, file }), { mode: 0o600 });
    await fs.rm(archive + ".partial", { force: true });
    await fs.rm(archive + ".partial.json", { force: true });
    onProgress({ percent: 100 });
    return;
  }
  const timeout = AbortSignal.timeout(30 * 60 * 1000);
  const signal = cancellationSignal ? AbortSignal.any([timeout, cancellationSignal]) : timeout;
  const partial = archive + ".partial";
  const identity = { url: file.url, size: file.size, sha512: file.sha512 };
  const saved = await readJson(partial + ".json");
  if (!saved || Object.keys(identity).some((key) => saved[key] !== identity[key])) {
    await resetPartial(partial, identity);
  }
  let offset = (await fs.stat(partial).catch((error) => {
    if (error.code !== "ENOENT") throw error;
    return { size: 0 };
  })).size;
  if (offset > file.size) {
    await resetPartial(partial, identity);
    offset = 0;
  }
  let lastPercent = -1;
  const progress = (length = 0) => {
    offset += length;
    // 100 means the complete archive has also passed its SHA-512 check.
    const percent = Math.min(99, Math.floor(offset / file.size * 100));
    if (percent !== lastPercent) { lastPercent = percent; onProgress({ percent }); }
  };
  progress();

  let blockmap;
  try {
    blockmap = await readBlockmap(fetch, file.url, file.size, AbortSignal.any([signal, AbortSignal.timeout(30000)]));
  } catch (error) {
    console.info("Update uses full download:", error.message);
  }
  let operations, base;
  if (blockmap) {
    try {
      base = path.join(path.dirname(archive), `Plasmic-${currentVersion}${path.extname(archive)}`);
      const previous = await readJson(base + ".json");
      if (previous?.version === currentVersion && previous.arch === arch &&
          Number.isSafeInteger(previous.file?.size) && previous.file.size > 0 &&
          /^[A-Za-z0-9+/]{86}==$/.test(previous.file.sha512) && await matches(base, previous.file)) {
        const oldMap = parseBlockmap(await fs.readFile(base + ".blockmap"), previous.file.size);
        operations = computeOperations(oldMap, blockmap.map, { info: console.info, warn: console.warn });
        if (!operations.some((op) => op.kind === OperationKind.COPY)) operations = null;
      }
    } catch (error) {
      console.info("Update uses full download:", error.message);
    }
  }

  const fullDownload = async () => {
    if (offset === file.size) return;
    let response;
    try {
      response = await request(fetch, file, offset, file.size - 1, offset > 0, signal);
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      await resetPartial(partial, identity);
      offset = 0;
      progress();
      response = await request(fetch, file, 0, file.size - 1, false, signal);
    }
    await append(Readable.fromWeb(response.body), partial, file.size - offset, progress, signal);
  };
  try {
    if (operations && offset < file.size) {
      try {
        let position = 0;
        for (const op of operations) {
          signal.throwIfAborted();
          const length = op.end - op.start;
          const skip = Math.max(0, Math.min(length, offset - position));
          position += length;
          if (skip === length) continue;
          const start = op.start + skip;
          const source = op.kind === OperationKind.COPY
            ? createReadStream(base, { start, end: op.end - 1 })
            : Readable.fromWeb((await request(fetch, file, start, op.end - 1, true, signal)).body);
          await append(source, partial, length - skip, progress, signal);
        }
        if (!await matches(partial, file)) throw new IntegrityError("Differential update checksum verification failed");
      } catch (error) {
        if (!(error instanceof RangeError || error instanceof IntegrityError)) throw error;
        console.info("Differential update falling back to full download:", error.message);
        if (error instanceof IntegrityError) blockmap = null;
        await resetPartial(partial, identity);
        offset = 0;
        progress();
        await fullDownload();
      }
    } else {
      await fullDownload();
    }
    if (!await matches(partial, file)) throw new IntegrityError("Update checksum verification failed");
    // Keep a matching ZIP and blockmap for the next version; never cache a pair
    // based only on the version number or a successful HTTP response.
    await fs.rename(partial, archive);
    if (blockmap) await fs.writeFile(archive + ".blockmap", blockmap.bytes, { mode: 0o600 });
    else await fs.rm(archive + ".blockmap", { force: true });
    await fs.writeFile(archive + ".json", JSON.stringify({ version: info.version, arch, file }), { mode: 0o600 });
    await fs.rm(partial + ".json", { force: true });
    onProgress({ percent: 100 });
  } catch (error) {
    if (error instanceof IntegrityError) {
      await fs.rm(partial, { force: true });
      await fs.rm(partial + ".json", { force: true });
    }
    // Interrupted network transfers retain their target-bound prefix for retry,
    // including retries after the application or computer restarts.
    throw error;
  }
}

module.exports = { downloadArchive, parseBlockmap, seedArchive };
