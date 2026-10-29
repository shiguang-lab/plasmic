import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, chmod, cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { detectInstalledAgents } from "../src/agents.mjs";
import { installSkill } from "../src/skill.mjs";
import { CLI_VERSION } from "../src/protocol.mjs";

const run = promisify(execFile);
const sourceSkill = await readFile(new URL("../skill/plasmic/SKILL.md", import.meta.url), "utf8");
const bundled = `${sourceSkill.trimEnd()}\n\n<!-- plasmickit-cli-version: ${CLI_VERSION} -->\n`;
async function setup(t) {
  const home = await mkdtemp(path.join(tmpdir(), "plasmic-skills-"));
  t.after(() => rm(home, { recursive: true, force: true }));
  return { home, platform: "linux", env: { PATH: path.join(home, "bin"), XDG_DATA_DIRS: path.join(home, "system-share") } };
}
async function file(filename, content = "", executable = false) {
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, content);
  if (executable) await chmod(filename, 0o755);
}

test("installs for every detected CLI and config, sharing universal destinations and preserving user files", async (t) => {
  const options = await setup(t);
  for (const name of ["codex", "claude", "cursor-agent"]) await file(path.join(options.env.PATH, name), "", true);
  await mkdir(path.join(options.home, ".codeium/windsurf"), { recursive: true });
  await mkdir(path.join(options.home, ".gemini/skills"), { recursive: true });
  const unrelated = path.join(options.home, ".claude/skills/custom/SKILL.md");
  await file(unrelated, "user skill");
  const result = await installSkill(options);
  assert.equal(result.ok, true);
  assert.deepEqual(result.detected.map((agent) => agent.id), ["codex", "claude-code", "cursor", "gemini-cli", "windsurf"]);
  assert.equal(result.installations.length, 3);
  assert.deepEqual(result.installations.find((entry) => entry.agents.includes("codex")).agents, ["codex", "cursor", "gemini-cli"]);
  for (const entry of result.installations) {
    assert.equal(entry.status, "installed");
    assert.equal(await readFile(entry.skillPath, "utf8"), bundled);
    assert.deepEqual(await readdir(entry.target), ["SKILL.md"]);
  }
  assert.equal(await readFile(unrelated, "utf8"), "user skill");
  await assert.rejects(access(path.join(options.home, ".qwen")), { code: "ENOENT" });
  const before = await stat(result.installations[0].skillPath);
  assert.ok((await installSkill(options)).installations.every((entry) => entry.status === "unchanged"));
  assert.equal((await stat(result.installations[0].skillPath)).mtimeMs, before.mtimeMs);
});

test("dry run detects clients without creating skill directories", async (t) => {
  const options = await setup(t);
  await mkdir(path.join(options.home, ".qwen"));
  const result = await installSkill({ ...options, dryRun: true });
  assert.equal(result.ok, true);
  assert.deepEqual(result.installations.map((entry) => entry.status), ["planned"]);
  await assert.rejects(access(result.installations[0].target), { code: "ENOENT" });
});

test("missing clients fail without writing, and Unix detection ignores nonexecutables and command-named directories", async (t) => {
  const options = await setup(t);
  await file(path.join(options.env.PATH, "codex"));
  await mkdir(path.join(options.env.PATH, "claude"));
  const result = await installSkill(options);
  assert.equal(result.ok, false);
  assert.match(result.error, /No supported/);
  assert.deepEqual(result.detected, []);
  assert.deepEqual(result.installations, []);
  await assert.rejects(access(path.join(options.home, ".agents")), { code: "ENOENT" });
});

