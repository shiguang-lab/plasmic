import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

// Emit public types from authored TypeScript. Compiler's optimized function
// bodies are runtime output and must not determine the library's public types.
const config = ts.readConfigFile("tsconfig.json", ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd(), {
  noEmit: false, declaration: true, emitDeclarationOnly: true,
  declarationMap: false, outDir: path.resolve("dist"), noEmitOnError: true,
});
const files = parsed.fileNames.filter((file) => !/[.-](?:spec|test|stories)\.[jt]sx?$/.test(file));
const program = ts.createProgram(files, parsed.options);
const diagnostics = [config.error, ...parsed.errors, ...ts.getPreEmitDiagnostics(program)].filter(Boolean);
if (diagnostics.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCurrentDirectory: () => process.cwd(), getCanonicalFileName: (file) => file,
    getNewLine: () => "\n",
  }));
  process.exit(1);
}
const result = program.emit(undefined, (file, contents) => {
  const relative = path.relative(path.resolve("dist"), file);
  for (const output of ["dist", "skinny/dist", "lib"]) {
    const target = path.join(output, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents);
  }
}, undefined, true);
if (result.emitSkipped) { throw new Error("React Web declaration emission failed"); }
