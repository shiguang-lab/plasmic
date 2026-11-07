import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const require = createRequire(path.join(root, "package.json"));
const ts = require("typescript");
const files = [...new Set(execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: root, maxBuffer: 32 * 1024 * 1024 }).toString().split("\0"))]
  .filter(file => /\.[cm]?[jt]sx?$/.test(file) && fs.existsSync(path.join(root, file)) && !file.endsWith(".d.ts"));
const legacy = /^(?:mobx(?:-react(?:-lite)?|-utils)?(?:\/|$)|.*\/(?:import-mobx|mobx-util|mobx-client-util|canvas-observer|canvas-cache)$)/;
const rows = [];
for (const file of files) {
  const source = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), "utf8"), ts.ScriptTarget.Latest, true);
  const imports = [];
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) && legacy.test(node.moduleSpecifier.text)) {
      imports.push({ module: node.moduleSpecifier.text, statement: node.getText(source), line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1 });
    } else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === "require" || ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "resolve") && node.arguments.length && ts.isStringLiteral(node.arguments[0]) && legacy.test(node.arguments[0].text)) {
      imports.push({ module: node.arguments[0].text, statement: node.getText(source), line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1 });
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (imports.length) rows.push({ file, kind: /(?:\.test\.|\.spec\.|__testonly__|__mocks__|__tests__)/.test(file) ? "test" : /(?:config|build|webpack|rollup|rsbuild|vitest)/.test(file) ? "tooling" : "source", imports });
}
rows.sort((a, b) => a.file.localeCompare(b.file));
const manifests = [...new Set(execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z", "**/package.json", "package.json"], { cwd: root }).toString().split("\0"))]
  .filter(file => file && fs.existsSync(path.join(root, file)))
  .flatMap(file => {
    const json = JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
    const dependencies = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"].flatMap(section =>
      Object.entries(json[section] ?? {}).filter(([name]) => /^(?:mobx|mobx-react|mobx-react-lite|mobx-utils)$/.test(name)).map(([name, version]) => ({ section, name, version })));
    return dependencies.length ? [{ file, dependencies }] : [];
  });
const report = { scannedSourceFiles: files.length, remainingFiles: rows.length, byKind: Object.fromEntries(["source", "test", "tooling"].map(kind => [kind, rows.filter(row => row.kind === kind).length])), manifests, rows };
const output = JSON.stringify(report, null, 2) + "\n";
const destination = path.join(root, "docs/upgrades/react-19/state-inventory.json");
if (process.argv.includes("--check")) {
  if (!fs.existsSync(destination) || fs.readFileSync(destination, "utf8") !== output) throw new Error("State inventory is stale; run node docs/upgrades/react-19/state-inventory.mjs");
} else fs.writeFileSync(destination, output);
console.log(JSON.stringify({ scannedSourceFiles: report.scannedSourceFiles, remainingFiles: report.remainingFiles, byKind: report.byKind, manifests: manifests.length }));
