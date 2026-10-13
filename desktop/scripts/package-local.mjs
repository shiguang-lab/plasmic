import { execFileSync } from "node:child_process";
import { mkdir, readFile, rename, rm, symlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const desktop = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const repo = path.dirname(desktop);
const config = JSON.parse(
  await readFile(path.join(desktop, "desktop.config.json"), "utf8"),
);
const env = {
  ...process.env,
  NODE_ENV: "production",
  PLASMIC_SELF_HOSTED: "1",
  NODE_OPTIONS: "--max-old-space-size=16384",
  PUBLIC_URL: config.studioOrigin,
  STATIC_URL: config.studioOrigin,
};
const linked = [];
try {
  // Both workspaces must resolve the same local SDK and component builds.
  for (const consumer of [
    "platform/wab",
    "platform/canvas-packages",
    "platform/react-web-bundle",
    "plasmicpkgs/antd6",
    "plasmicpkgs/overseas",
  ]) {
    const links = { "@plasmicapp/host": "packages/host" };
    if (consumer.startsWith("platform/")) {
      links["@plasmicapp/react-web"] = "packages/react-web";
    }
    if (consumer === "platform/canvas-packages") {
      links["@shiguang-lab/plasmic-antd6"] = "plasmicpkgs/antd6";
      links["@shiguang-lab/plasmic-overseas"] = "plasmicpkgs/overseas";
    }
    for (const [name, source] of Object.entries(links)) {
      const target = path.join(repo, consumer, "node_modules", name);
      await mkdir(path.dirname(target), { recursive: true });
      const backup = `${target}.package-local-${process.pid}`;
      let existed = true;
      try {
        await rename(target, backup);
      } catch (error) {
        if (error.code !== "ENOENT") {
          throw error;
        }
        existed = false;
      }
      linked.push({ target, backup, existed });
      await symlink(
        path.join(repo, source),
        target,
        process.platform === "win32" ? "junction" : "dir",
      );
    }
  }
  for (const directory of [
    "packages/host",
    "packages/react-web",
    "platform/react-web-bundle",
    "plasmicpkgs/overseas",
    "plasmicpkgs/antd6",
    "platform/canvas-packages",
    "platform/sub",
  ]) {
    execFileSync(
      process.platform === "win32" ? "npm.cmd" : "npm",
      ["run", "build"],
      {
        cwd: path.join(repo, directory),
        env,
        stdio: "inherit",
      },
    );
  }
  execFileSync(
    process.execPath,
    [path.join(repo, "scripts/build-studio.mjs")],
    {
      env,
      stdio: "inherit",
    },
  );
  execFileSync(
    process.execPath,
    [
      path.join(desktop, "scripts/prepare-assets.mjs"),
      "--from",
      path.join(repo, "platform/wab/build"),
    ],
    { stdio: "inherit" },
  );
  execFileSync(process.execPath, [path.join(desktop, "scripts/package.mjs")], {
    stdio: "inherit",
  });
} finally {
  for (const { target, backup, existed } of linked.reverse()) {
    await rm(target, { recursive: true, force: true });
    if (existed) {
      await rename(backup, target);
    }
  }
}
