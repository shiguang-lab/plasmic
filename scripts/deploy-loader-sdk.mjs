import { execFileSync } from "node:child_process";
import { lstat, readdir, realpath, unlink, symlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function verifyLoaderDeployment(target) {
  const root = await realpath(target);
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        const resolved = await realpath(file);
        if (resolved !== root && !resolved.startsWith(root + path.sep)) {
          throw new Error(`SDK deployment link escapes its package: ${file}`);
        }
      } else if (entry.isDirectory()) await visit(file);
    }
  }
  await visit(root);
}

export async function finalizeLoaderDeployment(target) {
  // pnpm legacy deploy retains the workspace's self-reference to its build path.
  // Make that existing reference relative to the deployed package before copying it.
  const self = path.join(target, "node_modules/@plasmicapp/loader-react");
  if (!(await lstat(self)).isSymbolicLink()) throw new Error("Expected the SDK workspace self-reference");
  await unlink(self);
  await symlink(path.relative(path.dirname(self), target), self, "dir");
  await verifyLoaderDeployment(target);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) throw new Error("SDK deployment destination required");
  const target = path.resolve(process.argv[2]);
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  execFileSync(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["--filter", "@plasmicapp/loader-react", "deploy", "--prod", "--legacy", "--frozen-lockfile", "--ignore-scripts", target], { cwd: root, stdio: "inherit" });
  await finalizeLoaderDeployment(target);
}
