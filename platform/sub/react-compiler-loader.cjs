const { transformAsync } = require("@babel/core");
const compiler = require("babel-plugin-react-compiler");
const react = require("@babel/preset-react");
const { reactCompilerOptions } = require("../wab/tools/react-compiler.mjs");

/** ts-loader checks the original TypeScript and preserves JSX. The Compiler
 * then transforms JavaScript before the automatic JSX runtime is emitted. */
module.exports = function reactCompilerLoader(source, inputSourceMap) {
  const done = this.async();
  this.cacheable();
  this.addDependency(require.resolve("../wab/tools/react-compiler.mjs"));
  transformAsync(source, {
    filename: this.resourcePath,
    babelrc: false,
    configFile: false,
    inputSourceMap: inputSourceMap || undefined,
    sourceMaps: true,
    presets: [[react, { runtime: "automatic" }]],
    plugins: [[compiler, reactCompilerOptions()]],
  }).then((result) => {
    if (!result?.code) {
      done(new Error(`Compiler returned no Sub source: ${this.resourcePath}`));
      return;
    }
    done(null, result.code, result.map);
  }, done);
};
