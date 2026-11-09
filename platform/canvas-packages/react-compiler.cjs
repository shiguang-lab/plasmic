const fs = require("node:fs/promises");
const path = require("node:path");
const { transformAsync } = require("@babel/core");
const compiler = require("babel-plugin-react-compiler");
const { reactCompilerInclude, reactCompilerOptions } = require("../wab/tools/react-compiler.mjs");

exports.reactCompilerPlugin = () => ({
  name: "canvas-react-compiler",
  setup(build) {
    build.onLoad({ filter: /\.[jt]sx?$/ }, async ({ path: filename }) => {
      if (!reactCompilerInclude.test(filename)) { return; }
      const result = await transformAsync(await fs.readFile(filename, "utf8"), {
        filename, babelrc: false, configFile: false, sourceMaps: "inline",
        parserOpts: { plugins: ["typescript", "jsx"] },
        plugins: [[compiler, reactCompilerOptions()]],
      });
      if (!result?.code) { throw new Error(`Compiler returned no Canvas source: ${filename}`); }
      return { contents: result.code, loader: filename.endsWith("x") ? "tsx" : "ts", resolveDir: path.dirname(filename) };
    });
  },
});
