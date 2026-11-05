import { build } from "esbuild";
import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export async function generateComponentReviewContract({ check = false } = {}) {
  const contracts = await loadComponentReviewContract();
  const require = createRequire(path.join(root, "platform/wab/package.json"));
  const { zodSchema } = require("ai");
  const schema = zodSchema(contracts.componentReviewContextSchema).jsonSchema;
  const text = JSON.stringify(schema, null, 2) + "\n";
  const file = path.join(root, "desktop/src/component-review-contract.json");
  if (check) { if (await readFile(file, "utf8") !== text) throw new Error("Component review MCP schema is stale; regenerate from the shared Zod contract"); }
  else await writeFile(file, text);
  return schema;
}

export async function loadComponentReviewContract() {
  const wab = path.join(root, "platform/wab");
  const require = createRequire(path.join(wab, "package.json"));
  const result = await build({ entryPoints: [path.join(wab, "src/wab/shared/copilot/component-review.ts")], bundle: true, platform: "node", format: "cjs", external: ["zod"], write: false, logLevel: "silent" });
  const module = { exports: {} };
  new Function("require", "module", "exports", result.outputFiles[0].text)(require, module, module.exports);
  return module.exports;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await generateComponentReviewContract({ check: process.argv.includes("--check") });
