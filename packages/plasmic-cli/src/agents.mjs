import { access, readdir, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

// Global discovery locations are documented in ai/plasmic/README.md.
export function agentRegistry(home, env) {
  const user = (relative) => path.join(home, relative);
  const config = env.XDG_CONFIG_HOME?.trim() || user(".config");
  const shared = user(".agents/skills");
  const claude = env.CLAUDE_CONFIG_DIR?.trim() || user(".claude");
  const codex = env.CODEX_HOME?.trim() || user(".codex");
  const dsh = env.DSH_HOME?.trim() || user(".dsh");
  const dshAgents = env.DSH_AGENTS_HOME?.trim() || user(".agents");
  return [
    { id: "codex", name: "Codex", roots: [codex], skills: shared, commands: ["codex"], apps: ["Codex"] },
    { id: "claude-code", name: "Claude Code (CLI / Desktop Code)", roots: [claude], skills: path.join(claude, "skills"), commands: ["claude"], apps: ["Claude"] },
    { id: "deepseek-harness", name: "DeepSeek Harness", roots: [dsh], skills: path.join(dshAgents, "skills"), commands: ["dsh"] },
    { id: "cursor", name: "Cursor", roots: [user(".cursor")], skills: shared, commands: ["cursor", "cursor-agent"], apps: ["Cursor"] },
    { id: "gemini-cli", name: "Gemini CLI", roots: [user(".gemini/settings.json"), user(".gemini/skills")], skills: shared, commands: ["gemini"] },
    { id: "opencode", name: "OpenCode", roots: [path.join(config, "opencode")], skills: shared, commands: ["opencode"], apps: ["OpenCode"] },
    { id: "github-copilot", name: "GitHub Copilot", roots: [user(".copilot")], skills: shared, commands: ["copilot"], apps: ["GitHub Copilot"], extensions: ["github.copilot-", "github.copilot-chat-"] },
    { id: "antigravity", name: "Antigravity", roots: [user(".gemini/config"), user(".gemini/antigravity")], skills: user(".gemini/config/skills"), apps: ["Antigravity", "Antigravity IDE"] },
    { id: "antigravity-cli", name: "Antigravity CLI", roots: [user(".gemini/antigravity-cli")], skills: user(".gemini/antigravity-cli/skills"), commands: ["agy"] },
    { id: "windsurf", name: "Windsurf", roots: [user(".codeium/windsurf")], skills: user(".codeium/windsurf/skills"), commands: ["windsurf"], apps: ["Windsurf"] },
    { id: "cline", name: "Cline", roots: [user(".cline")], skills: shared, commands: ["cline"], extensions: ["saoudrizwan.claude-dev-"] },
    { id: "roo", name: "Roo Code", roots: [user(".roo")], skills: user(".roo/skills"), extensions: ["rooveterinaryinc.roo-cline-"] },
    { id: "continue", name: "Continue", roots: [user(".continue")], skills: user(".continue/skills"), commands: ["cn"], extensions: ["continue.continue-"] },
    { id: "kilo", name: "Kilo Code", roots: [user(".kilo")], skills: user(".kilo/skills"), commands: ["kilo"], extensions: ["kilocode.kilo-code-"] },
    { id: "kiro", name: "Kiro", roots: [user(".kiro")], skills: user(".kiro/skills"), commands: ["kiro-cli", "kiro"], apps: ["Kiro"] },
    { id: "trae", name: "Trae", roots: [user(".trae")], skills: user(".trae/skills"), apps: ["Trae"] },
    { id: "trae-cn", name: "Trae CN", roots: [user(".trae-cn")], skills: user(".trae-cn/skills"), apps: ["Trae CN"] },
    { id: "qwen-code", name: "Qwen Code", roots: [user(".qwen")], skills: user(".qwen/skills"), commands: ["qwen"] },
    { id: "amp", name: "Amp", roots: [path.join(config, "amp")], skills: path.join(config, "agents/skills"), commands: ["amp"] },
    { id: "goose", name: "Goose", roots: [path.join(config, "goose")], skills: path.join(config, "goose/skills"), commands: ["goose"], apps: ["Goose"] },
    { id: "droid", name: "Droid", roots: [user(".factory")], skills: shared, commands: ["droid"] },
    { id: "pi", name: "Pi", roots: [user(".pi/agent")], skills: shared, commands: ["pi"] },
    { id: "openclaw", name: "OpenClaw", roots: [user(".openclaw")], skills: user(".openclaw/skills"), commands: ["openclaw"] },
    { id: "zcode", name: "ZCode", roots: [user(".zcode")], skills: user(".zcode/skills"), apps: ["ZCode"] },
    { id: "zed", name: "Zed", roots: [path.join(config, "zed"), ...(env.APPDATA ? [path.join(env.APPDATA, "Zed")] : [])], skills: shared, commands: ["zed"], apps: ["Zed"] },
  ];
}

async function exists(filename) {
  try { await stat(filename); return true; }
  catch (error) { if (["ENOENT", "ENOTDIR"].includes(error.code)) return false; throw error; }
}

async function commandPath(command, env, platform) {
  const extensions = platform === "win32" ? ["", ...(env.PATHEXT || ".COM;.EXE;.BAT;.CMD").split(";")] : [""];
  for (const directory of (env.PATH || env.Path || "").split(platform === "win32" ? ";" : ":").filter(Boolean)) {
    for (const extension of extensions) {
      const filename = path.join(directory.replace(/^"|"$/g, ""), command + extension);
      try {
        if (!(await stat(filename)).isFile()) continue;
        await access(filename, platform === "win32" ? constants.F_OK : constants.X_OK);
        return filename;
      } catch (error) {
        if (!["ENOENT", "ENOTDIR", "EACCES"].includes(error.code)) throw error;
      }
    }
  }
}

function applicationPaths(name, home, env, platform) {
  if (platform === "darwin") return ["/Applications", path.join(home, "Applications")].map((root) => path.join(root, name + ".app"));
  if (platform === "win32") return [env.APPDATA, env.ProgramData].filter(Boolean).map((root) => path.join(root, "Microsoft/Windows/Start Menu/Programs", name + ".lnk"));
  const basename = name.toLowerCase().replaceAll(" ", "-") + ".desktop";
  return [env.XDG_DATA_HOME || path.join(home, ".local/share"), ...(env.XDG_DATA_DIRS || "/usr/local/share:/usr/share").split(":")].map((root) => path.join(root, "applications", basename));
}

export async function detectInstalledAgents({ home = homedir(), env = process.env, platform = process.platform } = {}) {
  const extensionRoots = [".vscode", ".vscode-insiders", ".cursor", ".windsurf"].map((root) => path.join(home, root, "extensions"));
  const extensions = [];
  for (const root of extensionRoots) {
    try { extensions.push(...(await readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory() || entry.isSymbolicLink()).map((entry) => path.join(root, entry.name))); }
    catch (error) { if (!["ENOENT", "ENOTDIR"].includes(error.code)) throw error; }
  }
  const installed = [];
  for (const agent of agentRegistry(home, env)) {
    const evidence = [];
    for (const root of agent.roots) if (await exists(root)) evidence.push({ kind: "config", path: root });
    for (const command of agent.commands || []) {
      const filename = await commandPath(command, env, platform);
      if (filename) evidence.push({ kind: "cli", path: filename });
    }
    for (const name of agent.apps || []) {
      for (const filename of applicationPaths(name, home, env, platform)) if (await exists(filename)) evidence.push({ kind: "app", path: filename });
    }
    for (const filename of extensions) {
      if (agent.extensions?.some((prefix) => path.basename(filename).toLowerCase().startsWith(prefix))) evidence.push({ kind: "extension", path: filename });
    }
    if (evidence.length) installed.push({ id: agent.id, name: agent.name, skillsRoot: path.resolve(agent.skills), evidence });
  }
  return installed;
}
