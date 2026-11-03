import path from "node:path";
import fs from "node:fs";
import base from "../../../../platform/wab/vitest.config";
if (!process.env.PERF_SOURCE_ROOT || !process.env.GEOMETRY_WASM) throw Error("Frozen source and kernel required");
const src=fs.realpathSync(path.join(process.env.PERF_SOURCE_ROOT,"platform/wab/src"));
export default {
  ...base,
  root:path.dirname(src),
  server:{fs:{allow:[fs.realpathSync(process.env.PERF_SOURCE_ROOT),path.resolve(__dirname,"../../../..")] }},
  resolve:{...base.resolve,alias:{...(base.resolve as any).alias,"@/":src+"/","src/":src+"/"}},
  test:{...base.test,projects:undefined,name:"geometry",maxWorkers:1,
    environment:"jsdom",environmentOptions:{jsdom:{url:"http://localhost/",runScripts:"outside-only"}},
    include:[path.join(src,"wab/client/components/canvas/marquee-selection.test.ts"),
      path.join(src,"wab/client/components/canvas/HoverBox/visible-bounds.test.ts"),path.resolve(__dirname,"kernel.test.ts")],
    setupFiles:[path.resolve(__dirname,"../../../../platform/wab/src/wab/client/__testonly__/setupTests.js"),path.resolve(__dirname,"test-setup.ts")],
  },
};