test("installs for agy, Codex, Claude Code and DeepSeek Harness with only CLI executables present", async (t) => {
  const options = await setup(t);
  for (const name of ["agy", "codex", "claude", "dsh"]) await file(path.join(options.env.PATH, name), "", true);
  const result = await installSkill(options);
  assert.equal(result.ok, true);
  assert.deepEqual(result.detected.map((agent) => agent.id), ["codex", "claude-code", "deepseek-harness", "antigravity-cli"]);
  assert.ok(result.detected.every((agent) => agent.evidence.length === 1 && agent.evidence[0].kind === "cli"));
  assert.deepEqual(result.installations.map((entry) => path.relative(options.home, entry.target)), [
    ".agents/skills/plasmic", ".claude/skills/plasmic", ".gemini/antigravity-cli/skills/plasmic",
  ]);
  assert.deepEqual(result.installations[0].agents, ["codex", "deepseek-harness"]);
  for (const entry of result.installations) assert.equal(await readFile(entry.skillPath, "utf8"), bundled);
});

test("DeepSeek Harness config detection respects DSH overrides and ignores a shared agents directory alone", async (t) => {
  const options = await setup(t);
  options.env.DSH_HOME = path.join(options.home, "custom-dsh");
  options.env.DSH_AGENTS_HOME = path.join(options.home, "custom-agents");
  await mkdir(path.join(options.env.DSH_AGENTS_HOME, "skills"), { recursive: true });
  assert.deepEqual(await detectInstalledAgents(options), []);
  await mkdir(options.env.DSH_HOME);
  const result = await installSkill(options);
  assert.equal(result.ok, true);
  assert.deepEqual(result.detected.map((agent) => agent.id), ["deepseek-harness"]);
  assert.deepEqual(result.detected[0].evidence, [{ kind: "config", path: options.env.DSH_HOME }]);
  assert.equal(result.installations[0].target, path.join(options.env.DSH_AGENTS_HOME, "skills/plasmic"));
  assert.equal(await readFile(result.installations[0].skillPath, "utf8"), bundled);
});

test("detects macOS user applications even before client configuration exists", async (t) => {
  const options = await setup(t);
  const application = path.join(options.home, "Applications/Cursor.app");
  await mkdir(application, { recursive: true });
  const agents = await detectInstalledAgents({ ...options, platform: "darwin" });
  const cursor = agents.find((agent) => agent.id === "cursor");
  assert.ok(cursor.evidence.some((entry) => entry.kind === "app" && entry.path === application));
  assert.equal(cursor.skillsRoot, path.join(options.home, ".agents/skills"));
});

test("recognizes IDE extensions without treating a plain editor as every installed agent", async (t) => {
  const options = await setup(t);
  for (const name of ["github.copilot-chat-1.0", "saoudrizwan.claude-dev-1.0", "rooveterinaryinc.roo-cline-1.0", "unrelated.extension-1.0"]) {
    await mkdir(path.join(options.home, ".vscode/extensions", name), { recursive: true });
  }
  const result = await installSkill(options);
  assert.deepEqual(result.detected.map((agent) => agent.id), ["github-copilot", "cline", "roo"]);
  assert.equal(result.installations.length, 2);
  assert.deepEqual(result.installations[0].agents, ["github-copilot", "cline"]);
});

test("honors client config overrides and XDG locations while Codex uses the standard user skills root", async (t) => {
  const options = await setup(t);
  options.env.CLAUDE_CONFIG_DIR = path.join(options.home, "custom-claude");
  options.env.CODEX_HOME = path.join(options.home, "custom-codex");
  options.env.XDG_CONFIG_HOME = path.join(options.home, "custom-config");
  await mkdir(options.env.CLAUDE_CONFIG_DIR);
  await mkdir(options.env.CODEX_HOME);
  await mkdir(path.join(options.env.XDG_CONFIG_HOME, "goose"), { recursive: true });
  const result = await installSkill(options);
  assert.equal(result.ok, true);
  assert.equal(result.detected.find((agent) => agent.id === "codex").skillsRoot, path.join(options.home, ".agents/skills"));
  assert.equal(result.detected.find((agent) => agent.id === "claude-code").skillsRoot, path.join(options.env.CLAUDE_CONFIG_DIR, "skills"));
  assert.equal(result.detected.find((agent) => agent.id === "goose").skillsRoot, path.join(options.env.XDG_CONFIG_HOME, "goose/skills"));
});

