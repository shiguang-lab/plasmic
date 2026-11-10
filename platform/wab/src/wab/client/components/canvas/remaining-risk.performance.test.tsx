import { useActionModelInputs } from "@/wab/client/components/sidebar-tabs/StateManagement/action-model-inputs";
import { createLinkedCodePropInputsSource } from "@/wab/client/components/sidebar-tabs/ComponentProps/linked-code-prop-inputs";
import { ExpressionSearchInputs } from "@/wab/client/components/sidebar/LeftExprsSearchPanel";
import { LintDocumentInputs } from "@/wab/client/linting/lint-document-inputs";
import { ColorTokenChoiceInputs } from "@/wab/client/studio-ctx/color-token-choice-inputs";
import { captureVariantModelWorld } from "@/wab/client/components/variants/variant-model-world";
import { lintSite } from "@/wab/shared/linting/lint-utils";
import { lintUnprotectedDataQueries } from "@/wab/shared/linting/lint-unprotected-data-queries";
import * as selectors from "@/wab/shared/cached-selectors";
import { ModelRevisions, modelKeys } from "@/wab/shared/model-revisions";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { ModelCommit, StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import type { ChangeSummary } from "@/wab/shared/model/model-change-util";
import { TplMgr } from "@/wab/shared/TplMgr";
import { VariantedStylesHelper } from "@/wab/shared/VariantedStylesHelper";
import { mkStyleToken, mkTokenRef } from "@/wab/commons/StyleToken";
import { codeLit } from "@/wab/shared/core/exprs";
import { ComponentType } from "@/wab/shared/core/components";
import { mkTplTagX, deepTrackComponents } from "@/wab/shared/core/tpls";
import { mkParam } from "@/wab/shared/core/lang";
import { typeFactory } from "@/wab/shared/model/model-util";
import { ChangeRecorder, type ModelChange } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { siteFinalStyleTokensOfType } from "@/wab/shared/core/site-style-tokens";
import { EventHandler, CustomCode } from "@/wab/shared/model/classes";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { createStore } from "zustand/vanilla";
import { act, renderHook } from "@testing-library/react";
import { writeFileSync } from "fs";
const results: unknown[] = [];
afterAll(() => { if (process.env.RISK_PERF_OUTPUT) {writeFileSync(process.env.RISK_PERF_OUTPUT, JSON.stringify(results, null, 2));} });
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
  let fields = 0, bindings = 0, reads = 0;
  const observed = new WeakSet<object>();
  const declared = models.declaredField.bind(models), prepared = models.subscribePreparedField.bind(models);
  models.declaredField = (model, key) => {
    fields++;
    const store = declared(model, key);
    if (!observed.has(store)) {
      observed.add(store); const getState = store.getState;
      store.getState = () => { reads++; return getState(); };
    }
    return store;
  };
  models.subscribePreparedField = (store, listener) => { bindings++; return prepared(store, listener); };
  const measure = (phase: string, run: () => void) => {
    fields = 0; bindings = 0; reads = 0;
    const start = performance.now(); run();
    return { phase, fields, bindings, reads, ms: performance.now() - start };
  };
  return { site, models, studio, lifetime, commits, measure };
}

