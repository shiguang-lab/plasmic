import { buildPreviewModules, type PreviewCodegenContext } from "@/wab/client/components/live/preview-codegen";
import { createTranspiler } from "@/wab/client/components/live/preview-transpiler";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { deepTrackComponents, mkTplComponent, mkTplTagX } from "@/wab/shared/core/tpls";
import type { ProjectId } from "@/wab/shared/ApiSchema";
import { writeFileSync } from "fs";
const results: unknown[] = [];
afterAll(() => {
 if (process.env.PREVIEW_PERF_OUTPUT) { writeFileSync(process.env.PREVIEW_PERF_OUTPUT, JSON.stringify(results,null,2)); }
});
it.each([100,1000])("reuses shared preview output across menu destinations with %i nodes", async count => {
 const site=createSite(),manager=new TplMgr({site});
 const shared=manager.addComponent({name:"SharedContent",type:ComponentType.Plain});
 const opts={baseVariant:shared.variants[0],styles:{}}; shared.tplTree=mkTplTagX("div",opts,Array.from({length:count},()=>mkTplTagX("div",opts)));
 const pages=["First","Second"].map(name=>(() => { const page=manager.addComponent({name,type:ComponentType.Plain}); page.tplTree=mkTplComponent(shared,page.variants[0]); return page; })());
 deepTrackComponents(site);
 const ctx:PreviewCodegenContext={site,siteInfo:{id:"preview-performance" as ProjectId,name:"Preview performance",appAuthProvider:undefined}};
 let start=performance.now();const first=buildPreviewModules(ctx,pages[0]);const firstMs=performance.now()-start;
 start=performance.now();const second=buildPreviewModules(ctx,pages[1]);const secondMs=performance.now()-start;
 const sharedModules=first.modules.filter(mod=>mod.name.includes(shared.uuid));
 const reused=sharedModules.every(mod=>second.modules.includes(mod));
 expect(sharedModules.length).toBeGreaterThan(0);expect(reused).toBe(true);
 expect(second.projectConfig).toBe(first.projectConfig);
 const transpile=createTranspiler();
 start=performance.now();if (count === 100) { await Promise.all(first.modules.map(transpile)); } const compileMs=performance.now()-start;
 start=performance.now();if (count === 100) { await Promise.all(second.modules.map(transpile)); } const nextCompileMs=performance.now()-start;
 results.push({count,firstMs,secondMs,reused,compileMs:count===100?compileMs:undefined,nextCompileMs:count===100?nextCompileMs:undefined});
 expect(first.modules.length).toBeGreaterThan(0);expect(second.modules.length).toBeGreaterThan(0);
});
