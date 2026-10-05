import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const scripts = path.dirname(fileURLToPath(import.meta.url));
for (const script of ["package.mjs", "publish.mjs"]) {
  execFileSync(process.execPath, [path.join(scripts, script), ...process.argv.slice(2)], { stdio: "inherit" });
}
