import path from "node:path";
import { mergeRsbuildConfig } from "../../../../platform/wab/node_modules/@rsbuild/core";
import base from "../../../../platform/wab/rsbuild.config";
if (!process.env.PERF_SOURCE_ROOT || !process.env.PERF_BUILD_OUT) throw Error("Private frozen source and output required");
const src = path.join(process.env.PERF_SOURCE_ROOT, "platform/wab/src");
const config = mergeRsbuildConfig(base, {
  source: { entry: { index: [path.join(src, "wab/client/main.tsx"), path.resolve(__dirname, "entry.ts")] } },
  resolve: { aliasStrategy:"prefer-alias", alias: { "@": src, src,
    "@plasmicpkgs/antd5/form-meta":path.resolve(__dirname,"../../../../plasmicpkgs/antd5/src/form-meta.ts"),
    "@plasmicapp/host":path.resolve(__dirname,"../../../../packages/host"),
  } },
  output: { cleanDistPath:true, distPath: { root: process.env.PERF_BUILD_OUT } },
});
// Rsbuild merges entry arrays; replace the upstream entry rather than running
// both its live main and our frozen main in one document.
config.source!.entry = {index:[path.join(src,"wab/client/main.tsx"),path.resolve(__dirname,"entry.ts")]};
export default config;
