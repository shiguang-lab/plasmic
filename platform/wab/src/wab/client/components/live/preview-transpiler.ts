import type { AssetModule, CodeModule, SourceModule } from "@/wab/client/components/live/preview-types";
import { ensure } from "@/wab/shared/common";
import { reactCompilerOptions } from "../../../../../tools/react-compiler.mjs";

/** Each live module edit evicts its instance and all importers. React therefore
 * mounts a new component type; no Fast Refresh cache survives a source edit. */
async function compilePreviewModule(mod: SourceModule) {
  const [{ parseSync, transformFromAstSync }, { default: compiler }, { transform }, { reactComponentBases, reactCompilerCandidates, uncompiledCandidates }] = await Promise.all([
    import("@babel/core"),
    import("babel-plugin-react-compiler"),
    import("sucrase"),
    import("../../../../../tools/react-compiler-coverage.mjs"),
  ]);
  const ast = ensure(parseSync(mod.source, { filename: mod.name, babelrc: false, configFile: false, sourceType: "module", parserOpts: { plugins: ["typescript", "jsx"] } }), `Could not parse Preview source ${mod.name}`);
  const bases = reactComponentBases([ast]);
  const candidates = reactCompilerCandidates(ast, bases);
  const successes: Array<{ loc: unknown }> = [];
  const compiled = transformFromAstSync(ast, mod.source, {
    filename: mod.name,
    babelrc: false,
    configFile: false,
    // This AST belongs to this single compilation; coverage was collected above.
    cloneInputAst: false,
    retainLines: true,
    sourceType: "module",
    plugins: [[compiler, {
      ...reactCompilerOptions({ logEvent: (_file, event) => {
        if (event.kind === "CompileSuccess") { successes.push({ loc: event.fnLoc }); }
      } }),
      environment: { enableResetCacheOnSourceFileChanges: false },
    }]],
  });
  const missing = uncompiledCandidates(candidates, successes, []);
  if (missing.length) {
    throw new Error(`${mod.name}: React Compiler did not compile ${missing.map((entry) => `${entry.name} at ${entry.loc?.start.line}:${entry.loc?.start.column}`).join(", ")}`);
  }
  return transform(ensure(compiled?.code, `Compiler returned no Preview source for ${mod.name}`), {
    transforms: ["typescript", "jsx", "imports"],
    jsxPragma: mod.jsxPragma,
    production: true,
    disableESTransforms: true,
  }).code;
}

export function createTranspiler() {
  const cache = new Map<string, { source: string; jsxPragma?: string; code: string }>();
  return async (mod: SourceModule): Promise<CodeModule | AssetModule> => {
    if (mod.lang === "css") {
      return { fileName: mod.name, source: mod.source, type: "asset" };
    }
    let entry = cache.get(mod.name);
    if (!entry || entry.source !== mod.source || entry.jsxPragma !== mod.jsxPragma) {
      entry = { source: mod.source, jsxPragma: mod.jsxPragma, code: await compilePreviewModule(mod) };
      cache.set(mod.name, entry);
    }
    return { fileName: mod.name, code: entry.code, imports: [], type: "code" };
  };
}
