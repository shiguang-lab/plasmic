import { defineConfig, mergeRsbuildConfig } from "@rsbuild/core";
import HtmlWebpackPlugin from "html-webpack-plugin";
import { getCommitHash, mkSharedRsbuildConfig } from "../webpack/sharedRsbuildConfig";
const commitHash = getCommitHash();
const staticUrl = process.env.STATIC_URL || "http://127.0.0.1:3217";
export default mergeRsbuildConfig(
  mkSharedRsbuildConfig({ commitHash }),
  defineConfig({
    tools: {
      htmlPlugin: false,
      rspack: {
        module: { rules: [{ test: /\/src\/wab\/client\//, sideEffects: false }] },
        plugins: [
          new HtmlWebpackPlugin({ filename: "index.html", chunks: ["index"], title: "Dashboard canvas preview probe" }),
          new HtmlWebpackPlugin({
            filename: "engine.html",
            chunks: ["engine"],
            template: "./public/canvas-preview.html",
            templateParameters: { staticUrl, commitHash },
          }),
        ],
      },
    },
    source: { entry: { index: "./tools/dashboard-preview-probe/entry.ts", engine: "./tools/dashboard-preview-probe/engine.ts" } },
    output: { distPath: { root: "/tmp/plasmic-cover-probe/build" }, assetPrefix: "/probe/" },
  }),
);
