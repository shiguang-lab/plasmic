"""Validate raw measurements, derived summaries and evidence file hashes."""
import hashlib
import json
import math
from pathlib import Path
import statistics

root=Path(__file__).resolve().parent;parent=root.parent
read=lambda p:json.loads(p.read_text())
raw=(parent/'data.json').read_bytes()
assert hashlib.sha256(raw).hexdigest()=='b7191a546a488cc1b8ac0dec708e342938b3d6a494db557dcb636d1a2dafcdd4'
data=json.loads(raw);assert len(data['corpus'])==101 and len(data['cases'])==41
summary=read(root/'summary.json');ref=read(root/'onnx-reference.json')
assert len(ref['tokenIds'])==142 and len(ref['referenceVectors'])==14
for name in ['litert','gguf']:
 quality=read(root/(name+'-quality.json'));s=quality['summary'];rows=quality['results']
 assert s['corpusSha256']==hashlib.sha256(raw).hexdigest()
 assert [(e['id'],e['intent'],e['expected']) for e in rows]==[(e['id'],e['intent'],e['expected']) for e in data['cases']]
 positive=[e for e in rows if e['expected']];assert len(positive)==37
 for limit in [1,3,5]:assert s['hitAt'+str(limit)]==sum(e['rank'] is not None and e['rank']<=limit for e in positive)
 assert math.isclose(s['mrr'],sum(1/e['rank'] for e in positive if e['rank'])/37,abs_tol=1e-12)
 for e in rows:
  assert len(e['top5'])==5 and len({r['id'] for r in e['top5']})==5
  assert all(a['score']>=b['score'] for a,b in zip(e['top5'],e['top5'][1:]))
  rank=next((i+1 for i,r in enumerate(e['top5']) if r['id'] in e['expected']),None)
  if e['rank'] is not None and e['rank']<=5:assert rank==e['rank']
  else:assert rank is None
 for v in quality['referenceVectors'].values():assert len(v)==768 and math.isclose(sum(x*x for x in v),1,abs_tol=1e-6)
 reports=[]
 for repeat in [1,2,3]:
  report=read(root/(name+'-resources-'+str(repeat)+'.json'));r=report['summary'];reports.append(r)
  assert r['corpusSha256']==s['corpusSha256'] and r['repeat']==repeat
  times=sorted(e['ms'] for e in report['samples']);assert len(times)==30 and min(times)>0
  assert times[14]==r['warmP50Ms'] and times[28]==r['warmP95Ms'] and times[-1]==r['warmMaxMs']
  assert r['sampledPeakRssBytes']>=max(p['rssBytes'] for p in r['memoryStages'])
  assert r['osMaxRssBytes']>=max(p['rssBytes'] for p in r['memoryStages'][:-1])
 metrics=summary['models'][name]['resources']
 for key,stats in metrics.items():
  if key.endswith('RssBytes') and key not in ['osMaxRssBytes','sampledPeakRssBytes']:
   phase=key[:-len('RssBytes')];values=[next(p['rssBytes'] for p in r['memoryStages'] if p['phase']==phase) for r in reports]
  else:values=[r[key] for r in reports]
  assert stats=={'median':statistics.median(values),'min':min(values),'max':max(values)}
 assert summary['models'][name]['maximumObservedOsPeakRssBytes']==max([s['osMaxRssBytes']]+[r['osMaxRssBytes'] for r in reports])
 parity=summary['models'][name]['onnxParity'];cosines=[]
 for key,a in ref['referenceVectors'].items():
  b=quality['referenceVectors'][key];cosines.append(sum(x*y for x,y in zip(a,b))/math.sqrt(sum(x*x for x in a)*sum(y*y for y in b)))
 assert min(cosines)==parity['minimumCosine'] and statistics.mean(cosines)==parity['meanCosine']
 if name=='gguf':assert quality['tokenIds']==ref['tokenIds'] and parity['identicalTokenInputCount']==142
index=read(parent/'evidence-index.json')
listed=set(index['files']);actual={p.relative_to(parent).as_posix() for p in parent.rglob('*') if p.is_file() and p.name!='evidence-index.json' and '__pycache__' not in p.parts}
assert actual==listed,(actual-listed,listed-actual)
for name,sha in index['files'].items():assert hashlib.sha256((parent/name).read_bytes()).hexdigest()==sha,name
print('PASS: frozen inputs, 2 quality runs, 6 resource runs, ranks, P50/P95, RSS aggregates, token/vector parity and '+str(len(listed))+' evidence hashes')
