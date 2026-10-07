import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { createRequire } from "node:module";

export const DEFAULT_FEED = "https://plasmic.studio.publib.cn/desktop-updates/plasmic";
export const CLI_VERSION = createRequire(import.meta.url)("../package.json").version;
export const MIN_CLI_VERSION = "0.0.34";
export const CODEGEN_REFERENCES = [
  "references/codegen/page-reading.md",
  "references/codegen/project-code.md",
  "references/codegen/interactions.md",
  "references/codegen/acceptance.md",
];
export function compareVersions(a, b) {
  const parse = (version) => {
    if (typeof version !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) throw new Error(`Invalid stable version: ${version}`);
    const parts = version.split(".").map(Number);
    if (!parts.every(Number.isSafeInteger)) throw new Error(`Invalid stable version: ${version}`);
    return parts;
  };
  const left = parse(a), right = parse(b);
  const changed = left.findIndex((part, index) => part !== right[index]);
  return changed === -1 ? 0 : left[changed] > right[changed] ? 1 : -1;
}
export const MAX_BYTES = 16 * 1024 * 1024;
export const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const canonical = (value) => JSON.stringify(value, function (_key, item) {
  return item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item;
});
export function releaseId(manifest) {
  const { releaseId: _id, ...content } = manifest;
  return sha256(canonical(content));
}
export function resourcePath(name) {
  if (typeof name !== "string" || !/^(references|scripts)\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(md|py|json)$/.test(name)) {
    throw new Error(`Invalid resource path: ${name}`);
  }
  return name;
}
export function validateManifest(manifest) {
  if (!manifest || manifest.schemaVersion !== 1 || !/^\d+\.\d+\.\d+$/.test(manifest.version) ||
      !/^\d+\.\d+\.\d+$/.test(manifest.minCliVersion) || manifest.releaseId !== releaseId(manifest)) {
    throw new Error("Invalid resource manifest or release checksum");
  }
  if (compareVersions(manifest.minCliVersion, manifest.version) > 0) throw new Error("Required CLI version exceeds release version");
  const files = new Map();
  if (!Array.isArray(manifest.files) || !manifest.files.length) throw new Error("Empty resource manifest");
  for (const file of manifest.files) {
    resourcePath(file.path);
    if (files.has(file.path) || !/^[a-f0-9]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.size) || file.size < 0 || file.size > MAX_BYTES) {
      throw new Error("Invalid or duplicate resource entry");
    }
    files.set(file.path, file);
  }
  for (const mode of ["guide", "prototype", "codegen"]) {
    const entry = manifest.entrypoints?.[mode];
    if (!files.has(entry) || !entry.startsWith("references/") || !entry.endsWith(".md")) throw new Error(`Missing ${mode} entrypoint`);
  }
  if (!files.has("references/desktop-mcp.md")) throw new Error("Missing Desktop MCP reference");
  for (const reference of CODEGEN_REFERENCES) {
    if (!files.has(reference)) throw new Error(`Missing code-generation standard: ${reference}`);
  }
  for (const [kind, name] of [["resources", "resources.json.gz"], ["cli", "plasmic-cli.tgz"]]) {
    const artifact = manifest.artifacts?.[kind];
    if (!artifact || artifact.file !== name || !/^[a-f0-9]{64}$/.test(artifact.sha256) ||
        !Number.isSafeInteger(artifact.size) || artifact.size <= 0 || artifact.size > MAX_BYTES) throw new Error(`Invalid ${kind} artifact`);
  }
  return manifest;
}
export function verifyArtifact(bytes, artifact) {
  if (bytes.length !== artifact.size || sha256(bytes) !== artifact.sha256) throw new Error(`Artifact checksum mismatch: ${artifact.file}`);
}
export function unpackResources(bytes, manifest) {
  verifyArtifact(bytes, manifest.artifacts.resources);
  const bundle = JSON.parse(gunzipSync(bytes, { maxOutputLength: MAX_BYTES }).toString("utf8"));
  if (bundle.schemaVersion !== 1 || !Array.isArray(bundle.files) || bundle.files.length !== manifest.files.length) throw new Error("Resource bundle does not match manifest");
  const expected = new Map(manifest.files.map((file) => [file.path, file]));
  for (const file of bundle.files) {
    resourcePath(file.path);
    const entry = expected.get(file.path);
    if (!entry || typeof file.content !== "string" || Buffer.byteLength(file.content) !== entry.size || sha256(file.content) !== entry.sha256) {
      throw new Error(`Resource checksum mismatch: ${file.path}`);
    }
    expected.delete(file.path);
  }
  return bundle.files;
}
export function feedUrl(value = process.env.PLASMIC_RESOURCE_URL || DEFAULT_FEED) {
  const url = new URL(value.replace(/\/+$/, "") + "/");
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname))) {
    throw new Error("Resource feed must use HTTPS (HTTP is allowed only for loopback tests)");
  }
  if (url.search || url.hash || url.username || url.password) throw new Error("Invalid resource feed URL");
  return url.href;
}
export function artifactUrl(feed, manifest, kind) {
  return new URL(`releases/${manifest.releaseId}/${manifest.artifacts[kind].file}`, feed).href;
}
export function requiresNewCli(minimum, current = CLI_VERSION) {
  return compareVersions(minimum, current) > 0;
}
