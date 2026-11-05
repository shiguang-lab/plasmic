"""Recompute aggregates and preprocessing parity from archived raw reports."""
import argparse
import json
import math
from pathlib import Path
import statistics

parser=argparse.ArgumentParser()
parser.add_argument('--baseline',type=Path,default=Path(__file__).resolve().parent.parent)
args=parser.parse_args();root=Path(__file__).resolve().parent
read=lambda p:json.loads(p.read_text())
reference=read(root/'onnx-reference.json')
baseline=read(args.baseline/'gemma-q4-results.json')
baseline_ranks={e['id']:e['rank'] for e in baseline['results'] if e['expected']}
output={'aggregation':'Each resource value is median/min/max across three fresh processes, not pooled-query percentiles. RSS bytes; Darwin getrusage maxRSS bytes.',
 'baseline':{'quality':baseline['summary'],'resources':read(args.baseline/'gemma-q4-resources.json')['summary']},'models':{}}
def aggregate(values):return {'median':statistics.median(values),'min':min(values),'max':max(values)}
for name in ['litert','gguf']:
 quality=read(root/(name+'-quality.json'));s=quality['summary']
 resources=[read(root/(name+'-resources-'+str(i)+'.json'))['summary'] for i in [1,2,3]]
 metrics={key:aggregate([r[key] for r in resources]) for key in ['localLoadMs','firstInferenceMs','warmP50Ms','warmP95Ms','indexMs','osMaxRssBytes','sampledPeakRssBytes']}
 if name=='litert':metrics['runtimeImportMs']=aggregate([r['runtimeImportMs'] for r in resources])
 for phase in ['loaded','queried','indexed','finished']:
  metrics[phase+'RssBytes']=aggregate([next(p['rssBytes'] for p in r['memoryStages'] if p['phase']==phase) for r in resources])
 vector_checks=[]
 for key,a in reference['referenceVectors'].items():
  b=quality['referenceVectors'][key]
  cosine=sum(i*j for i,j in zip(a,b))/math.sqrt(sum(i*i for i in a)*sum(i*i for i in b))
  vector_checks.append({'id':key,'cosine':cosine,'maxAbsoluteDifference':max(abs(i-j) for i,j in zip(a,b))})
 parity={'vectorSampleCount':len(vector_checks),'minimumCosine':min(e['cosine'] for e in vector_checks),
  'meanCosine':statistics.mean(e['cosine'] for e in vector_checks),'vectors':vector_checks,
  'interpretation':'Different quantized artifacts and inference kernels; these checks do not establish equal outputs or isolate the cause of ranking changes.'}
 if name=='gguf':
  diff=[k for k,v in reference['tokenIds'].items() if v!=quality['tokenIds'][k]]
  parity.update({'tokenInputCount':len(reference['tokenIds']),'identicalTokenInputCount':len(reference['tokenIds'])-len(diff),'differentTokenInputs':diff})
 else:parity['tokenInputCheck']='Native LiteRT token IDs not exposed by this API; not verified.'
 current={e['id']:e['rank'] for e in quality['results'] if e['expected']}
 hit=lambda rank:rank is not None and rank<=3
 output['models'][name]={'quality':{k:s[k] for k in ['hitAt1','hitAt3','hitAt5','mrr','indexMs','maxBatchDifference']},
  'resources':metrics,'qualityRunOsPeakRssBytes':s['osMaxRssBytes'],
  'maximumObservedOsPeakRssBytes':max([s['osMaxRssBytes']]+[r['osMaxRssBytes'] for r in resources]),'onnxParity':parity,
  'top3LostVsOnnx':[k for k,v in baseline_ranks.items() if hit(v) and not hit(current[k])],
  'top3GainedVsOnnx':[k for k,v in baseline_ranks.items() if not hit(v) and hit(current[k])]}
(root/'summary.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:{'quality':v['quality'],'resources':v['resources'],'maxPeakMiB':v['maximumObservedOsPeakRssBytes']/1048576} for k,v in output['models'].items()},indent=2))
