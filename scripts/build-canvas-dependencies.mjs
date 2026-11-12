import { execFileSync, spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
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
const child = spawn(pnpm, ["--reporter=append-only", "--recursive", "--workspace-concurrency=2", ...filters.flatMap((filter) => ["--filter", filter]), "run", "build"], { cwd: repo, stdio: ["inherit", "pipe", "inherit"] });

const finished = new Promise((resolve, reject) => {
  child.on("error", reject);
  child.on("exit", (code, signal) => code === 0 ? resolve() : reject(new Error(`Canvas dependency build failed: ${signal ?? code}`)));
});
const starts = new Map();
await Promise.all([finished, (async () => {
  for await (const line of createInterface({ input: child.stdout, crlfDelay: Infinity })) {
    console.log(line);
    const start = line.match(/^(\S+) build\$/);
    if (start) starts.set(start[1], performance.now());
    const done = line.match(/^(\S+) build: Done$/);
    if (done && starts.has(done[1])) {
      console.log("[canvas-dependency-timing] " + JSON.stringify({
        package: done[1], seconds: (performance.now() - starts.get(done[1])) / 1000,
      }));
    }
  }
})()]);