test("Windows detection handles PATH, PATHEXT and application shortcuts", async (t) => {
  const options = await setup(t);
  options.platform = "win32";
  options.env.PATHEXT = ".EXE;.CMD";
  options.env.APPDATA = path.join(options.home, "roaming");
  const bin = options.env.PATH;
  options.env.PATH = `"${bin}";${path.join(options.home, "absent")}`;
  await file(path.join(bin, "codex.EXE"));
  await file(path.join(bin, "copilot.CMD"));
  await file(path.join(options.env.APPDATA, "Microsoft/Windows/Start Menu/Programs/Kiro.lnk"));
  const agents = await detectInstalledAgents(options);
  assert.deepEqual(agents.map((agent) => agent.id), ["codex", "github-copilot", "kiro"]);
  assert.equal(agents[0].evidence[0].kind, "cli");
  assert.equal(agents[2].evidence[0].kind, "app");
});

test("Linux detection reads desktop launchers from XDG data locations", async (t) => {
  const options = await setup(t);
  options.env.XDG_DATA_HOME = path.join(options.home, "custom-data");
  await file(path.join(options.env.XDG_DATA_HOME, "applications/cursor.desktop"));
  assert.deepEqual((await detectInstalledAgents(options)).map((agent) => agent.id), ["cursor"]);
});

test("a failed destination does not prevent other installs and can be retried", async (t) => {
  const options = await setup(t);
  await mkdir(path.join(options.home, ".codex"));
  const blocked = path.join(options.home, ".claude/skills");
  await file(blocked, "keep me");
  const result = await installSkill(options);
  assert.equal(result.ok, false);
  assert.equal(result.installations.find((entry) => entry.agents.includes("claude-code")).status, "failed");
  const successful = result.installations.find((entry) => entry.agents.includes("codex"));
  assert.equal(successful.status, "installed");
  assert.equal(await readFile(successful.skillPath, "utf8"), bundled);
  assert.equal(await readFile(blocked, "utf8"), "keep me");
  await rm(blocked);
  const retried = await installSkill(options);
  assert.equal(retried.ok, true);
  assert.equal(retried.installations.find((entry) => entry.agents.includes("codex")).status, "unchanged");
});

test("existing symlinked skill destinations are deduplicated and updates keep extra files", async (t) => {
  if (process.platform === "win32") { t.skip("Requires local symlink privileges"); return; }
  const options = await setup(t);
  await mkdir(path.join(options.home, ".codex"));
  const shared = path.join(options.home, ".agents/skills");
  await file(path.join(shared, "plasmic/SKILL.md"), "previous version");
  await file(path.join(shared, "plasmic/notes.txt"), "user notes");
  await mkdir(path.join(options.home, ".claude"));
  await symlink(shared, path.join(options.home, ".claude/skills"), "dir");
  const result = await installSkill(options);
  assert.equal(result.installations.length, 1);
  assert.deepEqual(result.installations[0].agents, ["codex", "claude-code"]);
  assert.equal(await readFile(result.installations[0].skillPath, "utf8"), bundled);
  assert.equal(await readFile(path.join(shared, "plasmic/notes.txt"), "utf8"), "user notes");
});

test("shared symlinked roots are deduplicated before the first install", async (t) => {
  if (process.platform === "win32") { t.skip("Requires local symlink privileges"); return; }
  const options = await setup(t);
  await mkdir(path.join(options.home, ".codex"));
  const shared = path.join(options.home, ".agents/skills");
  await mkdir(shared, { recursive: true });
  await mkdir(path.join(options.home, ".claude"));
  await symlink(shared, path.join(options.home, ".claude/skills"), "dir");
  const result = await installSkill(options);
  assert.equal(result.installations.length, 1);
  assert.deepEqual(result.installations[0].agents, ["codex", "claude-code"]);
  assert.equal(await readFile(result.installations[0].skillPath, "utf8"), bundled);
});

