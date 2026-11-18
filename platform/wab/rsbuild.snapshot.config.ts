import { defineConfig, mergeRsbuildConfig } from "@rsbuild/core";
import HtmlWebpackPlugin from "html-webpack-plugin";
import {
  getCommitHash,
  mkSharedRsbuildConfig,
} from "./tools/webpack/sharedRsbuildConfig";
const commitHash = getCommitHash();
export default mergeRsbuildConfig(
  mkSharedRsbuildConfig({ commitHash }),
  defineConfig({
    source: {
      entry: { snapshot: "./src/wab/client/canvas-snapshot/page.tsx" },
    },
    output: {
      distPath: { root: "build/canvas-snapshot" },
      assetPrefix: "/canvas-snapshot-assets/",
    },
    tools: {
      htmlPlugin: false,
      rspack: {
        plugins: [
          new HtmlWebpackPlugin({
            template: "./public/canvas-snapshot.html",
            templateParameters: { commitHash },
          }),
        ],
      },
    },
  }),
);
