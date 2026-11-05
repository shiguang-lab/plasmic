import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const data=JSON.parse(fs.readFileSync(path.join(dir,'data.json'),'utf8'));
const key=process.argv[2]||'qwen';
const dtype=process.argv[3]||'q8';
const spec=data.models[key];
const modelPath=path.join(dir,'cache',spec.repo,spec.revision);
const baselineRss=process.memoryUsage().rss;
let sampledPeakRss=baselineRss;
const timer=setInterval(()=>{sampledPeakRss=Math.max(sampledPeakRss,process.memoryUsage().rss)},20);
const importStart=performance.now();
const {pipeline,AutoConfig,AutoModel,AutoTokenizer,env}=await import('@huggingface/transformers');
const runtimeImportMs=performance.now()-importStart;
env.allowRemoteModels=false;
env.allowLocalModels=true;
const options={device:'cpu',dtype,local_files_only:true,
  session_options:{intraOpNumThreads:2,interOpNumThreads:1}};
const loadStart=performance.now();
let extractor;
let dispose;
if(key==='gemma'){
 const config=await AutoConfig.from_pretrained(modelPath,{local_files_only:true});
 config.vision_config=null;config.audio_config=null;
 const model=await AutoModel.from_pretrained(modelPath,{...options,config});
 const tokenizer=await AutoTokenizer.from_pretrained(modelPath,{local_files_only:true});
 extractor=async(text)=>{
  const output=await model(await tokenizer(text,{padding:true,truncation:true,max_length:512}));
  return output.sentence_embedding.normalize(2,-1);
 };
 dispose=()=>model.dispose();
}else{
 extractor=await pipeline('feature-extraction',modelPath,options);
 dispose=()=>extractor.dispose();
}
const localLoadMs=performance.now()-loadStart;
const rssAfterLoad=process.memoryUsage().rss;
const format=(text)=>key==='gemma'?'task: search result | query: '+text:'Instruct: Given a user-facing UI functionality description, retrieve reusable UI component documentation that could support the required behavior.\nQuery: '+text;
const cases=data.cases.filter(c=>c.expected.length).slice(0,10);
const run=(text)=>extractor(format(text),{pooling:'last_token',normalize:true,padding:true,truncation:true,max_length:512});
let start=performance.now();
const first=await run(cases[0].intent);
const firstInferenceMs=performance.now()-start;
await run(cases[1].intent);
const samples=[];
for(let i=0;i<30;i++){
  const item=cases[i%cases.length];
  start=performance.now();
  const value=await run(item.intent);
  samples.push({caseId:item.id,characters:item.intent.length,ms:performance.now()-start,dimensions:value.dims});
}
const rssAfterQueries=process.memoryUsage().rss;
sampledPeakRss=Math.max(sampledPeakRss,rssAfterQueries);
const durations=samples.map(s=>s.ms).sort((a,b)=>a-b);
const percentile=(p)=>durations[Math.ceil(p*durations.length)-1];
const modelPrefix='onnx/model_'+(dtype==='q8'?'quantized':dtype)+'.onnx';
const files=fs.readdirSync(modelPath,{recursive:true}).filter(p=>!p.startsWith('onnx/')||p===modelPrefix||p===modelPrefix+'_data').map(p=>path.join(modelPath,p)).filter(p=>fs.statSync(p).isFile())
  .map(p=>({name:path.relative(modelPath,p),bytes:fs.statSync(p).size}));
const summary={model:spec,dtype,device:'CPU only',threads:{intra:2,inter:1},
  hardware:{platform:process.platform,arch:process.arch,cpu:os.cpus()[0].model,logicalCpus:os.cpus().length,ramBytes:os.totalmem()},
  runtime:{node:process.version,transformers:'4.3.2',onnxruntime:JSON.parse(fs.readFileSync(path.join(dir,'node_modules/onnxruntime-node/package.json'),'utf8')).version},
  execution:'New process, local files only; OS disk cache not cleared; model setup excludes network download.',
  runtimeImportMs,localLoadMs,firstInferenceMs,warmQueries:30,warmP50Ms:percentile(.5),warmP95Ms:percentile(.95),warmMaxMs:durations.at(-1),
  baselineRss,rssAfterLoad,rssAfterQueries,sampledPeakRss,resourceUsageMaxRssKiB:process.resourceUsage().maxRSS,outputDimensions:first.dims,
  modelFiles:files,modelArtifactBytes:files.reduce((s,f)=>s+f.bytes,0),
  limitations:['Embedding-only probe, not end-to-end component search, Electron package, UI responsiveness or MCP scan benchmark.',
    'No active Studio interaction workload was controlled; not evidence of unchanged frame rate.',
    '30 short Chinese queries from ten positive cases; not long documents, indexing or all target platforms.',
    'Memory is whole Node worker RSS including runtime/tokenizer/model, not just tensor bytes.']};
fs.writeFileSync(path.join(dir,key+'-'+dtype+'-resources.json'),JSON.stringify({summary,samples},null,2));
console.log(JSON.stringify(summary));
clearInterval(timer);
await dispose();
