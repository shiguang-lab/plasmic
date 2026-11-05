import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const [root,out]=process.argv.slice(2);
const req=createRequire(path.join(root,'package.json'));
const {AutoConfig,AutoModel,AutoTokenizer,env}=await import(pathToFileURL(req.resolve('@huggingface/transformers')).href);
env.allowRemoteModels=false;env.allowLocalModels=true;
const data=JSON.parse(fs.readFileSync(path.join(root,'data.json'),'utf8'));const spec=data.models.gemma;
const modelRoot=path.join(root,'cache',spec.repo,spec.revision);
const tokenizer=await AutoTokenizer.from_pretrained(modelRoot,{local_files_only:true});
const config=await AutoConfig.from_pretrained(modelRoot,{local_files_only:true});config.vision_config=null;config.audio_config=null;
const model=await AutoModel.from_pretrained(modelRoot,{local_files_only:true,device:'cpu',dtype:'q4',config,session_options:{intraOpNumThreads:2,interOpNumThreads:1}});
const q=text=>'task: search result | query: '+text;
const d=entry=>'title: '+entry.name+' | text: '+entry.text;
const tokens={};let maxTokens=0;let over512=0;
for(const [id,text] of [...data.corpus.map(e=>['doc:'+e.id,d(e)]),...data.cases.map(e=>['query:'+e.id,q(e.intent)])]){
 const raw=await tokenizer(text,{return_tensor:false,truncation:false});maxTokens=Math.max(maxTokens,raw.input_ids.length);if(raw.input_ids.length>512)over512++;
 tokens[id]=(await tokenizer(text,{return_tensor:false,truncation:true,max_length:512})).input_ids;
}
const encode=async texts=>(await model(await tokenizer(texts,{padding:true,truncation:true,max_length:512}))).sentence_embedding.normalize(2,-1).tolist();
const referenceVectors={};
const docs=await encode(data.corpus.slice(0,4).map(d));data.corpus.slice(0,4).forEach((e,i)=>{referenceVectors['doc:'+e.id]=docs[i]});
for(const item of data.cases.slice(0,10)){[referenceVectors['query:'+item.id]]=await encode([q(item.intent)])}
fs.writeFileSync(out,JSON.stringify({model:spec,dtype:'q4',tokenIds:tokens,referenceVectors,maxUntruncatedInputTokens:maxTokens,uniqueInputsTruncated:over512},null,2)+'\n');
await model.dispose();
