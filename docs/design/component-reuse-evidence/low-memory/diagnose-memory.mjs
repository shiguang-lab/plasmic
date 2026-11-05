import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const key=process.argv[2];
const variant=process.argv[3]||'default';
if(!['default','no-arena','no-opt'].includes(variant))throw new Error('Invalid variant');
const spec=JSON.parse(fs.readFileSync(path.join(dir,'models.json'),'utf8'))[key];
const data=JSON.parse(fs.readFileSync(path.join(dir,'../data.json'),'utf8'));
const root=path.join(dir,'cache',spec.repo,spec.revision);
const stages=[];
const record=stage=>{
  const value={stage,...process.memoryUsage(),osMaxRssKiB:process.resourceUsage().maxRSS};
  stages.push(value);console.log(JSON.stringify({key,variant,...value}));
};
const collect=async()=>{
  global.gc();await new Promise(resolve=>setImmediate(resolve));
  global.gc();await new Promise(resolve=>setImmediate(resolve));
};
record('baseline');
const [{AutoTokenizer,PreTrainedTokenizer,env},ort]=await Promise.all([import('@huggingface/transformers'),import('onnxruntime-node')]);
env.allowRemoteModels=false;env.allowLocalModels=true;
record('runtime-imported');
let tokenizer;
if(spec.kind==='static'){
 tokenizer=new PreTrainedTokenizer(JSON.parse(fs.readFileSync(path.join(root,'tokenizer.json'),'utf8')),
 {pad_token:'[PAD]',unk_token:'[UNK]',model_max_length:512});
}else tokenizer=await AutoTokenizer.from_pretrained(root,{local_files_only:true});
record('tokenizer-loaded');
const options={executionProviders:['cpu'],intraOpNumThreads:2,interOpNumThreads:1};
if(variant==='no-arena'){options.enableCpuMemArena=false;options.enableMemPattern=false;}
if(variant==='no-opt')options.graphOptimizationLevel='disabled';
let session=await ort.InferenceSession.create(path.join(root,spec.modelFile),options);
record('model-loaded');
async function run(texts){
 const input=await tokenizer(texts,{padding:true,truncation:true,max_length:512,add_special_tokens:spec.kind!=='static'});
 const feeds=Object.fromEntries(session.inputNames.map(name=>[name,new ort.Tensor(input[name].type,input[name].data,input[name].dims)]));
 const output=await session.run(feeds);
 const tensor=spec.kind==='static'?output.sentence_embedding:output.last_hidden_state;
 const stride=spec.kind==='static'?spec.dimensions:tensor.dims[1]*spec.dimensions;
 return texts.map((_,i)=>Array.from(tensor.data.subarray(i*stride,i*stride+spec.dimensions)));
}
const cases=data.cases.filter(c=>c.expected.length).slice(0,10);
for(let i=0;i<32;i++)await run([(key==='bge'?'为这个句子生成表示以用于检索相关文章：':'')+cases[i%10].intent]);
record('short-queries-finished');
const vectors=[];
for(let i=0;i<data.corpus.length;i+=4)vectors.push(...await run(data.corpus.slice(i,i+4).map(c=>c.text)));
record('index-finished');
await collect();record('after-index-forced-gc');
await session.release();session=null;
await collect();record('after-session-release-and-gc');
tokenizer=null;await collect();record('after-tokenizer-release-and-gc');
fs.writeFileSync(path.join(dir,key+'-memory-stages-'+variant+'.json'),JSON.stringify({
 model:spec,variant,options,runtime:{node:process.version,transformers:'4.3.2',onnxruntime:'1.30.0'},
 note:'Single diagnostic process, no GC until after indexing. RSS stage deltas are not exact ownership attribution. Forced GC and release are diagnostic, not product lifecycle measurements.',
 stages,
},null,2)+'\n');
