import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const canvas = path.join(repo, "platform/canvas-packages");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const manifest = JSON.parse(await readFile(path.join(canvas, "package.json"), "utf8"));
const projects = JSON.parse(execFileSync(pnpm, ["-r", "list", "--depth", "-1", "--json"], { cwd: repo, encoding: "utf8" }));
const workspaceByPath = new Map(projects.map((project) => [path.resolve(project.path), project.name]));
const filters = [...new Set(Object.values({ ...manifest.dependencies, ...manifest.devDependencies })
  .filter((specifier) => specifier.startsWith("link:"))
  .map((specifier) => path.resolve(canvas, specifier.slice("link:".length)))
  .filter((directory) => workspaceByPath.has(directory))
  .map((directory) => `${workspaceByPath.get(directory)}...`))];

// pnpm selects the local SDK dependencies and builds them in dependency order.
// Internal Canvas packages belong to the platform workspace and are not selected.
execFileSync(pnpm, ["--recursive", "--workspace-concurrency=2", ...filters.flatMap((filter) => ["--filter", filter]), "run", "build"], { cwd: repo, stdio: "inherit" });
