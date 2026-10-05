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
      antd$: require.resolve("antd/es/index.js"),
    },
  },
  module: {
    rules: [
      // All files with a '.ts' or '.tsx' extension will be handled by 'ts-loader'.
      { test: /\.tsx?$/, loader: "ts-loader" },
      // All output '.js' files will have any sourcemaps re-processed by 'source-map-loader'.
      { enforce: "pre", test: /\.js$/, loader: "source-map-loader" },
    ],
  },
};
