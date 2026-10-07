// Runs inside the NAS helper container with the existing desktop update volume.
const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const hash = (data) => createHash("sha256").update(data).digest("hex");

async function promoteResources(root, incoming, manifest) {
  if (!/^[a-f0-9]{64}$/.test(manifest.releaseId)) throw new Error("Invalid release ID");
  const canonical = JSON.stringify(Object.fromEntries(Object.entries(manifest).filter(([key]) => key !== "releaseId")), function (_key, item) {
    return item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item;
  });
  if (hash(canonical) !== manifest.releaseId) throw new Error("Manifest checksum mismatch");
  const source = path.join(incoming, "releases", manifest.releaseId);
  const target = path.join(root, "releases", manifest.releaseId);
  const staging = path.join(root, `.publish-${randomUUID()}`);
  await fs.mkdir(path.join(root, "releases"), { recursive: true, mode: 0o755 });
  const lock = path.join(root, ".publish-lock");
  await fs.mkdir(lock);
  try {
    let current;
    try { current = JSON.parse(await fs.readFile(path.join(root, "latest.json"), "utf8")); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    if (current) {
      const before = current.version.split(".").map(Number), after = manifest.version.split(".").map(Number);
      const changed = after.findIndex((part, index) => part !== before[index]);
      if (changed !== -1 && after[changed] < before[changed]) throw new Error(`Refusing downgrade from ${current.version} to ${manifest.version}`);
      if (changed === -1 && current.releaseId !== manifest.releaseId) throw new Error(`Version ${manifest.version} already published with different resources`);
    }
    for (const kind of ["resources", "cli"]) {
      const artifact = manifest.artifacts[kind];
      if (artifact.file !== (kind === "cli" ? "plasmic-cli.tgz" : "resources.json.gz")) throw new Error("Invalid artifact filename");
      const bytes = await fs.readFile(path.join(source, artifact.file));
      if (bytes.length !== artifact.size || hash(bytes) !== artifact.sha256) throw new Error("Remote artifact checksum mismatch");
    }
    let exists = false;
    try { await fs.stat(target); exists = true; }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    if (exists) {
      for (const artifact of Object.values(manifest.artifacts)) {
        if (hash(await fs.readFile(path.join(target, artifact.file))) !== artifact.sha256) throw new Error("Published immutable release is corrupt");
      }
    } else {
      await fs.mkdir(staging, { mode: 0o755 });
      for (const artifact of Object.values(manifest.artifacts)) {
        await fs.copyFile(path.join(source, artifact.file), path.join(staging, artifact.file));
        await fs.chmod(path.join(staging, artifact.file), 0o644);
      }
      await fs.writeFile(path.join(staging, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", { mode: 0o644 });
      await fs.rename(staging, target);
    }
    // Artifacts are complete before the mutable channel pointer becomes visible.
    await fs.writeFile(staging, JSON.stringify(manifest, null, 2) + "\n", { mode: 0o644 });
    await fs.rename(staging, path.join(root, "latest.json"));
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
    await fs.rmdir(lock);
  }
}
module.exports = { promoteResources };
if (!module.parent) {
  promoteResources("/updates/plasmic", "/incoming", JSON.parse(process.argv[1]))
    .catch((error) => { console.error(error.message); process.exitCode = 1; });
}
