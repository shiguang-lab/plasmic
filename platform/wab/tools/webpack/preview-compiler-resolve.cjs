/** Babel's browser entry disables filesystem config discovery. Its Compiler
 * bundle also contains unused Node config/terminal code, and Preview replaces
 * module instances instead of running the crypto-based Fast Refresh hash path.
 * Scope these capabilities to Babel/Compiler; app imports retain normal rules. */
exports.previewCompilerBrowserRule = {
  test: /[\\/]node_modules[\\/](?:@babel[\\/]|babel-plugin-react-compiler[\\/]|convert-source-map[\\/])/,
  resolve: {
    alias: {
      "path$": require.resolve("path-browserify"),
      "assert$": require.resolve("assert/"),
    },
    fallback: { fs: false, os: false, tty: false, crypto: false },
  },
};
