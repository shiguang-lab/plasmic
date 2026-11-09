const path = require("node:path");
const { parseSync, transformFromAstSync } = require("@babel/core");
const { reactCompilerOptions, isReactRequiredErrorBoundary } = require("./react-compiler.mjs");
const { reactComponentBases, reactCompilerCandidates, uncompiledCandidates } = require("./react-compiler-coverage.mjs");

/** Compile the original TS/JSX before its execution loader erases React syntax.
 * Coverage is checked independently of inference, including component factories. */
function compileReactSource(code, filename) {
  const ast = parseSync(code, { filename, babelrc: false, configFile: false, parserOpts: { plugins: ["typescript", "jsx"] } });
  if (!ast) { throw new Error(`Could not parse React source ${filename}`); }
  const bases = reactComponentBases([ast]);
  const candidates = reactCompilerCandidates(ast, bases);
  const successes = [];
  const result = transformFromAstSync(ast, code, {
    filename, babelrc: false, configFile: false, sourceMaps: "inline",
    plugins: [["babel-plugin-react-compiler", reactCompilerOptions({ logEvent: (_file, event) => {
      if (event.kind === "CompileSuccess") { successes.push({ loc: event.fnLoc }); }
    } })]],
  });
  const missing = uncompiledCandidates(candidates, successes, []).filter(candidate => !isReactRequiredErrorBoundary({...candidate, file: path.relative(path.resolve(__dirname, ".."), filename).split(path.sep).join("/")}));
  if (missing.length) { throw new Error(`${filename}: React Compiler did not compile ${missing.map(entry => `${entry.name} at ${entry.loc?.start.line}:${entry.loc?.start.column}`).join(", ")}`); }
  if (!result?.code) { throw new Error(`React Compiler returned no source for ${filename}`); }
  return result.code;
}
exports.compileReactSource = compileReactSource;