test("CLI needs no target argument and returns nonzero with detailed partial failure", async (t) => {
  const options = await setup(t);
  await mkdir(path.join(options.home, ".codex"));
  await file(path.join(options.home, ".claude/skills"), "blocked");
  const env = { ...process.env, HOME: options.home, USERPROFILE: options.home, CODEX_HOME: path.join(options.home, ".codex"), CLAUDE_CONFIG_DIR: path.join(options.home, ".claude"), XDG_CONFIG_HOME: path.join(options.home, ".config"), XDG_DATA_HOME: path.join(options.home, ".local/share"), XDG_DATA_DIRS: options.env.XDG_DATA_DIRS, APPDATA: path.join(options.home, "roaming"), ProgramData: path.join(options.home, "system"), PATH: options.env.PATH };
  const cli = new URL("../src/index.mjs", import.meta.url);
  const preview = JSON.parse((await run(process.execPath, [cli.pathname, "skill", "install", "--dry-run"], { env })).stdout);
  assert.ok(preview.installations.every((entry) => entry.status === "planned"));
  await assert.rejects(run(process.execPath, [cli.pathname, "skill", "install"], { env }), (error) => {
    const result = JSON.parse(error.stdout);
    assert.equal(error.code, 1);
    assert.equal(result.ok, false);
    assert.ok(result.installations.some((entry) => entry.status === "installed"));
    assert.ok(result.installations.some((entry) => entry.status === "failed" && entry.agents.includes("claude-code")));
    return true;
  });
  await assert.rejects(run(process.execPath, [cli.pathname, "skill", "install", "--target", options.home], { env }), (error) => error.code === 1 && /Unknown option/.test(error.stderr));
});

test("automatic synchronization adopts existing unversioned installs without installing other clients", async (t) => {
  const options = await setup(t);
  await mkdir(path.join(options.home, ".codex"));
  await mkdir(path.join(options.home, ".claude"));
  const target = path.join(options.home, ".agents/skills/plasmic");
  await file(path.join(target, "SKILL.md"), sourceSkill);
  await file(path.join(target, "notes.txt"), "keep");
  const result = await installSkill({ ...options, existingOnly: true });
  assert.equal(result.ok, true);
  assert.equal(result.mode, "sync");
  assert.equal(result.installations.find((item) => item.agents.includes("codex")).status, "updated");
  assert.equal(result.installations.find((item) => item.agents.includes("claude-code")).reason, "not-installed");
  await assert.rejects(access(path.join(options.home, ".claude/skills")), { code: "ENOENT" });
  assert.equal(await readFile(path.join(target, "SKILL.md"), "utf8"), bundled);
  assert.equal(await readFile(path.join(target, "notes.txt"), "utf8"), "keep");
  const before = await stat(path.join(target, "SKILL.md"));
  await installSkill({ ...options, existingOnly: true });
  assert.equal((await stat(path.join(target, "SKILL.md"))).mtimeMs, before.mtimeMs);
  assert.deepEqual((await readdir(target)).sort(), ["SKILL.md", "notes.txt"]);
});

test("automatic synchronization is a no-op without installed clients", async (t) => {
  const options = await setup(t);
  const result = await installSkill({ ...options, existingOnly: true });
  assert.equal(result.ok, true);
  assert.deepEqual(result.installations, []);
  assert.deepEqual(await readdir(options.home), []);
});

