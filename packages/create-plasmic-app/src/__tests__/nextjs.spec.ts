import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { create } from "../lib";
import { nextjsStrategy } from "../nextjs/nextjs";
import { reactStrategy } from "../react/react";
import { tanstackStrategy } from "../tanstack/tanstack";
import { spawnOrFail } from "../utils/cmd-utils";

const { readManagerVersion } = vi.hoisted(() => ({
  readManagerVersion: vi.fn<(command: string, options: { cwd: string }) => { stdout: string }>(),
}));
vi.mock("execa", () => ({ commandSync: readManagerVersion }));
vi.mock("../utils/cmd-utils", () => ({ spawnOrFail: vi.fn() }));

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("scaffold package manager", () => {
  it.each((["nextjs", "react", "tanstack"] as const).flatMap((platform) => [[platform, "explicit", "11.10.0"], [platform, "inherited", "12.1.0"]] as const))("%s uses the %s pnpm launch version before its first install", async (platform, selection, version) => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "cpa-manager-"));
    roots.push(root);
    const projectPath = path.join(root, "consumer");
    vi.stubEnv("npm_config_user_agent", selection === "inherited" ? `pnpm/${version} npm/? node/v24.0.0` : "npm/11.0.0 node/v24.0.0");
    const strategy = {nextjs: nextjsStrategy, react: reactStrategy, tanstack: tanstackStrategy}[platform];
    const scaffold = vi.spyOn(strategy, "create").mockImplementation(async ({ packageManager }) => {
      expect(packageManager).toBe("pnpm");
      await fs.mkdir(projectPath);
      await fs.writeFile(path.join(projectPath, "package.json"), JSON.stringify({ name: "consumer", packageManager: "pnpm@10.28.0" }));
    });
    readManagerVersion.mockImplementation(() => {
      expect(scaffold).not.toHaveBeenCalled();
      return { stdout: version };
    });
    vi.spyOn(strategy, "installDeps").mockResolvedValue(true);
    vi.spyOn(strategy, "overwriteConfig").mockResolvedValue(undefined);
    vi.spyOn(strategy, "generateFiles").mockResolvedValue(undefined);
    vi.mocked(spawnOrFail).mockImplementation(async (command, directory) => {
      expect(command).toBe("pnpm install");
      expect(directory).toBe(projectPath);
      const manifest = JSON.parse(await fs.readFile(path.join(projectPath, "package.json"), "utf8"));
      expect(manifest).toEqual({ name: "consumer", packageManager: `pnpm@${version}` });
    });
    await create({ resolvedProjectPath: projectPath, projectId: "fixture", projectApiToken: "fixture-token", platform, scheme: "codegen", jsOrTs: "js", platformOptions: { nextjs: { appDir: true } }, packageManager: selection === "explicit" ? "pnpm" : undefined });
    if (selection === "explicit") {
      expect(readManagerVersion).toHaveBeenCalledWith("pnpm --version", { cwd: root });
    } else {
      expect(readManagerVersion).not.toHaveBeenCalled();
    }
    expect(spawnOrFail).toHaveBeenCalledTimes(1);
  });

  it.each(["npm", "yarn"] as const)("keeps explicit %s installation settings", async (requested) => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "cpa-other-manager-"));
    roots.push(root);
    const projectPath = path.join(root, "consumer");
    vi.stubEnv("npm_config_user_agent", "pnpm/11.10.0 npm/? node/v24.0.0");
    readManagerVersion.mockReturnValue({stdout:"4.9.0"});
    const selected = requested === "yarn" ? "yarn2" : "npm";
    vi.spyOn(nextjsStrategy, "create").mockImplementation(async ({ packageManager }) => {
      expect(packageManager).toBe(selected);
      await fs.mkdir(projectPath);
      await fs.writeFile(path.join(projectPath, "package.json"), JSON.stringify({name:"consumer",packageManager:`${requested}@4.9.0`}));
    });
    vi.spyOn(nextjsStrategy, "installDeps").mockResolvedValue(true);
    vi.spyOn(nextjsStrategy, "overwriteConfig").mockResolvedValue(undefined);
    vi.spyOn(nextjsStrategy, "generateFiles").mockResolvedValue(undefined);
    await create({resolvedProjectPath:projectPath, projectId:"fixture", projectApiToken:"fixture-token", platform:"nextjs", scheme:"loader", jsOrTs:"js", platformOptions:{nextjs:{appDir:true}}, packageManager:requested});
    expect(spawnOrFail).not.toHaveBeenCalled();
    expect(JSON.parse(await fs.readFile(path.join(projectPath,"package.json"),"utf8")).packageManager).toBe(`${requested}@4.9.0`);
    expect(readManagerVersion.mock.calls.every(([command])=>command === "yarn --version")).toBe(true);
  });

  it("defers TanStack's pnpm installation to the common creation lifecycle", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "cpa-tanstack-manager-"));
    roots.push(root);
    const previousDirectory = process.cwd();
    vi.mocked(spawnOrFail).mockResolvedValue(undefined);
    try {
      await tanstackStrategy.create({projectPath:path.join(root,"consumer"), projectId:"fixture", jsOrTs:"ts", platformOptions:{}, packageManager:"pnpm"});
    } finally {
      process.chdir(previousDirectory);
    }
    expect(spawnOrFail).toHaveBeenCalledTimes(1);
    expect(vi.mocked(spawnOrFail).mock.calls[0][0]).toContain("--package-manager pnpm");
    expect(vi.mocked(spawnOrFail).mock.calls[0][0]).toContain("--no-install");
  });

  it("defers Next's pnpm installation to the common creation lifecycle", async () => {
    vi.mocked(spawnOrFail).mockResolvedValue(undefined);
    await nextjsStrategy.create({ projectPath: "/tmp/cpa-next-manager-contract", projectId: "fixture", jsOrTs: "ts", platformOptions: { nextjs: { appDir: true } }, packageManager: "pnpm" });
    expect(spawnOrFail).toHaveBeenCalledTimes(1);
    expect(vi.mocked(spawnOrFail).mock.calls[0][0]).toContain("--use-pnpm");
    expect(vi.mocked(spawnOrFail).mock.calls[0][0]).toContain("--skip-install");
  });
});
