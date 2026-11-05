import { build } from "esbuild";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export async function captureComponentContracts({ before = false, baselineRevision } = {}) {
  const folder = path.join(root, "plasmicpkgs/antd6");
  const require = createRequire(path.join(folder, "package.json"));
  const baseline = before ? baselineRevision ?? JSON.parse(await readFile(path.join(root, "docs/design/component-reuse-evidence/evidence-index.json"), "utf8")).repositoryHeadAtEvidenceArchive : undefined;
  const changed = before ? new Set(execFileSync("git", ["diff", baseline, "--name-only", "--", "plasmicpkgs/antd6/src"], { cwd: root, encoding: "utf8" }).trim().split("\n")) : new Set();
  const result = await build({ stdin: { contents: 'export * from "./plasmicpkgs/antd6/src/index"; export { registerAll as registerBusiness } from "./plasmicpkgs/overseas/src/index";', resolveDir: root, loader: "ts" }, bundle: true, packages: "external", platform: "node", format: "cjs", write: false,
    plugins: [{ name: "bundle-registration-runtime", setup(builder) {
      builder.onResolve({ filter: /^antd\/es\// }, args => ({ path: require.resolve(args.path), external: false }));
      builder.onResolve({ filter: /^@shiguang-lab\/plasmic-overseas$/ }, () => ({ path: path.join(root, "plasmicpkgs/overseas/src/index.ts"), external: false }));
      builder.onResolve({ filter: /^@shiguang-lab\/plasmic-antd6\/skinny\/native$/ }, () => ({ path: path.join(folder, "src/native.ts"), external: false }));
    } }, ...(before ? [{ name: "before-descriptions", setup(builder) { builder.onLoad({ filter: /\.tsx?$/ }, args => {
      const relative = path.relative(root, args.path);
      if (!changed.has(relative)) return;
      return { contents: execFileSync("git", ["show", baseline + ":" + relative], { cwd: root, encoding: "utf8" }), loader: args.path.endsWith("x") ? "tsx" : "ts", resolveDir: path.dirname(args.path) };
    }); } }] : [])], logLevel: "silent" });
  const module = { exports: {} };
  new Function("require", "module", "exports", result.outputFiles[0].text)(require, module, module.exports);
  const registrations = [];
  module.exports.registerAll({ registerComponent(_implementation, meta) { registrations.push(meta); }, registerGlobalContext() {}, registerToken() {} });
  module.exports.registerBusiness({ registerComponent(_implementation, meta) { registrations.push(meta); } });
  const literal = (value, ancestors = new Set()) => {
    if (typeof value === "function" || typeof value === "symbol") return undefined;
    if (!value || typeof value !== "object") return value;
    if (ancestors.has(value)) return "[Recursive metadata]";
    ancestors.add(value);
    const result = Array.isArray(value) ? value.map(item => literal(item, ancestors)) : Object.fromEntries(Object.entries(value).map(([key, item]) => [key, literal(item, ancestors)]).filter(([, item]) => item !== undefined));
    ancestors.delete(value); return result;
  };
  return { source: "Executed current registerAll against a capture-only loader; component implementations and metadata callbacks were not rendered/executed. Antd6 source and effective helper metadata, including dynamically assembled additional components.", before,
    baselineRevision: baseline, registrations: registrations.map(meta => literal(meta)) };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await captureComponentContracts({ before: process.argv.includes("--before") }); const index = process.argv.indexOf("--output");
  if (index >= 0) await writeFile(process.argv[index + 1], JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ count: report.registrations.length, described: report.registrations.filter(meta => meta.description?.trim()).length }));
}
