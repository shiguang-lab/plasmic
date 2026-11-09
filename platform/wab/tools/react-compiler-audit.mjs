import { parseSync, transformFromAstSync } from "@babel/core";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reactComponentBases, reactCompilerCandidates, uncompiledCandidates } from "./react-compiler-coverage.mjs";
import {
  reactCompilerBuildInfo,
  reactCompilerInclude,
  reactCompilerOptions,
  isReactRequiredErrorBoundary,
  reactRequiredErrorBoundaries,
} from "./react-compiler.mjs";

const wab = fileURLToPath(new URL("../", import.meta.url));
const readFiles = () => [...new Set(execFileSync("git", [
  "ls-files", "--cached", "--others", "--exclude-standard", "-z", "src", "../canvas-packages/src", "../react-web-bundle/src", "../live-frame/src", "../sub/src", "../../packages/react-web/src",
], { cwd: wab, maxBuffer: 32 * 1024 * 1024 }).toString().split("\0"))]
  .filter((file) => reactCompilerInclude.test(path.join(wab, file)) && fs.existsSync(path.join(wab, file)))
  .sort();
const files = readFiles();
const compiled = [];
const diagnostics = [];
const errors = [];
const sources = {};
const candidates = [];
const inputs = files.map((file) => ({ file, filename: path.join(wab, file), code: fs.readFileSync(path.join(wab, file), "utf8") }));
for (const input of inputs) {
  input.ast = parseSync(input.code, { filename: input.filename, babelrc: false, configFile: false, parserOpts: { plugins: ["typescript", "jsx"] } });
  if (!input.ast) { throw new Error(`Could not parse React source ${input.filename}`); }
}
const componentBases = reactComponentBases(inputs.map(({ ast }) => ast));

for (const input of inputs) {
  const { file, filename, code, ast } = input;
  sources[file] = createHash("sha256").update(code).digest("hex");
  try {
    candidates.push(...reactCompilerCandidates(ast, componentBases).map((candidate) => ({ file, ...candidate })));
    transformFromAstSync(ast, code, {
      filename,
      babelrc: false,
      configFile: false,
      plugins: [["babel-plugin-react-compiler", { ...reactCompilerOptions({
        logEvent: (_filename, event) => {
          if (event.kind === "CompileSuccess") {
            compiled.push({ file, name: event.fnName, loc: event.fnLoc });
          } else if (event.kind === "CompileError" || event.kind === "PipelineError" || event.kind === "CompileSkip") {
            diagnostics.push({ file, ...event });
          }
        },
      }), panicThreshold: "none" }]],
    });
  } catch (error) {
    errors.push({ file, message: String(error) });
  } finally {
    input.ast = undefined;
  }
}

const byCategory = {};
const missingCandidates = files.flatMap((file) => uncompiledCandidates(candidates.filter((entry) => entry.file === file), compiled.filter((entry) => entry.file === file), diagnostics.filter((entry) => entry.file === file)));
const requiredErrorBoundaries = missingCandidates.filter(isReactRequiredErrorBoundary);
const uncompiled = missingCandidates.filter((candidate) => !isReactRequiredErrorBoundary(candidate));
const missingRequiredErrorBoundaries = reactRequiredErrorBoundaries.filter(({ file, name }) => !requiredErrorBoundaries.some((candidate) => candidate.file === file && candidate.name === name));
const changedSources = [...new Set([
  ...files.filter((file) => !fs.existsSync(path.join(wab, file)) || sources[file] !== createHash("sha256").update(fs.readFileSync(path.join(wab, file))).digest("hex")),
  ...readFiles().filter((file) => !(file in sources)),
])].sort();
for (const diagnostic of diagnostics) {
  const detail = diagnostic.detail?.options ?? diagnostic.detail;
  const category = detail?.category ?? diagnostic.kind;
  byCategory[category] = (byCategory[category] ?? 0) + 1;
}
const summary = {
  files: files.length,
  compiledFiles: new Set(compiled.map((entry) => entry.file)).size,
  compiledFunctions: compiled.length,
  diagnosticFiles: new Set(diagnostics.map((entry) => entry.file)).size,
  diagnostics: diagnostics.length,
  byCategory,
  errors: errors.length,
  changedSources: changedSources.length,
  candidateFunctions: candidates.filter((entry) => entry.kind !== "class").length,
  classComponents: candidates.filter((entry) => entry.kind === "class").length,
  requiredErrorBoundaries: requiredErrorBoundaries.length,
  businessClassComponents: candidates.filter((entry) => entry.kind === "class" && !isReactRequiredErrorBoundary(entry)).length,
  missingRequiredErrorBoundaries: missingRequiredErrorBoundaries.length,
  uncompiledCandidates: uncompiled.length,
  unvisitedCandidates: uncompiled.filter((entry) => !entry.rejected).length,
};
const report = { config: reactCompilerBuildInfo(), summary, sources, compiled, candidates, uncompiled, requiredErrorBoundaries, missingRequiredErrorBoundaries, diagnostics, errors, changedSources };
if (process.argv[2]) {
  fs.writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + "\n");
}
console.log(JSON.stringify(summary, null, 2));
if (errors.length || diagnostics.length || changedSources.length || uncompiled.length || missingRequiredErrorBoundaries.length) { process.exitCode = 1; }
