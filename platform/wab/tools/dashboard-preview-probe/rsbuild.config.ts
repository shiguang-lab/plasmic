import { defineConfig, mergeRsbuildConfig } from "@rsbuild/core";
import { mkSharedRsbuildConfig } from "../webpack/sharedRsbuildConfig";
export default mergeRsbuildConfig(
  mkSharedRsbuildConfig({ commitHash: "527c56" }),
  defineConfig({
    // Probe only: exclude unused Studio module initialization from the isolated renderer.
    tools: {
      rspack: {
        module: {
          rules: [{ test: /\/src\/wab\/client\//, sideEffects: false }],
        },
      },
    },
    source: {
      entry: {
        index: "./tools/dashboard-preview-probe/entry.ts",
        engine: "./tools/dashboard-preview-probe/engine.ts",
      },
    },
    output: {
      distPath: { root: "/tmp/plasmic-cover-probe/build" },
      assetPrefix: "/probe/",
    },
    html: { title: "Dashboard canvas preview probe" },
  }),
);
