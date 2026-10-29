# DeepSeek Harness Desktop setup

## DeepSeek Harness Desktop profile

Profile-based DSH Desktop uses `$DSH_HOME/profiles/desktop/cordis.patch.yml`, with `DSH_HOME` defaulting to `~/.dsh`. This is a YAML **patch list**, not a `mcpServers` mapping. Plasmic Desktop's MCP settings include a DeepSeek Harness switch that manages this entry. An Agent using a CLI profile must identify that profile instead; changing the Desktop profile does not configure headless/web profiles.

Append this insert patch only when the same instance/server namespace is absent, using the verified executable path:

```yaml
- insert:
    - id: plasmic-desktop
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        transport: stdio
        serverName: plasmic-desktop
        command: /Applications/Plasmic.app/Contents/MacOS/Plasmic
        args: ["--mcp"]
```

Preserve all other patches and literal `!!js` expressions without evaluating them. DSH hot-reloads profile patches; verify the session's tool inventory after reload. If tools are not refreshed, open a new session. TOML/JSON clients require their own documented structure. Installed skill files do not execute setup on their own: the Agent follows these steps when invoked and Desktop access is needed.

