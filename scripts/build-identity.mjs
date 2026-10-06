import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export async function hashFiles(root, names, exclude = []) {
  const hash = createHash("sha256");
  async function visit(relative) {
    if (exclude.includes(relative)) return;
    const file = path.join(root, relative);
    const entries = await readdir(file, { withFileTypes: true }).catch(
      (error) => {
        if (error.code === "ENOTDIR") return null;
        throw error;
      },
    );
    if (entries) {
      for (const entry of entries.sort((a, b) =>
        a.name.localeCompare(b.name),
      )) {
        await visit(path.join(relative, entry.name));
      }
    } else {
      hash.update(relative.replaceAll(path.sep, "/") + "\0");
      hash.update(await readFile(file));
      hash.update("\0");
    }
  }
  for (const name of [...names].sort()) await visit(name);
  return hash.digest("hex");
}

export async function sourceIdentity(repo) {
  const git = (...args) =>
    execFileSync("git", args, {
      cwd: repo,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    }).trim();
  const names = git(
    "ls-files",
    "-z",
    "--cached",
    "--others",
    "--exclude-standard",
  )
    .split("\0")
    .filter(Boolean);
  const deleted = new Set(git("ls-files", "-z", "--deleted").split("\0"));
  return {
    revision: git("rev-parse", "HEAD"),
    dirty: !!git("status", "--porcelain"),
    sourceHash: await hashFiles(
      repo,
      [...new Set(names)].filter((name) => !deleted.has(name)),
    ),
  };
}

export async function readStudioBuild(source, repo) {
  const build = JSON.parse(
    await readFile(path.join(source, "studio-build.json"), "utf8"),
  );
  if (
    build.artifactHash !==
    (await hashFiles(source, ["."], ["studio-build.json"]))
  ) {
    throw new Error(
      "Studio build assets changed; rebuild Studio before packaging.",
    );
  }
  if (build.sourceHash !== (await sourceIdentity(repo)).sourceHash) {
    throw new Error(
      "Studio build sources changed; rebuild Studio before packaging.",
    );
  }
  return build;
}

export const desktopSources = [
  "src",
  "package.json",
  "desktop.config.json",
  "mcp-guide.md",
];
