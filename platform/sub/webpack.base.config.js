const path = require("node:path");

module.exports = {
  entry: {
    client: "./src/index.tsx",
  },
  output: {
    filename: "[name].js",
    path: __dirname + "/dist",
    sourceMapFilename: "[file].map",
  },
  mode: "development",
  // Enable sourcemaps for debugging webpack's output.
  devtool: "source-map",
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".json"],
    // Canvas packages and the host share the same Ant Design module graph.
    alias: {
      "@plasmicapp/host$": path.resolve(__dirname, "../../packages/host"),
      react: path.dirname(require.resolve("react/package.json")),
      "react-dom": path.dirname(require.resolve("react-dom/package.json")),
      antd$: require.resolve("antd/es/index.js"),
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        include: path.resolve(__dirname, "src"),
        // Webpack runs loaders from right to left. Type checking sees the
        // original source; strict Compiler lowering receives JavaScript/JSX.
        use: [
          { loader: path.resolve(__dirname, "react-compiler-loader.cjs") },
          { loader: "ts-loader", options: { compilerOptions: { jsx: "preserve" } } },
        ],
      },
      // All output '.js' files will have any sourcemaps re-processed by 'source-map-loader'.
      { enforce: "pre", test: /\.js$/, loader: "source-map-loader" },
    ],
  },
};
