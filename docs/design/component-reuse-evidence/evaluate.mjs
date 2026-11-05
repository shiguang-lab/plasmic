import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline, AutoConfig, AutoModel, AutoTokenizer, env } from '@huggingface/transformers';

const dir = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(dir, 'data.json'), 'utf8'));
const key = process.argv[2];
const dtype = process.argv[3] || 'q8';
const tag = key + (dtype === 'q8' ? '' : '-' + dtype);
const spec = data.models[key];
if (!spec) throw new Error('Expected e5, qwen or gemma');
env.cacheDir = path.join(dir, 'cache');
env.allowLocalModels = false;
const options = { revision: spec.revision, device: 'cpu', dtype, session_options: { intraOpNumThreads: 2, interOpNumThreads: 1 },
  progress_callback: (info) => { if (info.status === 'initiate' || info.status === 'done') console.error(JSON.stringify({model:key,status:info.status,file:info.file})); } };
let encode;
let dispose;
if (key === 'gemma') {
  const config = await AutoConfig.from_pretrained(spec.repo, {revision:spec.revision});
  config.vision_config = null;
  config.audio_config = null;
  const model = await AutoModel.from_pretrained(spec.repo, {...options, config});
  const tokenizer = await AutoTokenizer.from_pretrained(spec.repo, {revision:spec.revision});
  encode = async (texts) => {
    const inputs = await tokenizer(texts, {padding:true,truncation:true,max_length:512});
    const output = await model(inputs);
    if (!output.sentence_embedding) throw new Error('Missing sentence_embedding');
    return output.sentence_embedding.tolist();
  };
  dispose = () => model.dispose();
} else {
  const extractor = await pipeline('feature-extraction', spec.repo, options);
  encode = async (texts) => (await extractor(texts, {pooling:key==='qwen'?'last_token':'mean',normalize:true,padding:true,truncation:true,max_length:512})).tolist();
  dispose = () => extractor.dispose();
}
const queryText = (text) => key === 'e5' ? 'query: ' + text : key === 'qwen'
  ? 'Instruct: Given a user-facing UI functionality description, retrieve reusable UI component documentation that could support the required behavior.\nQuery: ' + text
  : 'task: search result | query: ' + text;
const passageText = (entry) => key === 'e5' ? 'passage: ' + entry.text : key === 'gemma'
  ? 'title: ' + entry.name + ' | text: ' + entry.text : entry.text;
const normalize = (v) => { const scale = Math.sqrt(v.reduce((s,n)=>s+n*n,0)); if (!Number.isFinite(scale) || !scale) throw new Error('Invalid embedding norm'); return v.map(n=>n/scale); };
const corpusEmbeddings = [];
for (let i=0;i<data.corpus.length;i+=4) {
  corpusEmbeddings.push(...(await encode(data.corpus.slice(i,i+4).map(passageText))).map(normalize));
  if(i%20===0) console.error(JSON.stringify({model:key,documents:Math.min(i+4,data.corpus.length)}));
}
const results = [];
for (const item of data.cases) {
  const [raw] = await encode([queryText(item.intent)]);
  const vector = normalize(raw);
  const ranking = corpusEmbeddings.map((other,i)=>({id:data.corpus[i].id,score:other.reduce((s,n,j)=>s+n*vector[j],0)})).sort((a,b)=>b.score-a.score);
  const index = ranking.findIndex(entry=>item.expected.includes(entry.id));
  results.push({...item,rank:index<0?null:index+1,top5:ranking.slice(0,5)});
}
const positives = results.filter(item=>item.expected.length);
const summary = {model:spec, runtime:'@huggingface/transformers 4.3.2, CPU, '+dtype+', two intra-op threads, 512-token input cap',
  source:'Library-document candidate set with context-only documents excluded; see data.json for actual count and pinned hashes',
  documentCount:data.corpus.length,positiveCases:positives.length,negativeOrOutOfScopeCases:results.length-positives.length,
  hitAt1:positives.filter(v=>v.rank===1).length,hitAt3:positives.filter(v=>v.rank!==null&&v.rank<=3).length,
  hitAt5:positives.filter(v=>v.rank!==null&&v.rank<=5).length,mrr:positives.reduce((s,v)=>s+(v.rank?1/v.rank:0),0)/positives.length,
  warnings:['Manually authored labels and truncated component documentation; not independently reviewed, not current project contracts.',
            'Negative rankings are descriptive only; no abstention threshold was calibrated.',
            'No resource or latency benchmark was performed.']};
fs.writeFileSync(path.join(dir,tag+'-results.json'),JSON.stringify({summary,results},null,2));
console.log(JSON.stringify(summary));
await dispose();
