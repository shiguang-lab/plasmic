const { readFile, access } = require("node:fs/promises");
const { homedir } = require("node:os");
const path = require("node:path");

async function readSkillBootstrap(agentsHome = process.env.DSH_AGENTS_HOME || path.join(homedir(), ".agents")) {
  const skillPath = path.resolve(agentsHome, "skills/plasmic/SKILL.md");
  const configPath = path.join(path.dirname(skillPath), "local-source.json");
  let source;
  try { source = await readFile(configPath, "utf8"); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  if (source !== undefined) {
    const config = JSON.parse(source);
    if (config.source !== "local" || typeof config.resolver !== "string" || !path.isAbsolute(config.resolver)) {
      throw new Error("Invalid local Plasmic source: an absolute resolver is required in local-source.json");
    }
    await Promise.all([access(skillPath), access(config.resolver)]);
    return {
      source: "local", skillPath, resolver: config.resolver,
      instructions: "Read the current local skill at skillPath. Run the configured resolver with Node and --mode inspect for read-only inspection, --mode prototype for design edits, or --mode codegen for native development. Read returned mustRead paths starting with referencePath. Use its local resourceRoot and resourceHash. A configured local source must not fall back to published or cached NAS resources if resolution fails.",
    };
  }
  return {
    source: "published",
    instructions: "Run npx -y @plasmickit/cli@latest context resolve --mode inspect for read-only inspection, --mode prototype for design edits, or --mode codegen for native development. Read returned mustRead paths starting with referencePath. Stop dependent work if resolution fails; do not silently use stale references.",
    resourceManifestUrl: require("../desktop.config.json").updateUrl + "/plasmic/latest.json",
  };
}

module.exports = { readSkillBootstrap };
