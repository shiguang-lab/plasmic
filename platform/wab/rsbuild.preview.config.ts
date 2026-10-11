import { defineConfig, mergeRsbuildConfig } from "@rsbuild/core";
import HtmlWebpackPlugin from "html-webpack-plugin";
import { homepage } from "./package.json";
import {
  getCommitHash,
  mkSharedRsbuildConfig,
} from "./tools/webpack/sharedRsbuildConfig";

const commitHash = getCommitHash();
const staticUrl = process.env.STATIC_URL ?? process.env.PUBLIC_URL ?? homepage;
export default mergeRsbuildConfig(
  mkSharedRsbuildConfig({ commitHash }),
  defineConfig({
    source: {
      entry: {
        index: "./src/wab/client/components/dashboard/preview/engine.ts",
      },
    },
    output: {
      distPath: { root: "build/canvas-preview" },
      assetPrefix: `${staticUrl}/canvas-preview/`,
    },
    tools: {
      htmlPlugin: false,
      rspack: {
        // This separate build includes pure rendering exports and omits Studio UI initializers.
        module: {
          rules: [{ test: /\/src\/wab\/client\//, sideEffects: false }],
        },
        plugins: [
          new HtmlWebpackPlugin({
            template: "./public/canvas-preview.html",
            templateParameters: { staticUrl, commitHash },
          }),
        ],
      },
    },
  }),
);
