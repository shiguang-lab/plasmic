// Executed by a temporary NAS container with a writable update-volume mount.
const fs = require("node:fs/promises");
const { createReadStream } = require("node:fs");
const { createHash, randomUUID } = require("node:crypto");
const path = require("node:path");
async function promoteRelease(root, incoming, manifestName, manifest) {
  const lock = path.join(root, ".publish-lock");
  const staging = path.join(root, `.upload-${randomUUID()}`);
  await fs.mkdir(root, { recursive: true, mode: 0o755 });
  await fs.mkdir(lock);
  try {
    let current;
    try { current = await fs.readFile(path.join(root, manifestName), "utf8"); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    if (current) {
      const version = current.split("\n").find((line) => line.startsWith("version: "))?.slice(9).trim().replace(/^['"]|['"]$/g, "");
      if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("Cannot read current NAS version");
      const before = version.split(".").map(Number), after = manifest.version.split(".").map(Number);
      const changed = after.findIndex((value, index) => value !== before[index]);
      if (changed < 0 || after[changed] < before[changed]) throw new Error("Release must be newer than current NAS version");
    }
    for (const file of manifest.files) {
      const source = path.join(incoming, file.url);
      if ((await fs.stat(source)).size !== file.size) throw new Error("Remote artifact size mismatch");
      const hash = createHash("sha512");
      for await (const chunk of createReadStream(source)) hash.update(chunk);
      if (hash.digest("base64") !== file.sha512) throw new Error("Remote checksum mismatch");
    }
    const artifacts = new Set(manifest.files.map((file) => file.url));
    const files = (await fs.readdir(incoming)).filter((file) => file === manifestName || artifacts.has(file) || (file.endsWith(".blockmap") && artifacts.has(file.slice(0, -9))));
    for (const file of files.filter((file) => file !== manifestName)) {
      try { await fs.stat(path.join(root, file)); throw new Error("Version artifact already exists; never overwrite published releases"); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
    }
    await fs.mkdir(staging, { mode: 0o755 });
    for (const file of files) {
      await fs.copyFile(path.join(incoming, file), path.join(staging, file));
      await fs.chmod(path.join(staging, file), 0o644);
    }
    for (const file of files.filter((file) => file !== manifestName)) await fs.rename(path.join(staging, file), path.join(root, file));
    await fs.rename(path.join(staging, manifestName), path.join(root, manifestName));
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
    await fs.rmdir(lock);
  }
}
module.exports = { promoteRelease };
if (!module.parent) {
  const [partition, manifestName, manifestJson] = process.argv.slice(1);
  promoteRelease(path.join("/updates", partition), "/incoming", manifestName, JSON.parse(manifestJson))
    .catch((error) => { console.error(error.message); process.exitCode = 1; });
}
