// Isolated diagnostics only; this config is never used by the release build.
import path from "node:path";
import { mergeRsbuildConfig } from "../../../platform/wab/node_modules/@rsbuild/core";
import base from "../../../platform/wab/rsbuild.config";

if (!process.env.PERF_BUILD_OUT) {
  throw new Error(
    "PERF_BUILD_OUT must name a private diagnostic output directory",
  );
}

export default mergeRsbuildConfig(base, {
  source: {
    entry: {
      index: [
        path.resolve(
          __dirname,
          "../../../platform/wab/src/wab/client/main.tsx",
        ),
        path.resolve(__dirname, "undo-functional-entry.ts"),
        path.resolve(__dirname, "undo-growth-entry.ts"),
      ],
    },
  },
  output: { distPath: { root: process.env.PERF_BUILD_OUT } },
});
