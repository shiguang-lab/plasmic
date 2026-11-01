// Private, frozen-source A/B builds only. Release builds do not use this entry.
import path from "node:path";
import { mergeRsbuildConfig } from "../../../platform/wab/node_modules/@rsbuild/core";
import base from "../../../platform/wab/rsbuild.config";

if (!process.env.PERF_SOURCE_ROOT || !process.env.PERF_BUILD_OUT) {
  throw new Error("PERF_SOURCE_ROOT and PERF_BUILD_OUT must name private diagnostic directories");
}
const src = path.join(process.env.PERF_SOURCE_ROOT, "platform/wab/src");
export default mergeRsbuildConfig(base, {
  source: { entry: { index: [path.join(src,"wab/client/main.tsx")] } },
  resolve: { alias: { "@":src, "src":src } },
  output: { distPath: { root:process.env.PERF_BUILD_OUT } },
});
