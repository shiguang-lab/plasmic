import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';

const dir=path.dirname(fileURLToPath(import.meta.url));
const dataPath=path.join(dir,'../data.json');
const data=JSON.parse(fs.readFileSync(dataPath,'utf8'));
const models=JSON.parse(fs.readFileSync(path.join(dir,'models.json'),'utf8'));
const [key,mode='quality',repeat='1']=process.argv.slice(2);
const spec=models[key];
if(!spec || !['quality','resources'].includes(mode))throw new Error('Use <bekko128|bekko256|bge|granite> <quality|resources> [repeat]');
const baselineRss=process.memoryUsage().rss;
let sampledPeakRss=baselineRss;
const sample=()=>{sampledPeakRss=Math.max(sampledPeakRss,process.memoryUsage().rss);};
const timer=setInterval(sample,20);
const t0=performance.now();
const [{AutoTokenizer,PreTrainedTokenizer,env},ort]=await Promise.all([import('@huggingface/transformers'),import('onnxruntime-node')]);
const runtimeImportMs=performance.now()-t0;
env.allowRemoteModels=false;
env.allowLocalModels=true;
const root=path.join(dir,'cache',spec.repo,spec.revision);
const loadStart=performance.now();
let tokenizer;
if(spec.kind==='static'){
  // The author's backend explicitly excludes CLS/SEP; do not use BERT defaults.
  tokenizer=new PreTrainedTokenizer(JSON.parse(fs.readFileSync(path.join(root,'tokenizer.json'),'utf8')),
    {pad_token:'[PAD]',unk_token:'[UNK]',model_max_length:512});
}else{
  tokenizer=await AutoTokenizer.from_pretrained(root,{local_files_only:true});
}
const session=await ort.InferenceSession.create(path.join(root,spec.modelFile),{
  executionProviders:['cpu'],intraOpNumThreads:2,interOpNumThreads:1,
});
const localLoadMs=performance.now()-loadStart;
sample();
const rssAfterLoad=process.memoryUsage().rss;
const normalize=v=>{
  const norm=Math.sqrt(v.reduce((s,n)=>s+n*n,0));
  if(!Number.isFinite(norm)||norm===0)throw new Error('Non-finite or zero embedding');
  return v.map(n=>n/norm);
};
const queryText=text=>key==='bge'?'为这个句子生成表示以用于检索相关文章：'+text:text;
const encode=async texts=>{
  const inputs=await tokenizer(texts,{padding:true,truncation:true,max_length:512,
    add_special_tokens:spec.kind!=='static'});
  const feeds={};
  for(const name of session.inputNames){
    const input=inputs[name];
    if(!input)throw new Error('Missing ONNX input '+name);
    feeds[name]=new ort.Tensor(input.type,input.data,input.dims);
  }
  const output=await session.run(feeds);
  const tensor=spec.kind==='static'?output.sentence_embedding:output.last_hidden_state;
  if(!tensor)throw new Error('Unexpected outputs '+Object.keys(output));
  const dims=tensor.dims;
  if(dims.at(-1)!==spec.dimensions || dims[0]!==texts.length)throw new Error('Invalid shape '+dims);
  if(spec.kind==='static'?dims.length!==2:dims.length!==3)throw new Error('Invalid rank '+dims);
  const stride=spec.kind==='static'?spec.dimensions:dims[1]*spec.dimensions;
  return texts.map((_,i)=>normalize(Array.from(tensor.data.subarray(i*stride,i*stride+spec.dimensions))));
};
const common={model:spec,mode,repeat:Number(repeat),date:new Date().toISOString(),
  corpusSha256:crypto.createHash('sha256').update(fs.readFileSync(dataPath)).digest('hex'),
  runtime:{node:process.version,transformers:'4.3.2',onnxruntime:JSON.parse(fs.readFileSync(path.join(dir,'../node_modules/onnxruntime-node/package.json'),'utf8')).version},
  hardware:{platform:process.platform,arch:process.arch,cpu:os.cpus()[0].model,logicalCpus:os.cpus().length,ramBytes:os.totalmem()},
  settings:{device:'cpu',intraOpNumThreads:2,interOpNumThreads:1,maxTokens:512,documentBatchSize:4,
    pooling:spec.kind==='static'?'mean of tokens, model-provided sentence_embedding, no special tokens':'CLS',normalize:'L2',
    queryPrefix:key==='bge'?'为这个句子生成表示以用于检索相关文章：':'',documentPrefix:''},
  execution:'New Node process, local pinned files only, OS disk cache not cleared; no network in timing.',
};
let result;
if(mode==='quality'){
  const corpus=[];
  const indexStart=performance.now();
  for(let i=0;i<data.corpus.length;i+=4){
    corpus.push(...await encode(data.corpus.slice(i,i+4).map(e=>e.text)));
    if(i%20===0)console.error(JSON.stringify({key,documents:Math.min(i+4,data.corpus.length)}));
  }
  const indexMs=performance.now()-indexStart;
  const results=[];
  for(const item of data.cases){
    const [vector]=await encode([queryText(item.intent)]);
    const ranking=corpus.map((v,i)=>({id:data.corpus[i].id,score:v.reduce((s,n,j)=>s+n*vector[j],0)})).sort((a,b)=>b.score-a.score);
    const index=ranking.findIndex(e=>item.expected.includes(e.id));
    results.push({...item,rank:index<0?null:index+1,top5:ranking.slice(0,5)});
  }
  // Check padding/pooling and finite vectors independently from ranking labels.
  const texts=[data.cases[0].intent,data.corpus[0].text];
  const batch=await encode(texts);
  let maxBatchDifference=0;
  for(let i=0;i<texts.length;i++){
    const [single]=await encode([texts[i]]);
    maxBatchDifference=Math.max(maxBatchDifference,...single.map((n,j)=>Math.abs(n-batch[i][j])));
  }
  if(maxBatchDifference>0.03)throw new Error('Batch/single embedding discrepancy '+maxBatchDifference);
  const positive=results.filter(e=>e.expected.length);
  result={summary:{...common,documentCount:data.corpus.length,positiveCases:positive.length,
    negativeOrOutOfScopeCases:results.length-positive.length,indexMs,
    hitAt1:positive.filter(e=>e.rank===1).length,hitAt3:positive.filter(e=>e.rank!==null&&e.rank<=3).length,
    hitAt5:positive.filter(e=>e.rank!==null&&e.rank<=5).length,
    mrr:positive.reduce((s,e)=>s+(e.rank?1/e.rank:0),0)/positive.length,
    sanity:{allVectorsFinite:true,maxBatchDifference},
    limitations:['Same manually authored pilot cases; no independent labeling or holdout.',
      'Truncated repository documentation, not live installed component contracts.',
      'Negative cases have rankings only: no threshold, false-positive rate or abstention quality measured.',
      'No BM25, hybrid retrieval, reranker or Agent behavior test.']},results};
}else{
  const cases=data.cases.filter(e=>e.expected.length).slice(0,10);
  const run=text=>encode([queryText(text)]);
  let start=performance.now();
  await run(cases[0].intent);
  const firstInferenceMs=performance.now()-start;
  await run(cases[1].intent);
  const samples=[];
  for(let i=0;i<30;i++){
    const item=cases[i%cases.length];start=performance.now();
    await run(item.intent);
    samples.push({caseId:item.id,characters:item.intent.length,ms:performance.now()-start});
    sample();
  }
  const rssAfterQueries=process.memoryUsage().rss;
  const querySampledPeakRss=sampledPeakRss;
  const queryOsMaxRssKiB=process.resourceUsage().maxRSS;
  const indexStart=performance.now();
  const vectors=[];
  for(let i=0;i<data.corpus.length;i+=4){vectors.push(...await encode(data.corpus.slice(i,i+4).map(e=>e.text)));sample();}
  const indexMs=performance.now()-indexStart;
  const rssAfterIndex=process.memoryUsage().rss;
  sample();
  const durations=samples.map(s=>s.ms).sort((a,b)=>a-b);
  result={summary:{...common,runtimeImportMs,localLoadMs,firstInferenceMs,warmQueries:30,
    warmP50Ms:durations[Math.ceil(.5*durations.length)-1],warmP95Ms:durations[Math.ceil(.95*durations.length)-1],warmMaxMs:durations.at(-1),
    baselineRss,rssAfterLoad,rssAfterQueries,querySampledPeakRss,queryOsMaxRssKiB,
    indexMs,indexDocuments:data.corpus.length,rssAfterIndex,sampledPeakRss,resourceUsageMaxRssKiB:process.resourceUsage().maxRSS,
    modelArtifactBytes:spec.files.reduce((s,f)=>s+f.bytes,0),
    limitations:['Whole Node process RSS, including runtime, tokenizer and model; not pure weights.',
      'Isolated CPU embedding and indexing probe, not real Studio/MCP/Electron workload.',
      '30 short queries and one 101-document batch-4 index build per fresh process.',
      'Prior Gemma probe did not measure indexing peak, so compare query RSS separately.']},samples};
}
const filename=key+'-'+mode+(mode==='resources'?'-'+repeat:'')+'.json';
fs.writeFileSync(path.join(dir,filename),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result.summary));
clearInterval(timer);
await session.release();
