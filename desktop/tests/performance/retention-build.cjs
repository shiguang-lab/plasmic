// Focused lifecycle fixture: real source functions, MobX, React and Monaco.
// Business code generation is deterministic; this is not a full Studio bundle.
const fs = require("node:fs"), path = require("node:path");
const esbuild = require("esbuild");
const repo = path.resolve(__dirname, "../../.."), wab = path.join(repo, "platform/wab");
const source = process.argv[2], out = path.resolve(process.argv[3]);
fs.mkdirSync(out, { recursive: true });
const actual = source === "current";
const sourceFile = (name, relative) => actual ? path.join(wab, "src/wab", relative) : path.join(source, name);
const canvas = fs.readFileSync(sourceFile("canvas-rendering.ts", "client/components/canvas/canvas-rendering.ts"), "utf8");
const env = canvas.slice(canvas.indexOf("function computeFullKey(ctx:"), canvas.indexOf("// A wrapper for providing extra props"));
const mocks = {
  "serialize-docs-preview": 'export const serializeDependentModules = ctx=>({modules:ctx.modules}); export const serializeToggledComponent=()=>"export default 1"; export const serializeToggledIcon=serializeToggledComponent; export const makePlumeDepsImports=()=>"";',
  "monaco-worker-url": 'export const fixWorkerUrl=()=>{};',
  "ui-theme": 'export const useUiAppearance=()=>({appearance:"light"});',
  "common": 'export const ensure=(x)=>{if(x==null)throw Error("missing");return x}; export const mkUuid=()=>crypto.randomUUID();',
  "image-assets": 'export const makeAssetClassName=()=>"Icon"; export const makeIconAssetFileNameWithoutExt=()=>"Icon";',
  "serialize-utils": 'export const getExportedComponentName=()=>"Example"; export const makePlasmicComponentName=()=>"Example";',
  "components": 'export const isCodeComponent=()=>false; export const isPlumeComponent=()=>false;',
};
const entry = `
import React from 'react'; import ReactDOM from 'react-dom';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import 'monaco-editor/esm/vs/language/typescript/monaco.contribution';
import {observable,autorun,onBecomeUnobserved} from 'mobx';
import {DocsPortalEditor} from 'fixture:docs'; import {DeepMap} from 'fixture:deep';
const getRepetitionUuidInternalName=uuid=>'__plasmic_uuid_to_idx_'+uuid;
const ensure=x=>{if(x==null)throw Error("missing");return x};
const globalHookCtx={frames:new Map([1,2].map(uid=>[uid,{envIdToFullKey:new Map()}])),envIdToEnvs:new Map(),fullKeyToEnvId:new Map()};
${env}
class RetainedCanvasArgument { constructor(){this.data=Array.from({length:10000},(_,i)=>i);} }
const deep=new DeepMap(); let stops=[],serial=0;
const fixtureErrors=[];import {onReactionError} from 'mobx';onReactionError(e=>fixtureErrors.push(e.message));
window.__retention={
 open(){serial++; for(const frame of [1,2])stops.push(autorun(()=>{for(let i=0;i<50;i++)getEnvId({valKey:'node'+i,env:{value:i},wrappingEnv:{},viewCtx:{arenaFrame:()=>({uid:frame})}});}));
 const arg=new RetainedCanvasArgument();const entry=deep.entry([arg]);entry.set('live');
 for(const id of ['a','b']){const component={uuid:id+'-'+serial};let code;
 const docsCtx={tryGetFocusedComponent:()=>component,tryGetFocusedIcon:()=>undefined,
 modules:Array.from({length:3},(_,i)=>({name:'Dep'+serial+'_'+i+'.tsx',lang:'tsx',source:'export default '+JSON.stringify('source-'+serial+'-'+i+'x'.repeat(10000))})),
 getComponentCustomCode:()=>code,setComponentCustomCode:(_,v)=>{code=v},getComponentToggles:()=>({}),useLoader:()=>false,studioCtx:{site:{}}};
 ReactDOM.render(React.createElement(DocsPortalEditor,{docsCtx}),document.getElementById(id));}
 },
 close(){stops.forEach(f=>f());stops=[];for(const id of ['a','b'])ReactDOM.unmountComponentAtNode(document.getElementById(id));if(deep.last?.exists())deep.last.delete();},
 async closeOneAndEdit(){ReactDOM.unmountComponentAtNode(document.getElementById('a'));await new Promise(r=>setTimeout(r,20));const model=monaco.editor.getModels().find(m=>m.uri.toString().includes('/script_b-'));if(!model)throw Error('Active editor model missing');const before=model.getValue();model.pushStackElement();model.pushEditOperations([],[{range:model.getFullModelRange(),text:before+'\\n// typed'}],()=>null);model.pushStackElement();await model.undo();if(model.getValue()!==before)throw Error('Undo changed');return {models:monaco.editor.getModels().length,extraLibs:Object.keys(monaco.languages.typescript.typescriptDefaults.getExtraLibs()).length,undo:true}},
 stats(){if(fixtureErrors.length)throw Error(fixtureErrors.join(';'));return {envIds:globalHookCtx.envIdToEnvs.size,fullKeys:globalHookCtx.fullKeyToEnvId.size,models:monaco.editor.getModels().map(m=>({uri:m.uri.toString(),chars:m.getValueLength()})),deepStoreSize:deep.store.size,deletedArgumentCount:deep.last?.args?.length??0}},
};
`;
esbuild.build({stdin:{contents:entry,resolveDir:wab,loader:"tsx"},bundle:true,platform:"browser",format:"iife",outdir:out,entryNames:"fixture",loader:{".ttf":"file"},define:{"process.env.NODE_ENV":'"production"'},plugins:[{name:"fixture",setup(build){
 build.onResolve({filter:/^fixture:/},args=>({path:args.path,namespace:"fixture"}));
 build.onLoad({filter:/.*/,namespace:"fixture"},args=>({contents:fs.readFileSync(args.path.endsWith('docs')?sourceFile('DocsPortalEditor.tsx','client/components/docs/DocsPortalEditor.tsx'):sourceFile('deep-map.ts','commons/deep-map.ts'),'utf8'),loader:"tsx",resolveDir:wab}));
 build.onResolve({filter:/^!raw-loader!/},()=>({path:"raw",namespace:"mock"}));
 build.onResolve({filter:/^@\//},args=>{const key=args.path.split('/').at(-1);if(!(key in mocks))throw Error('Unmocked business import '+args.path);return {path:key,namespace:"mock"}});
 build.onLoad({filter:/.*/,namespace:"mock"},args=>({contents:args.path==='raw'?'export default ""':mocks[args.path],loader:"js"}));
}}]}).then(()=>fs.writeFileSync(path.join(out,"index.html"),'<!doctype html><link rel="stylesheet" href="fixture.css"><div id="a" style="height:200px"></div><div id="b" style="height:200px"></div><script src="fixture.js"></script>')).catch(e=>{console.error(e);process.exitCode=1});
