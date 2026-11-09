const fs = require("node:fs");
const path = require("node:path");
const { createRequire, registerHooks } = require("node:module");
const { fileURLToPath, pathToFileURL } = require("node:url");
const { transformSync } = require("esbuild");
const { register } = require("esbuild-register/dist/node");
const { compileReactSource } = require("./react-compiler-transform.cjs");

// Other backend modules retain their existing TypeScript/path-resolution loader.
register();
const owner = createRequire(path.resolve(__dirname, "../package.json"));
const reactModules = new Map();
for (const name of ["react", "react-dom"]) {
  const manifest = owner(`${name}/package.json`);
  for (const subpath of Object.keys(manifest.exports)) {
    const specifier = subpath === "." ? name : name + subpath.slice(1);
    reactModules.set(specifier, pathToFileURL(owner.resolve(specifier)).href);
  }
}
const emailDirectory = path.resolve(__dirname, "../src/wab/server/emails") + path.sep;
registerHooks({
  resolve(specifier, context, nextResolve) {
    const url = reactModules.get(specifier);
    return url ? { url, shortCircuit: true } : nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (!url.startsWith("file:")) { return nextLoad(url, context); }
    const filename = fileURLToPath(url);
    if (!filename.startsWith(emailDirectory) || !/\.[jt]sx?$/.test(filename) || /[.-](?:test|spec)\./.test(filename) || filename.includes(`${path.sep}__testonly__${path.sep}`)) { return nextLoad(url, context); }
    const source = compileReactSource(fs.readFileSync(filename, "utf8"), filename);
    const extension = path.extname(filename);
    const result = transformSync(source, {
      sourcefile: filename, loader: extension.slice(1),
      format: "cjs", sourcemap: "inline", target: "node22",
      tsconfigRaw: { compilerOptions: { jsx: "react", experimentalDecorators: true } },
    });
    return { format: "commonjs", source: result.code, shortCircuit: true };
  },
});
