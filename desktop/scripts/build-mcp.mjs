import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
export async function generateMcpManifest() {
  const { tools, EDITOR_METHODS } = require("../src/mcp-contract.cjs");
  const { getStyle } = require("../src/design-styles.cjs");
  const bootstrap = require("../src/mcp-bootstrap.cjs");
  const styles = getStyle();
  const data = {
    version: require("../package.json").version,
    instructions: require("../src/mcp-instructions.cjs"),
    tools, editorMethods: EDITOR_METHODS,
    styles: { list: styles, values: Object.fromEntries(styles.styles.map(style => [style.id, getStyle(style.id)])) },
    publishedSkill: { source: "published", instructions: bootstrap.publishedInstructions,
      resourceManifestUrl: require("../desktop.config.json").updateUrl + "/plasmic/latest.json" },
    localSkillInstructions: bootstrap.localInstructions,
    protocolVersions: require("@modelcontextprotocol/sdk/types.js").SUPPORTED_PROTOCOL_VERSIONS,
  };
  await writeFile(path.join(root, "mcp/generated.json"), JSON.stringify(data));
}

export function mcpBuildDirectory(platform, arch) {
  return path.join(root, "mcp-bin", `${platform}-${arch}`);
}

export async function buildMcp(platform = process.platform, arch = process.arch) {
  const goos = { darwin: "darwin", win32: "windows", linux: "linux" }[platform];
  const goarch = { arm64: "arm64", x64: "amd64" }[arch];
  if (!goos || !goarch) throw new Error("Unsupported MCP target: " + platform + "-" + arch);
  await generateMcpManifest();
  const directory = mcpBuildDirectory(platform, arch);
  await mkdir(directory, { recursive: true });
  const executable = path.join(directory, platform === "win32" ? "plasmic-mcp.exe" : "plasmic-mcp");
  execFileSync("go", ["build", "-trimpath", "-buildvcs=false", "-ldflags=-s -w", "-o", executable, "."], {
    cwd: path.join(root, "mcp"), env: { ...process.env, CGO_ENABLED: "0", GOOS: goos, GOARCH: goarch }, stdio: "inherit",
  });
  if (platform === "darwin" && process.platform === "darwin") {
    execFileSync("/usr/bin/codesign", ["--force", "--sign", "-", executable]);
  }
  const modules = JSON.parse("[" + execFileSync("go", ["list", "-m", "-json", "all"], {
    cwd: path.join(root, "mcp"), encoding: "utf8",
  }).trim().replace(/}\s*{/g, "},{") + "]");
  const goroot = execFileSync("go", ["env", "GOROOT"], { encoding: "utf8" }).trim();
  const licenses = ["Go runtime\n" + await readFile(path.join(goroot, "LICENSE"), "utf8")];
  for (const module of modules.filter(module => !module.Main && module.Dir)) {
    const license = await readFile(path.join(module.Dir, "LICENSE"), "utf8").catch(error => {
      if (error.code !== "ENOENT") throw error;
    });
    if (license) licenses.push(`${module.Path} ${module.Version}\n${license}`);
  }
  await writeFile(path.join(directory, "LICENSES.mcp.txt"), licenses.join("\n\n"));
  for (const name of ["bundle.cjs", "sea.blob", "sea.json", "LICENSE.node"]) await rm(path.join(directory, name), { force: true });
  if (platform === process.platform && arch === process.arch) {
    const actual = JSON.parse(execFileSync(executable, ["--version"], { encoding: "utf8" }));
    if (!actual.go || actual.version !== require("../package.json").version || actual.platform !== platform || actual.arch !== arch) {
      throw new Error("MCP runtime verification failed");
    }
  }
  return directory;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(await buildMcp(...process.argv.slice(2)));
}
