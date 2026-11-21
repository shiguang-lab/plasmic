// An ICSS @value import inherits the importing Less module's loader chain.
// Compile Sass references in their own syntax before css-loader reads their exports.
const path = require("node:path");
const sass = require("sass");

function compileSassModule(file) {
  return sass.compileAsync(file, {
    loadPaths: [path.resolve(__dirname, "../..")],
    silenceDeprecations: ["import", "global-builtin", "color-functions"],
  });
}

module.exports = function sassModuleReference(source, map) {
  if (!/\.s[ac]ss$/.test(this.resourcePath))
    return this.callback(null, source, map);
  const done = this.async();
  compileSassModule(this.resourcePath).then((result) => {
    for (const url of result.loadedUrls) {
      if (url.protocol === "file:")
        this.addDependency(require("node:url").fileURLToPath(url));
    }
    done(null, result.css);
  }, done);
};
module.exports.compileSassModule = compileSassModule;
