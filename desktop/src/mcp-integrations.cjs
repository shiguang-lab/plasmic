const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { isDeepStrictEqual } = require("node:util");
const jsonc = require("jsonc-parser");
const toml = require("smol-toml");
const NAME = "plasmic-desktop";
const BEGIN = "# BEGIN Plasmic Desktop MCP";
const END = "# END Plasmic Desktop MCP";
const CLIENTS = [
  ["claude", "Claude Code CLI", ".claude.json"],
  ["codex", "Codex CLI", ".codex/config.toml"],
  ["gemini", "Gemini CLI", ".gemini/settings.json"],
  ["antigravity", "Antigravity 2.0", ".gemini/config/mcp_config.json"],
  ["opencode", "OpenCode CLI", ".config/opencode/opencode.json"],
  ["kiro", "Kiro CLI", ".kiro/settings/mcp.json"],
  [
    "claude-desktop",
    "Claude Desktop",
    "Library/Application Support/Claude/claude_desktop_config.json",
  ],
];
function object(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}
function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = file + ".plasmic-tmp";
  const mode = fs.existsSync(file) ? fs.statSync(file).mode & 0o777 : 0o600;
  try {
    fs.writeFileSync(temporary, text, { mode });
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) {
      fs.unlinkSync(temporary);
    }
  }
}
class McpIntegrations {
  constructor({
    userData,
    command,
    args,
    home = os.homedir(),
    env = process.env,
    platform = process.platform,
  }) {
    this.launch = { command, args };
    this.errors = {};
    this.file = path.join(userData, "mcp-integrations.json");
    this.preferences = fs.existsSync(this.file)
      ? JSON.parse(fs.readFileSync(this.file, "utf8"))
      : {};
    this.clients = CLIENTS.map(([id, label, relative]) => {
      let file = path.join(home, relative);
      if (id === "codex" && env.CODEX_HOME) {
        file = path.join(env.CODEX_HOME, "config.toml");
      }
      if (id === "opencode") {
        file = path.join(
          env.XDG_CONFIG_HOME || path.join(home, ".config"),
          "opencode/opencode.json",
        );
        if (fs.existsSync(file + "c")) {
          file += "c";
        }
      }
      if (id === "claude-desktop" && platform === "win32") {
        file = path.join(
          env.APPDATA || path.join(home, "AppData/Roaming"),
          "Claude/claude_desktop_config.json",
        );
      }
      return {
        id,
        label,
        file,
        unsupported: id === "claude-desktop" && platform === "linux",
      };
    });
  }
  entry(id) {
    if (id === "opencode") {
      return {
        type: "local",
        command: [this.launch.command, ...this.launch.args],
        enabled: true,
      };
    }
    if (id === "claude") {
      return { type: "stdio", ...this.launch };
    }
    return this.launch;
  }
  customConfig() {
    return JSON.stringify({ mcpServers: { [NAME]: this.launch } }, null, 2);
  }
  read(client) {
    const text = fs.existsSync(client.file)
      ? fs.readFileSync(client.file, "utf8")
      : "";
    let data;
    try {
      if (client.id === "codex") {
        data = toml.parse(text);
      } else {
        const errors = [];
        data = jsonc.parse(text.trim() ? text : "{}", errors, {
          allowTrailingComma: true,
        });
        if (errors.length) {
          throw new Error();
        }
      }
      const key =
        client.id === "codex"
          ? "mcp_servers"
          : client.id === "opencode"
            ? "mcp"
            : "mcpServers";
      if (!object(data) || (data[key] !== undefined && !object(data[key]))) {
        throw new Error();
      }
      return { text, data, key, existing: data[key]?.[NAME] };
    } catch {
      throw new Error("Invalid configuration file format. Fix the file first.");
    }
  }
  owned(id, existing) {
    return (
      isDeepStrictEqual(existing, this.entry(id), true) ||
      (this.preferences[id]?.entry &&
        isDeepStrictEqual(existing, this.preferences[id].entry, true))
    );
  }
  status() {
    return this.clients.map((client) => {
      let enabled = false,
        error = "";
      try {
        if (client.unsupported) {
          throw new Error("Claude Desktop is not supported on Linux.");
        }
        const { existing } = this.read(client);
        enabled = existing !== undefined && !!this.owned(client.id, existing);
        if (existing !== undefined && !enabled) {
          throw new Error(
            "A different configuration with the same name already exists. It was not overwritten.",
          );
        }
      } catch (e) {
        error = e.message;
      }
      return {
        id: client.id,
        label: client.label,
        path: client.file,
        enabled,
        selected: !!this.preferences[client.id]?.enabled,
        error: error || this.errors[client.id] || "",
      };
    });
  }
  set(id, enabled) {
    const client = this.clients.find((item) => item.id === id);
    if (!client || typeof enabled !== "boolean") {
      throw new Error("Invalid client settings.");
    }
    if (client.unsupported) {
      throw new Error("Claude Desktop is not supported on Linux.");
    }
    const { text, data, key, existing } = this.read(client);
    if (existing !== undefined && !this.owned(id, existing)) {
      throw new Error(
        "A different configuration with the same name already exists. It was not overwritten.",
      );
    }
    let result;
    if (id === "codex") {
      // Only remove our delimited table. Keep all unrelated TOML text and comments.
      const start = text.indexOf(BEGIN),
        end = text.indexOf(END);
      let rest = text;
      if (start >= 0 || end >= 0) {
        if (
          start < 0 ||
          end < start ||
          text.indexOf(BEGIN, start + BEGIN.length) >= 0
        ) {
          throw new Error("Invalid Plasmic configuration block.");
        }
        rest =
          text.slice(0, start) +
          text.slice(end + END.length).replace(/^\r?\n/, "");
        const expected = structuredClone(data);
        if (expected[key]) {
          delete expected[key][NAME];
          if (!Object.keys(expected[key]).length) {
            delete expected[key];
          }
        }
        const remaining = toml.parse(rest);
        if (remaining[key] && !Object.keys(remaining[key]).length) {
          delete remaining[key];
        }
        if (!isDeepStrictEqual(remaining, expected, true)) {
          throw new Error(
            "The Plasmic configuration block contains other settings. It was not modified.",
          );
        }
      } else if (existing !== undefined) {
        throw new Error(
          "This Codex entry is managed manually. Remove the existing entry before enabling it.",
        );
      }
      result = enabled
        ? rest +
          (rest.endsWith("\n") || !rest ? "" : "\n") +
          BEGIN +
          "\n" +
          toml
            .stringify({ mcp_servers: { [NAME]: this.entry(id) } })
            .replace(/^\[mcp_servers\]\n/, "") +
          "\n" +
          END +
          "\n"
        : rest;
      toml.parse(result);
    } else {
      result = jsonc.applyEdits(
        text.trim() ? text : "{}",
        jsonc.modify(
          text.trim() ? text : "{}",
          [key, NAME],
          enabled ? this.entry(id) : undefined,
          { formattingOptions: { insertSpaces: true, tabSize: 2 } },
        ),
      );
    }
    if (enabled || existing !== undefined) {
      write(client.file, result);
    }
    this.preferences[id] = { enabled, entry: this.entry(id) };
    write(this.file, JSON.stringify(this.preferences, null, 2));
    delete this.errors[id];
    return this.status();
  }
  restore() {
    for (const client of this.clients) {
      if (this.preferences[client.id]?.enabled) {
        try {
          this.set(client.id, true);
        } catch (error) {
          this.errors[client.id] = error.message;
        }
      }
    }
  }
}
module.exports = { McpIntegrations, NAME };
