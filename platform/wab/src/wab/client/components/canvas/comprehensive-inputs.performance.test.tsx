import { useVariantsController } from "@/wab/client/studio-ctx/variant-controller-inputs";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { ModelCommit, StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { FontFamilyTokenInputs, useFontFamilyTokenInputs } from "@/wab/client/studio-ctx/font-family-token-inputs";
import { VariantComboSource } from "@/wab/client/studio-ctx/variant-combo-inputs";
import { ContextSettingsInputs } from "@/wab/client/components/sidebar/context-settings-inputs";
import { useVariantPickerInputs } from "@/wab/client/components/sidebar-tabs/variant-picker-inputs";
import { useComponentParamInputs } from "@/wab/client/components/sidebar-tabs/ComponentProps/component-param-inputs";
import { useVariantLabelInputs } from "@/wab/client/components/variants/variant-label-inputs";
import { DedicatedArenaInputs } from "@/wab/client/components/studio/arenas/dedicated-arena-inputs";
import { PreviewVariantInputs } from "@/wab/client/components/top-bar/preview-variant-inputs";
import { mkComponentArena } from "@/wab/shared/component-arenas";
import { useCanvasViewInputs } from "@/wab/client/components/canvas/canvas-view-inputs";
import { canvasSlotFields } from "@/wab/client/components/canvas/canvas-slot-inputs";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { mkArenaFrame } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { mkVariant } from "@/wab/shared/Variants";
import { mkStyleToken, mkTokenRef } from "@/wab/commons/StyleToken";
import { ComponentType } from "@/wab/shared/core/components";
import { mkTplComponent } from "@/wab/shared/core/tpls";
import { mkParam } from "@/wab/shared/core/lang";
import { typeFactory } from "@/wab/shared/model/model-util";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { createStore } from "zustand/vanilla";
import { act, renderHook } from "@testing-library/react";
import { writeFileSync } from "fs";
const results: unknown[] = [];
afterAll(() => { if (process.env.COMPREHENSIVE_PERF_OUTPUT) {writeFileSync(process.env.COMPREHENSIVE_PERF_OUTPUT, JSON.stringify(results, null, 2));} });
function fixture() {
  const site = createSite(), models = new ModelSnapshots(), lifetime = new AbortController();
  const commits = new Set<(event: ModelCommit) => void>();
  const studio = {
    site, modelSnapshots: models, singleRsStyleInputs: { isDisposed: false }, currentArena: null,
    arenaState: { lifetime: () => lifetime.signal, store: createStore(() => ({ current: null, focusedMode: false })), viewRegistry: { store: createStore(() => []) } },
    selectionStore: createStore(() => ({ view: undefined, frames: [] })),
    uiEnvironment: { store: createStore(() => ({ canCreateTokens: true, canOverrideImportedTokens: true, canOverrideRegisteredTokens: true })) },
    subscribeModelChanges: (listener: (event: ModelCommit) => void) => { commits.add(listener); return () => { commits.delete(listener); }; },
  } as unknown as StudioCtx;
  let fields = 0, bindings = 0;
  const declared = models.declaredField.bind(models), prepared = models.subscribePreparedField.bind(models);
  models.declaredField = (model, key) => { fields++; return declared(model, key); };
  models.subscribePreparedField = (store, listener) => { bindings++; return prepared(store, listener); };
  const measure = (phase: string, run: () => void) => {
    fields = 0; bindings = 0;
    const start = performance.now(); run();
    return { phase, fields, bindings, ms: performance.now() - start };
  };
  return { site, models, studio, lifetime, commits, measure };
}

it.each([100, 1000])("font catalog, %i tokens", (count) => {
 const f=fixture();
 f.site.styleTokens.push(...Array.from({length:count},(_,i)=>mkStyleToken({name:`Font${i}`,type:"FontFamily",value:"Arial"})));
 const source=new FontFamilyTokenInputs(f.studio,new VariantedStylesHelper(), false, "Arial");
 let stop=()=>{};
 const mount=f.measure("initial read and connect",()=>{source.getSnapshot();stop=source.subscribe(()=>{});});
 const clean=f.measure("10 unchanged reads",()=>{for(let i=0;i<10;i++){source.getSnapshot();}});
 expect(source.getSnapshot().choices).toHaveLength(0);
 expect(mount.fields).toBe(0); expect(mount.bindings).toBe(0);
 results.push({subject:"closed font token selector",count,mount,clean});
 stop();f.lifetime.abort();f.models.dispose();
});
it.each([100, 1000])("combo batch, %i variants",(count)=>{
 const f=fixture(),manager=new TplMgr({site:f.site});
 const comp=manager.addComponent({name:"Owner",type:ComponentType.Plain});
 const variants=Array.from({length:count},(_,i)=>mkVariant({name:`V${i}`}));comp.variants.push(...variants);
 const recorder=new ChangeRecorder({inst:f.site,_instUtil:instUtil});
 const view={studioCtx:f.studio,site:f.site,disposeSignal:f.lifetime.signal,selectionStore:createStore(()=>({tpls:[]})),focusedTpl:()=>undefined} as unknown as ViewCtx;
 const source=new VariantComboSource(view,variants);let notices=0;const stop=source.subscribe(()=>{notices++;});notices=0;
 const changes=recorder.withRecording(()=>variants.forEach(v=>{v.name+="X";})).changes;
 const update=f.measure("batch rename variants",()=>f.models.sync(changes));
 expect(source.getSnapshot().labels[0].name).toContain("X");
 expect(update.fields).toBeLessThan(count*10); expect(notices).toBe(1);
 results.push({subject:"variant combo",count,update,notices});
 stop();f.lifetime.abort();recorder.dispose();f.models.dispose();
});
it.each([10, 50, 100])("variant group row subscriptions, %i groups",(count)=>{
 const f=fixture(),manager=new TplMgr({site:f.site});
 const component=manager.addComponent({name:"Instance",type:ComponentType.Plain});
 const groups=Array.from({length:count},(_,i)=>manager.createVariantGroup({component,name:`Mode${i}`}));
 groups.forEach(g=>{g.variants=[mkVariant({name:"Active",parent:g})];});
 const tpl=mkTplComponent(component, component.variants[0]),frame=mkArenaFrame({site:f.site,component,name:"Frame",width:800,height:600});
 const view={studioCtx:f.studio,site:f.site,disposeSignal:f.lifetime.signal,modelLifetime:f.lifetime.signal,isDisposed:false,arenaFrame:()=>frame} as unknown as ViewCtx;
 const recorder=new ChangeRecorder({inst:f.site,_instUtil:instUtil});
 const hooks: ReturnType<typeof renderHook>[]=[];
 const mount=f.measure("mount one hook per rendered group",()=>{groups.forEach(g=>hooks.push(renderHook(()=>useVariantPickerInputs(view,tpl,g))));});
 const changes=recorder.withRecording(()=>{groups[0].variants[0].name+="X";}).changes;
 const update=f.measure("rename one group's variant",()=>act(()=>f.models.sync(changes)));
 expect(mount.fields).toBeLessThan(count*150); expect(update.fields).toBeLessThan(100);
 results.push({subject:"variant picker group rows",count,mount,update});
 hooks.forEach(h=>h.unmount());f.lifetime.abort();recorder.dispose();f.models.dispose();
});
it.each([100,1000])("component param roster, %i params",count=>{
 const f=fixture(),manager=new TplMgr({site:f.site});
 const component=manager.addComponent({name:"Owner",type:ComponentType.Plain});
 component.params=Array.from({length:count},(_,i)=>mkParam({name:`P${i}`,paramType:"prop",type:typeFactory.text()}));
 const recorder=new ChangeRecorder({inst:f.site,_instUtil:instUtil});
 const hook=renderHook(()=>useComponentParamInputs(f.studio,component));
 const changes=recorder.withRecording(()=>component.params.forEach(p=>{p.variable.name+="X";})).changes;
 const update=f.measure("batch rename params with one roster subscriber",()=>act(()=>f.models.sync(changes)));
 expect(update.fields).toBeLessThan(count*30);
 results.push({subject:"component param roster",count,update});
 hook.unmount();f.lifetime.abort();recorder.dispose();f.models.dispose();
});
it.each([100,1000])("context settings, %i ordinary components",count=>{
 const f=fixture(),manager=new TplMgr({site:f.site});
 Array.from({length:count},(_,i)=>manager.addComponent({name:`Comp${i}`,type:ComponentType.Plain}));
 const source=new ContextSettingsInputs(f.studio);const stop=source.subscribe(()=>{});
 const clean=f.measure("10 unchanged reads",()=>{for(let i=0;i<10;i++){source.getSnapshot();}});
 expect(clean.fields).toBe(0);
 results.push({subject:"context settings with no contexts",count,clean});
 stop();f.lifetime.abort();f.models.dispose();
});

it.each([100,1000])("additional variant subscriptions, %i variants",count=>{
 for(const subject of ["variant labels","dedicated arena","preview variant menu"]){
 const f=fixture(),manager=new TplMgr({site:f.site});
 const component=manager.addComponent({name:"Owner",type:ComponentType.Plain});
 const group=manager.createVariantGroup({component,name:"Mode"});
 group.variants=Array.from({length:count},(_,i)=>mkVariant({name:`V${i}`,parent:group}));
 const arena=mkComponentArena({site:f.site,component});
 const recorder=new ChangeRecorder({inst:f.site,_instUtil:instUtil});
 let stop=()=>{};
 if(subject==="variant labels"){
  const hook=renderHook(()=>useVariantLabelInputs(f.studio,group.variants,{component,group}));stop=()=>hook.unmount();
 }else{
  const source=subject==="dedicated arena" ? new DedicatedArenaInputs(f.studio,arena) : new PreviewVariantInputs(f.studio,component);
  source.getSnapshot();stop=source.subscribe(()=>{});
 }
 const changes=recorder.withRecording(()=>group.variants.forEach(v=>{v.name+="X";})).changes;
 const update=f.measure("batch rename group variants",()=>act(()=>f.models.sync(changes)));
 expect(update.fields).toBeLessThan(count*20);
 results.push({subject,count,update});
 stop();f.lifetime.abort();recorder.dispose();f.models.dispose();
 }
});
it.each([100,1000])("canvas slot subscription repeated reads, %i nodes",count=>{
 const f=fixture(),manager=new TplMgr({site:f.site});
 const nodes=Array.from({length:count},()=>mkTplTagX("div"));
 const component=manager.addComponent({name:"Owner",type:ComponentType.Plain,rootTpl:mkTplTagX("div",{},nodes)});
 const view={studioCtx:f.studio,disposeSignal:f.lifetime.signal} as unknown as ViewCtx;
 const recipe=(field:Parameters<typeof canvasSlotFields>[1])=>canvasSlotFields(component,field);
 const hook=renderHook(()=>useCanvasViewInputs(view,recipe));
 const clean=f.measure("10 unchanged hook rerenders",()=>{for(let i=0;i<10;i++){hook.rerender();}});
 expect(clean.fields).toBe(0);
 results.push({subject:"canvas slot inputs",count,clean});
 hook.unmount();f.lifetime.abort();f.models.dispose();
});

it.each([100,1000])("variant controller unrelated inspector publication, %i variants", count=>{
 const f=fixture(),manager=new TplMgr({site:f.site});
 const component=manager.addComponent({name:"Owner",type:ComponentType.Plain});
 const group=manager.createVariantGroup({component,name:"Mode"});
 group.variants=Array.from({length:count},(_,i)=>mkVariant({name:`V${i}`,parent:group}));
 const frame=mkArenaFrame({site:f.site,component,name:"Frame",width:800,height:600});
 const inspectorStore=createStore(()=>({open:false}));Object.assign(f.studio,{inspectorStore,focusedMode:false});
 let evaluations=0;
 const componentFrame={tplComponent:{component},getTargetVariants:()=>[],getPinnedVariants:()=>new Map()};
 const globalFrame={site:f.site,getTargetVariants:()=>[],getPinnedVariants:()=>new Map()};
 const val={tpl:{component},fibers:[{memoizedProps:{}}]};
 const runtimeVariants=createStore(()=>({frames:[{}],global:{}}));
 const view={studioCtx:f.studio,site:f.site,disposeSignal:f.lifetime.signal,modelLifetime:f.lifetime.signal,isDisposed:false,
 variantStore:runtimeVariants,currentComponent:()=>component,arenaFrame:()=>frame,
 currentComponentStackFrame:()=>componentFrame,globalFrame,valState:()=>({maybeValSysRoot:()=>val}),valComponentStack:()=>[val],
 canvasCtx:{Sub:{reactWeb:{hasVariant:()=>{evaluations++;return false;}}}}
 } as unknown as ViewCtx;
 const hook=renderHook(()=>useVariantsController(f.studio,view));const previous=hook.result.current;
 evaluations=0;
 const update=f.measure("unrelated inspector store publication",()=>act(()=>inspectorStore.setState({open:true})));
 expect(hook.result.current).toBe(previous);
 expect(update.fields).toBe(0); expect(evaluations).toBe(0);
 results.push({subject:"variant controller inspector fanout",count,update,evaluations});
 const refresh=f.measure("variant runtime publication",()=>act(()=>runtimeVariants.setState({global:{}})));
 expect(evaluations).toBe(count);
 results.push({subject:"variant controller relevant runtime",count,update:refresh,evaluations});
 hook.unmount();f.lifetime.abort();f.models.dispose();
});

it("shares a thousand-token font directory while switching the current token in closed controls", () => {
 const f=fixture();
 const tokens=Array.from({length:1000},(_,i)=>mkStyleToken({name:`Font${i}`,type:"FontFamily",value:"Arial"}));
 f.site.styleTokens.push(...tokens);
 const recorder=new ChangeRecorder({inst:f.site,_instUtil:instUtil});
 const first=renderHook(({value})=>useFontFamilyTokenInputs(f.studio,undefined,false,value),{initialProps:{value:mkTokenRef(tokens[0])}});
 const second=renderHook(({value})=>useFontFamilyTokenInputs(f.studio,undefined,false,value),{initialProps:{value:mkTokenRef(tokens[1])}});
 try {
  expect(first.result.current.choices.map(choice=>choice.name)).toEqual(["Font0"]);
  expect(second.result.current.choices.map(choice=>choice.name)).toEqual(["Font1"]);
  const update=f.measure("switch current font token while both menus remain closed",()=>first.rerender({value:mkTokenRef(tokens[2])}));
  expect(first.result.current.choices.map(choice=>choice.name)).toEqual(["Font2"]);
  expect(second.result.current.choices.map(choice=>choice.name)).toEqual(["Font1"]);
  expect(update.fields).toBeLessThan(50); expect(update.bindings).toBeLessThan(30);
  results.push({subject:"closed font token selection",count:1000,update});
 } finally {first.unmount();second.unmount();f.lifetime.abort();recorder.dispose();f.models.dispose();}
});