function documentFixture(count: number) {
 const f=fixture(),manager=new TplMgr({site:f.site});
 const component=manager.addComponent({name:"Document",type:ComponentType.Plain});
 const base=component.variants[0];
 const nodes=Array.from({length:count},(_,i)=>mkTplTagX("div",{baseVariant:base,styles:{},attrs:{title:new CustomCode({code:`(value${i})`,fallback:null})}}));
 component.tplTree=mkTplTagX("div",{baseVariant:base,styles:{}},nodes);deepTrackComponents(f.site);
 const revisions=new ModelRevisions();
 Object.assign(f.studio,{modelRevisions:revisions,projectFlags:()=>f.site.flags,focusedViewCtx:()=>undefined});
 Object.assign(f.studio.arenaState,{readinessStore:createStore(()=>true)});
 const recorder=new ChangeRecorder({inst:f.site,_instUtil:instUtil});
 const publish=(changes:ModelChange[])=>{
   f.models.sync(changes);revisions.markModelKeysDirty([modelKeys.component(component.uuid)]);revisions.flushModelRevisions();
   const summary={changes,updatedComponents:new Set([component]),deepUpdatedComponents:new Set()} as ChangeSummary;
   f.commits.forEach(listener=>listener({type:"commit",summary}));
 };
 const view={studioCtx:f.studio,site:f.site,modelLifetime:f.lifetime.signal,disposeSignal:f.lifetime.signal,isDisposed:false} as unknown as ViewCtx;
 const dispose=()=>{f.lifetime.abort();recorder.dispose();f.models.dispose();revisions.dispose();};
 return {...f,component,nodes,recorder,publish,view,dispose};
}
it.each([100,1000])("measures action contracts with %i params",count=>{
 const f=documentFixture(1);
 f.recorder.dispose();
 f.component.params=Array.from({length:count},(_,i)=>mkParam({name:`P${i}`,paramType:"prop",type:typeFactory.text()}));
 const recorder=new ChangeRecorder({inst:f.site,_instUtil:instUtil});
 const registrations=new Set<()=>void>();
 const action={displayName:"Run",parameters:[]};
 const contexts=new Map([["Actions",{meta:{name:"Actions",globalActions:{run:action}}}]]);
 Object.assign(f.studio,{getRegisteredContextsMap:()=>contexts,getHostLessContextsMap:()=>new Map(),subscribeCodeRegistrations:(listener:()=>void)=>{registrations.add(listener);return()=>{registrations.delete(listener);};}});
 const handler=new EventHandler({interactions:[]});
 const hook=renderHook(()=>useActionModelInputs(f.view,f.component,handler));
 const before=hook.result.current;
 const clean=f.measure("10 unchanged hook reads",()=>{for(let i=0;i<10;i++){hook.rerender();}});
 expect(hook.result.current).toBe(before);
 const changes=recorder.withRecording(()=>f.component.params.forEach(param=>{param.variable.name+="X";})).changes;
 const batch=f.measure("batch parameter contract rename",()=>act(()=>f.models.sync(changes)));
 expect(hook.result.current).not.toBe(before);
 expect(clean.fields).toBe(0); expect(batch.fields).toBeLessThan(count*30);
 results.push({subject:"action model contracts",count,clean,batch});
 const beforeRegistry=hook.result.current;
 act(()=>{action.displayName="Updated run";registrations.forEach(listener=>listener());});
 expect(hook.result.current).not.toBe(beforeRegistry);
 hook.unmount();expect(registrations.size).toBe(0);recorder.dispose();f.dispose();
});
it.each([100,1000])("measures linked-prop discovery with %i nodes",count=>{
 const f=documentFixture(count);
 const world={...captureVariantModelWorld(f.studio),alive:true};
 const source=createLinkedCodePropInputsSource(world,f.studio,f.view,f.component);
 let visits=0,notices=0;
 const flatten=selectors.flattenComponent;
 const spy=vi.spyOn(selectors,"flattenComponent").mockImplementation(component=>{const nodes=flatten(component);visits+=nodes.length;return nodes;});
 const stop=source.subscribe(()=>{notices++;});source.read();visits=0;notices=0;
 const clean=f.measure("10 unchanged snapshot reads",()=>{for(let i=0;i<10;i++){source.read();}});const cleanVisits=visits;visits=0;
 const changes=f.recorder.withRecording(()=>{f.nodes[0].vsettings[0].rs.values.color="red";}).changes;
 const update=f.measure("unrelated style commit to the same component",()=>f.publish(changes));
 expect(source.read()).toEqual([]);expect(notices).toBe(0);
 expect(cleanVisits).toBe(0);
 results.push({subject:"linked prop discovery",count,clean,cleanVisits,update,updateVisits:visits});
 stop();spy.mockRestore();f.dispose();
});
it.each([100,1000])("measures expression search on unrelated commits with %i expressions",count=>{
 const f=documentFixture(count), source=new ExpressionSearchInputs(f.studio);
 let reads=0,notices=0;const original=selectors.cachedExprsInSite;
 const spy=vi.spyOn(selectors,"cachedExprsInSite").mockImplementation(site=>{reads++;return original(site);});
 const stop=source.subscribe(()=>{notices++;});const before=source.getSnapshot();expect(before.items).toHaveLength(count);reads=0;notices=0;
 const changes=f.recorder.withRecording(()=>{f.nodes[0].vsettings[0].rs.values.color="red";}).changes;
 const update=f.measure("unrelated style commit with search open",()=>f.publish(changes));
 expect(source.getSnapshot()).toBe(before);expect(notices).toBe(0);
 expect(reads).toBe(0);
 results.push({subject:"expression search",count,update,wholeDocumentCollections:reads});
 f.publish(f.recorder.withRecording(()=>{(f.nodes[0].vsettings[0].attrs.title as CustomCode).code="(changedValue)";}).changes);
 expect(reads).toBe(1); expect(notices).toBe(1);
 expect(source.getSnapshot().items.some(item=>item.displayText==="changedValue")).toBe(true);
 stop();reads=0;
 f.publish(f.recorder.withRecording(()=>{f.nodes[0].vsettings[0].rs.values.color="blue";}).changes);
 expect(reads).toBe(0);spy.mockRestore();f.dispose();
});
it.each([100,1000])("measures full lint on canvas layout updates with %i nodes",count=>{
 const f=documentFixture(count),source=new LintDocumentInputs(f.studio);
 let runs=0;
 const stop=source.subscribe(()=>{runs++;lintSite(f.site,f.studio);lintUnprotectedDataQueries(f.site,[]);});runs=0;
 const frame=f.site.componentArenas[0].matrix.rows[0].cols[0].frame;
 const changes=f.recorder.withRecording(()=>{frame.left=(frame.left??0)+1;}).changes;
 const update=f.measure("unrelated artboard position commit with issues open",()=>f.publish(changes));
 expect(source.getSnapshot()).toBeGreaterThan(0);
 expect(runs).toBe(0);
 results.push({subject:"lint issues panel",count,update,fullLintRuns:runs});
 f.publish(f.recorder.withRecording(()=>{f.nodes[0].vsettings[0].dataCond=codeLit(false);}).changes);
 expect(runs).toBe(1); expect(lintSite(f.site,f.studio).some(issue=>issue.type==="invisible-element"&&issue.tpl===f.nodes[0])).toBe(true);
 stop();runs=0;f.publish(changes);expect(runs).toBe(0);f.dispose();
});
it.each([100,1000])("measures color alias palette with %i tokens",count=>{
 const f=fixture();
 const terminal=mkStyleToken({name:"Terminal",type:"Color",value:"#ff0000"});
 f.site.styleTokens.push(...Array.from({length:count-1},(_,i)=>mkStyleToken({name:`Alias${i}`,type:"Color",value:mkTokenRef(terminal)})),terminal);
 const recorder=new ChangeRecorder({inst:f.site,_instUtil:instUtil});
 const tokens=siteFinalStyleTokensOfType(f.site,"Color",{includeDeps:"direct"});
 const source=new ColorTokenChoiceInputs(f.studio,tokens,new VariantedStylesHelper());let stop=()=>{};
 const mount=f.measure("read and connect alias palette",()=>{source.getSnapshot();stop=source.subscribe(()=>source.getSnapshot());});
 expect(source.getSnapshot().choices.every(choice=>choice.resolved.value==="#ff0000")).toBe(true);
 const update=f.measure("update the shared terminal color",()=>f.models.sync(recorder.withRecording(()=>{terminal.value="#0000ff";}).changes));
 expect(source.getSnapshot().choices.every(choice=>choice.resolved.value==="#0000ff")).toBe(true);
 expect(update.reads).toBeLessThan(count*20);
 results.push({subject:"color alias palette",count,mount,update});
 stop();f.lifetime.abort();recorder.dispose();f.models.dispose();
});
