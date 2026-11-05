import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const [root,key,output]=process.argv.slice(2);
const req=createRequire(path.join(root,'package.json'));
const {AutoTokenizer,env}=await import(pathToFileURL(req.resolve('@huggingface/transformers')).href);
const ort=await import(pathToFileURL(req.resolve('onnxruntime-node')).href);
env.allowRemoteModels=false;env.allowLocalModels=true;
const data=JSON.parse(fs.readFileSync(path.join(root,'data.json'),'utf8'));
const spec=JSON.parse(fs.readFileSync(path.join(root,'low-memory/models.json'),'utf8'))[key];
const modelPath=path.join(root,'low-memory/cache',spec.repo,spec.revision);
const tokenizer=await AutoTokenizer.from_pretrained(modelPath,{local_files_only:true});
const session=await ort.InferenceSession.create(path.join(modelPath,spec.modelFile),{executionProviders:['cpu'],intraOpNumThreads:2,interOpNumThreads:1});
const format=text=>key==='bge'?'为这个句子生成表示以用于检索相关文章：'+text:text;
const normalize=v=>{const n=Math.sqrt(v.reduce((s,x)=>s+x*x,0));return v.map(x=>x/n)};
const encode=async texts=>{
 const inputs=await tokenizer(texts,{padding:true,truncation:true,max_length:512});
 const feeds=Object.fromEntries(session.inputNames.map(n=>[n,new ort.Tensor(inputs[n].type,inputs[n].data,inputs[n].dims)]));
 const out=await session.run(feeds);const v=out.last_hidden_state;
 return texts.map((_,i)=>normalize(Array.from(v.data.subarray(i*v.dims[1]*v.dims[2],i*v.dims[1]*v.dims[2]+v.dims[2]))));
};
const tokenIds={};
for(const [id,text] of [...data.corpus.map(d=>['doc:'+d.id,d.text]),...data.cases.map(c=>['query:'+c.id,format(c.intent)])]){
 const result=await tokenizer(text,{truncation:true,max_length:512,return_tensor:false});
 tokenIds[id]=result.input_ids;
}
const referenceVectors={};
const docs=await encode(data.corpus.slice(0,4).map(d=>d.text));
data.corpus.slice(0,4).forEach((d,i)=>{referenceVectors['doc:'+d.id]=docs[i]});
for(const c of data.cases.slice(0,10)){[referenceVectors['query:'+c.id]]=await encode([format(c.intent)])}
fs.writeFileSync(output,JSON.stringify({model:spec,tokenIds,referenceVectors},null,2)+'\n');
await session.release();
