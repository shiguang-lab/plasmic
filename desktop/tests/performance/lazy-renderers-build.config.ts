// Isolated diagnostic entry; release builds never include the probe.
import path from "node:path";
import { mergeRsbuildConfig } from "../../../platform/wab/node_modules/@rsbuild/core";
import base from "./open-build.config";

const sourceRoot = process.env.PERF_SOURCE_ROOT;
if (!sourceRoot) {
  throw new Error("PERF_SOURCE_ROOT must name the frozen diagnostic source");
}

export default mergeRsbuildConfig(base, {
  resolve: {
    alias: {
      "@shiguang2/components/esm/scrollbar": require.resolve(
        "@shiguang2/components/esm/scrollbar",
        {
          paths: [path.resolve(__dirname, "../../../platform/wab")],
        },
      ),
    },
  },
  source: {
    entry: {
      index: [
        path.join(sourceRoot, "platform/wab/src/wab/client/main.tsx"),
        path.resolve(__dirname, "lazy-renderers-entry.ts"),
      ],
    },
  },
  output: { cleanDistPath: true },
});
