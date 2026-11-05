"""Frozen retrieval and short-query probe shared by native runtime experiments."""
import hashlib
import json
import math
from pathlib import Path
import time

def query_text(text):return 'task: search result | query: '+text
def document_text(entry):return 'title: '+entry['name']+' | text: '+entry['text']
def normalized(vector):
 values=[float(v) for v in vector]
 assert len(values)==768 and all(math.isfinite(v) for v in values),'Invalid embedding shape or values'
 norm=math.sqrt(sum(v*v for v in values));assert norm>0,'Zero vector'
 return [v/norm for v in values]

def evaluate(encode,data_path,mode,phase):
 raw=Path(data_path).read_bytes();data=json.loads(raw)
 summary={'corpusSha256':hashlib.sha256(raw).hexdigest(),'documentCount':len(data['corpus']),
  'queryPrefix':'task: search result | query: ','documentFormat':'title: {name} | text: {text}',
  'documentBatchSize':4,'maxInputTokens':512,'outputDimensions':768,'normalization':'L2'}
 def vectors(texts):
  values=encode(texts);assert len(values)==len(texts),'Unexpected batch shape'
  return [normalized(v) for v in values]
 def index():
  output=[]
  for i in range(0,len(data['corpus']),4):output.extend(vectors([document_text(e) for e in data['corpus'][i:i+4]]))
  return output
 if mode=='quality':
  start=time.perf_counter();corpus=index();summary['indexMs']=(time.perf_counter()-start)*1000;phase('indexed')
  results=[];reference={};positive=[]
  for i,item in enumerate(data['cases']):
   v=vectors([query_text(item['intent'])])[0]
   ranking=sorted([{'id':d['id'],'score':sum(a*b for a,b in zip(v,c))} for c,d in zip(corpus,data['corpus'])],key=lambda x:-x['score'])
   rank=next((j+1 for j,e in enumerate(ranking) if e['id'] in item['expected']),None)
   entry={**item,'rank':rank,'top5':ranking[:5]};results.append(entry)
   if item['expected']:positive.append(entry)
   if i<10:reference['query:'+item['id']]=v
  for i,d in enumerate(data['corpus'][:4]):reference['doc:'+d['id']]=corpus[i]
  pair=[query_text(data['cases'][0]['intent']),document_text(data['corpus'][0])];batch=vectors(pair);max_diff=0
  for i,text in enumerate(pair):max_diff=max(max_diff,max(abs(a-b) for a,b in zip(batch[i],vectors([text])[0])))
  summary.update({'positiveCases':len(positive),'negativeOrOutOfScopeCases':len(results)-len(positive),
   'hitAt1':sum(e['rank']==1 for e in positive),'hitAt3':sum(e['rank'] is not None and e['rank']<=3 for e in positive),
   'hitAt5':sum(e['rank'] is not None and e['rank']<=5 for e in positive),
   'mrr':sum(1/e['rank'] for e in positive if e['rank'])/len(positive),'maxBatchDifference':max_diff})
  return {'summary':summary,'results':results,'referenceVectors':reference}
 cases=[c for c in data['cases'] if c['expected']][:10]
 start=time.perf_counter();vectors([query_text(cases[0]['intent'])]);summary['firstInferenceMs']=(time.perf_counter()-start)*1000
 vectors([query_text(cases[1]['intent'])]);samples=[]
 for i in range(30):
  item=cases[i%len(cases)];start=time.perf_counter();vectors([query_text(item['intent'])]);elapsed=(time.perf_counter()-start)*1000
  samples.append({'caseId':item['id'],'characters':len(item['intent']),'ms':elapsed})
 phase('queried');times=sorted(s['ms'] for s in samples)
 summary.update({'warmP50Ms':times[14],'warmP95Ms':times[28],'warmMaxMs':times[-1]})
 start=time.perf_counter();corpus=index();summary.update({'indexMs':(time.perf_counter()-start)*1000,'indexDocuments':len(corpus)})
 phase('indexed')
 return {'summary':summary,'samples':samples}
