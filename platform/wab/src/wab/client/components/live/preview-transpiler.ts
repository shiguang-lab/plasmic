import type { AssetModule, CodeModule, SourceModule } from "@/wab/client/components/live/preview-types";
import { ensure } from "@/wab/shared/common";
import { reactCompilerOptions } from "../../../../../tools/react-compiler.mjs";

/** Each live module edit evicts its instance and all importers. React therefore
 * mounts a new component type; no Fast Refresh cache survives a source edit. */
async function compilePreviewModule(mod: SourceModule) {
  const [{ parseSync, transformFromAstSync }, { default: compiler }, { transform }, { reactComponentBases, reactCompilerCandidates, uncompiledCandidates }, { outlineEventHandlers }, { outlinePreviewRenderBoundaries }] = await Promise.all([
    import("@babel/core"),
    import("babel-plugin-react-compiler"),
    import("sucrase"),
    import("../../../../../tools/react-compiler-coverage.mjs"),
    import("../../../../../tools/preview-event-handlers.mjs"),
    import("../../../../../tools/preview-render-boundaries.mjs"),
  ]);
  const ast = ensure(parseSync(mod.source, { filename: mod.name, babelrc: false, configFile: false, sourceType: "module", parserOpts: { plugins: ["typescript", "jsx"] } }), `Could not parse Preview source ${mod.name}`);
  const bases = reactComponentBases([ast]);
  const originalCandidates = reactCompilerCandidates(ast, bases);
  outlineEventHandlers(ast, originalCandidates);
  // Use Babel's large-source cutoff. Splitting small pages adds more Compiler
  // functions than it saves; the actual menu's 118KB page needs no outlining.
  const outlined = mod.source.length > 500_000 && outlinePreviewRenderBoundaries(ast, originalCandidates);
  const candidates = outlined ? reactCompilerCandidates(ast, bases) : originalCandidates;
  const successes: Array<{ loc: unknown }> = [];
  const compiled = transformFromAstSync(ast, mod.source, {
    filename: mod.name,
    babelrc: false,
    configFile: false,
    // This AST belongs to this single compilation; coverage was collected above.
    cloneInputAst: false,
    retainLines: true,
    // Babel's automatic compact mode for >500KB sources can emit `return<...>`.
    // Sucrase replaces that JSX with an identifier, merging it with `return`.
    compact: false,
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

/** Worker transport owns reuse; this operation compiles one immutable source. */
export async function transpilePreviewModule(mod: SourceModule): Promise<CodeModule | AssetModule> {
  return mod.lang === "css"
    ? { fileName: mod.name, source: mod.source, type: "asset" }
    : { fileName: mod.name, code: await compilePreviewModule(mod), imports: [], type: "code" };
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
