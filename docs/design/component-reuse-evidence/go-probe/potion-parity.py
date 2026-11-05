"""Independent model2vec reference using the exact local F32 weights and raw text."""
import json
from pathlib import Path
import sys
import importlib.metadata
import numpy as np
from model2vec import StaticModel
from safetensors.numpy import load_file
from tokenizers import Tokenizer

ROOT=Path(__file__).resolve().parent
data=json.loads(Path(sys.argv[1]).read_text())
models=json.loads((ROOT/'potion-models.json').read_text())
report={'runtime':{name:importlib.metadata.version(name) for name in ['model2vec','numpy','safetensors','tokenizers']},'pythonVersion':sys.version,'models':{}}
for key,spec in models.items():
 root=ROOT/'potion-cache'/spec['cacheName']
 model=StaticModel(vectors=load_file(root/'model.safetensors')['embeddings'],tokenizer=Tokenizer.from_file(str(root/'tokenizer.json')),normalize=True)
 go=json.loads((ROOT/f'potion-{key}-quality.json').read_text())
 texts={**{'doc:'+d['id']:d['text'] for d in data['corpus']},**{'query:'+c['id']:c['intent'] for c in data['cases']}}
 tokens=model.tokenize(list(texts.values()),max_length=None)
 ref_ids=dict(zip(texts,tokens))
 diffs=[]
 for id,ids in ref_ids.items():
  other=go['tokenIds'][id]
  if ids!=other:
   pos=next((i for i,(a,b) in enumerate(zip(ids,other)) if a!=b),min(len(ids),len(other)))
   diffs.append({'id':id,'goTokens':len(other),'referenceTokens':len(ids),'firstDifference':pos})
 ref_vectors=model.encode([texts[id] for id in go['referenceVectors']],max_length=None,use_multiprocessing=False,show_progress_bar=False)
 vector_diffs={}
 for (id,vector),ref in zip(go['referenceVectors'].items(),ref_vectors):
  vector_diffs[id]=float(np.max(np.abs(np.asarray(vector,dtype=np.float64)-ref)))
 report['models'][key]={'tokenInputs':len(texts),'identicalTokenInputs':len(texts)-len(diffs),'tokenDifferences':diffs,'sampleVectorCount':len(vector_diffs),'maxSampleVectorDifference':max(vector_diffs.values()),'sampleVectorDifferences':vector_diffs,'referenceVectors':dict(zip(go['referenceVectors'],ref_vectors.tolist())),
  'mode':'max_length=None to match go-potion full-fragment input. Not the 512-token Transformer cap.'}
 print(key,len(diffs),max(vector_diffs.values()),flush=True)
 del model
(ROOT/'potion-python-parity.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
