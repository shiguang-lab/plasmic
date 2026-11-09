// Focused lifecycle fixture: real source functions, React and Monaco.
// Business code generation is deterministic; this is not a full Studio bundle.
const fs = require("node:fs"), path = require("node:path");
const esbuild = require("esbuild");
const repo = path.resolve(__dirname, "../../.."), wab = path.join(repo, "platform/wab");
const source = process.argv[2], out = path.resolve(process.argv[3]);
fs.mkdirSync(out, { recursive: true });
const actual = source === "current";
const sourceFile = (name, relative) => actual ? path.join(wab, "src/wab", relative) : path.join(source, name);
const canvas = fs.readFileSync(sourceFile("canvas-rendering.ts", "client/components/canvas/canvas-rendering.ts"), "utf8");
const envStart = canvas.indexOf("export function computeFullKey(ctx:");
const envEnd = canvas.indexOf("function wrapInDataCtxReader(", envStart);
if (envStart < 0 || envEnd < 0) { throw Error("Canvas environment source boundaries changed"); }
const env = canvas.slice(envStart, envEnd).replace(/^export /gm, "");
const workerBuild = esbuild.buildSync({
 entryPoints: {
  editor: require.resolve("monaco-editor/editor/editor.worker", { paths: [wab] }),
  ts: require.resolve("monaco-editor/language/typescript/ts.worker", { paths: [wab] }),
 },
 bundle: true, format: "iife", minify: true, write: false, outdir: out,
});
const workerSources = Object.fromEntries(workerBuild.outputFiles.map(file => [path.basename(file.path, ".js"), file.text]));
const mocks = {
  "serialize-docs-preview": 'export const serializeDependentModules = ctx=>({modules:ctx.modules}); export const serializeToggledComponent=()=>"export default 1"; export const serializeToggledIcon=serializeToggledComponent; export const makePlumeDepsImports=()=>"";',
  "monaco-worker-url": `const sources=${JSON.stringify(workerSources)};const urls={};export function configureMonacoWorkers(){window.MonacoEnvironment={getWorker(_id,label){const name=label==="typescript"||label==="javascript"?"ts":"editor";urls[name]??=URL.createObjectURL(new Blob([sources[name]],{type:"text/javascript"}));return new Worker(urls[name]);}};}`,
  "DocsModelResources": 'export const useDocsFocusedComponentRef=ctx=>ctx.componentRef;export const useDocsFocusedIconRef=()=>undefined;',
  "preview-codegen": 'export const subscribePreviewCodegen=()=>()=>{};',
  "ui-theme": 'export const useUiAppearance=()=>({appearance:"light"});',
  "common": 'export const ensure=(x)=>{if(x==null)throw Error("missing");return x}; export const mkUuid=()=>crypto.randomUUID();export const tryCatchElse=({try:run,catch:onError})=>{try{return run()}catch(error){return onError(error)}};',
  "image-assets": 'export const makeAssetClassName=()=>"Icon"; export const makeIconAssetFileNameWithoutExt=()=>"Icon";',
  "serialize-utils": 'export const getExportedComponentName=()=>"Example"; export const makePlasmicComponentName=()=>"Example";',
  "components": 'export const isCodeComponent=()=>false; export const isPlumeComponent=()=>false;',
};
const entry = `
import React from 'react'; import {createRoot} from 'react-dom/client'; import {flushSync} from 'react-dom';
import * as monaco from 'monaco-editor';
import {DocsPortalEditor} from 'fixture:docs'; import {DeepMap} from 'fixture:deep';
const getRepetitionUuidInternalName=uuid=>'__plasmic_uuid_to_idx_'+uuid;
const ensure=x=>{if(x==null)throw Error("missing");return x};
const globalHookCtx={frames:new Map([1,2].map(uid=>[uid,{envIdToFullKey:new Map()}])),envIdToEnvs:new Map(),fullKeyToEnvId:new Map()};
${env}
class RetainedCanvasArgument { constructor(){this.data=Array.from({length:10000},(_,i)=>i);} }
const deep=new DeepMap(); const roots=new Map(); const environments=new Map(); let serial=0;
function unmount(id){const root=roots.get(id);if(root){flushSync(()=>root.unmount());roots.delete(id);}}

window.__retention={
 open(){serial++; for(const frame of [1,2]){for(let i=0;i<50;i++)getEnvId({valKey:'node'+i,env:{value:i},wrappingEnv:{},viewCtx:{arenaFrame:()=>({uid:frame}),canvasRenderOwner:{retainEnvironment:(_ctx,id,value)=>environments.set(id,value)}}});}
 const arg=new RetainedCanvasArgument();const entry=deep.entry([arg]);entry.set('live');
 for(const id of ['a','b']){const component={uuid:id+'-'+serial};let code;
 const docsCtx={componentRef:component,models:{snapshots:{resolve:ref=>ref}},subscribePreviewInputs:()=>()=>{},tryGetFocusedComponent:()=>component,tryGetFocusedIcon:()=>undefined,
 studioCtx:{site:{},modules:Array.from({length:3},(_,i)=>({name:'Dep'+serial+'_'+i+'.tsx',lang:'tsx',source:'export default '+JSON.stringify('source-'+serial+'-'+i+'x'.repeat(10000))}))},
 getComponentCustomCode:()=>code,setComponentCustomCode:(_,v)=>{code=v},getComponentToggles:()=>({}),isUsingLoader:()=>false};
 let root=roots.get(id);if(!root){root=createRoot(document.getElementById(id));roots.set(id,root);}flushSync(()=>root.render(React.createElement(DocsPortalEditor,{docsCtx})));}
 },
 close(){for(const id of ['a','b'])unmount(id);environments.clear();for(const frame of globalHookCtx.frames.values())frame.envIdToFullKey.clear();globalHookCtx.envIdToEnvs.clear();globalHookCtx.fullKeyToEnvId.clear();if(deep.last?.exists())deep.last.delete();},
 async closeOneAndEdit(){unmount('a');await new Promise(r=>setTimeout(r,20));const model=monaco.editor.getModels().find(m=>m.uri.toString().includes('/script_b-'));if(!model)throw Error('Active editor model missing');const before=model.getValue();model.pushStackElement();model.pushEditOperations([],[{range:model.getFullModelRange(),text:before+'\\n// typed'}],()=>null);model.pushStackElement();await model.undo();if(model.getValue()!==before)throw Error('Undo changed');return {models:monaco.editor.getModels().length,extraLibs:Object.keys(monaco.typescript.typescriptDefaults.getExtraLibs()).length,undo:true}},
 stats(){return {envIds:globalHookCtx.envIdToEnvs.size,fullKeys:globalHookCtx.fullKeyToEnvId.size,models:monaco.editor.getModels().map(m=>({uri:m.uri.toString(),chars:m.getValueLength()})),deepStoreSize:deep.store.size,deletedArgumentCount:deep.last?.args?.length??0}},
};
`;
esbuild.build({stdin:{contents:entry,resolveDir:wab,loader:"tsx"},bundle:true,platform:"browser",format:"iife",outdir:out,entryNames:"fixture",loader:{".ttf":"file"},define:{"process.env.NODE_ENV":'"production"'},plugins:[{name:"fixture",setup(build){
 build.onResolve({filter:/^fixture:/},args=>({path:args.path,namespace:"fixture"}));
 build.onLoad({filter:/.*/,namespace:"fixture"},args=>({contents:fs.readFileSync(args.path.endsWith('docs')?sourceFile('DocsPortalEditor.tsx','client/components/docs/DocsPortalEditor.tsx'):sourceFile('deep-map.ts','commons/deep-map.ts'),'utf8'),loader:"tsx",resolveDir:wab}));
 build.onResolve({filter:/^!raw-loader!/},()=>({path:"raw",namespace:"mock"}));
 build.onResolve({filter:/^@\//},args=>{const key=args.path.split('/').at(-1);if(!(key in mocks))throw Error('Unmocked business import '+args.path);return {path:key,namespace:"mock"}});
 build.onLoad({filter:/.*/,namespace:"mock"},args=>({contents:args.path==='raw'?'export default ""':mocks[args.path],loader:"js"}));
}}]}).then(()=>fs.writeFileSync(path.join(out,"index.html"),'<!doctype html><link rel="stylesheet" href="fixture.css"><div id="a" style="height:200px"></div><div id="b" style="height:200px"></div><script src="fixture.js"></script>')).catch(e=>{console.error(e);process.exitCode=1});
