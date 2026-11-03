import path from "node:path";
import { mergeRsbuildConfig } from "../../../../platform/wab/node_modules/@rsbuild/core";
import base from "./build.config";
const root=process.env.PERF_SOURCE_ROOT;
if(!root)throw Error("Frozen production source required");
const config=mergeRsbuildConfig(base,{resolve:{alias:{"@geometry-baseline":path.resolve(root,"../baseline-selection.ts"),"@drag-baseline":path.resolve(root,"../baseline-drag.tsx")}}});
config.source!.entry={index:[path.join(root,"platform/wab/src/wab/client/main.tsx"),path.resolve(__dirname,"production-entry.ts")]};
export default config;