test("synchronization preserves local sources and symlinked skill entries", { skip: process.platform === "win32" }, async (t) => {
  const options = await setup(t);
  await mkdir(path.join(options.home, ".codex"));
  await mkdir(path.join(options.home, ".qwen"));
  const local = path.join(options.home, ".agents/skills/plasmic");
  await file(path.join(local, "SKILL.md"), "local skill");
  await file(path.join(local, "local-source.json"), '{"source":"local"}');
  const source = path.join(options.home, "source/SKILL.md");
  await file(source, "source skill");
  const linked = path.join(options.home, ".claude/skills/plasmic");
  await mkdir(linked, { recursive: true });
  await symlink(source, path.join(linked, "SKILL.md"));
  const linkedDirectory = path.join(options.home, ".qwen/skills/plasmic");
  await mkdir(path.dirname(linkedDirectory), { recursive: true });
  await symlink(path.dirname(source), linkedDirectory, "dir");
  const result = await installSkill({ ...options, existingOnly: true });
  assert.equal(result.ok, true);
  assert.deepEqual(result.installations.map((item) => item.reason), ["local-source", "symlink", "symlink"]);
  assert.equal(await readFile(path.join(local, "SKILL.md"), "utf8"), "local skill");
  assert.equal(await readFile(source, "utf8"), "source skill");
  assert.equal((await lstat(path.join(linked, "SKILL.md"))).isSymbolicLink(), true);
  assert.deepEqual(await readdir(path.dirname(source)), ["SKILL.md"]);
});

test("a newer installed version is never replaced by an older CLI", async (t) => {
  const options = await setup(t);
  await mkdir(path.join(options.home, ".codex"));
  const filename = path.join(options.home, ".agents/skills/plasmic/SKILL.md");
  const newer = "New instructions\n\n<!-- plasmickit-cli-version: 999.0.0 -->\n";
  await file(filename, newer);
  for (const existingOnly of [true, false]) {
    const result = await installSkill({ ...options, existingOnly });
    assert.equal(result.installations[0].reason, "newer-installed");
    assert.equal(await readFile(filename, "utf8"), newer);
  }
});

test("concurrent CLI versions serialize writes and keep the newest entry", async (t) => {
  const options = await setup(t);
  await mkdir(path.join(options.home, ".codex"));
  const filename = path.join(options.home, ".agents/skills/plasmic/SKILL.md");
  await file(filename, "old unversioned skill");
  const copy = path.join(options.home, "new-cli");
  await mkdir(copy);
  for (const name of ["src", "skill"]) await cp(new URL(`../${name}`, import.meta.url), path.join(copy, name), { recursive: true });
  await file(path.join(copy, "package.json"), JSON.stringify({ version: "999.0.0", type: "module" }));
  await file(path.join(copy, "skill/plasmic/SKILL.md"), "New instructions\n");
  const runInstall = (module) => run(process.execPath, ["--input-type=module", "-e",
    `const {installSkill} = await import(${JSON.stringify(module)}); console.log(JSON.stringify(await installSkill(${JSON.stringify({ ...options, existingOnly: true })})));`,
  ]);
  const oldModule = new URL("../src/skill.mjs", import.meta.url).href;
  const newModule = pathToFileURL(path.join(copy, "src/skill.mjs")).href;
  const results = await Promise.all([runInstall(oldModule), runInstall(newModule), runInstall(oldModule), runInstall(newModule)]);
  assert.ok(results.every(({ stdout }) => JSON.parse(stdout).ok));
  assert.equal(await readFile(filename, "utf8"), "New instructions\n\n<!-- plasmickit-cli-version: 999.0.0 -->\n");
  assert.deepEqual(await readdir(path.dirname(filename)), ["SKILL.md"]);
});

test("an occupied update lock fails within a bound and can be retried without losing the entry", async (t) => {
  const options = await setup(t);
  await mkdir(path.join(options.home, ".codex"));
  const target = path.join(options.home, ".agents/skills/plasmic");
  await file(path.join(target, "SKILL.md"), "keep until unlocked");
  const lock = path.join(target, ".plasmickit-skill-lock");
  await mkdir(lock);
  const result = await installSkill({ ...options, existingOnly: true });
  assert.equal(result.ok, false);
  assert.match(result.installations[0].error, /Skill update still locked/);
  assert.equal(await readFile(path.join(target, "SKILL.md"), "utf8"), "keep until unlocked");
  await access(lock);
  await rm(lock, { recursive: true });
  assert.equal((await installSkill({ ...options, existingOnly: true })).ok, true);
  assert.equal(await readFile(path.join(target, "SKILL.md"), "utf8"), bundled);
});
