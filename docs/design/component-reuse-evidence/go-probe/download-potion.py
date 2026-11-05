import concurrent.futures
import hashlib
import json
from pathlib import Path
import urllib.request

ROOT=Path(__file__).resolve().parent
MODELS={
 'potion8':{'repo':'minishlab/potion-base-8M','revision':'bf8b056651a2c21b8d2565580b8569da283cab23','cacheName':'BASE8M'},
 'potionMulti':{'repo':'minishlab/potion-multilingual-128M','revision':'73908c3438cf03b6a01bcb9611d62b23d0726f08','cacheName':'MULTILINGUAL128M'},
}
def sha(file):
 h=hashlib.sha256()
 with file.open('rb') as f:
  while b:=f.read(1048576):h.update(b)
 return h.hexdigest()
def get(spec,e):
 name=e['rfilename'];size=e['size'];out=ROOT/'potion-cache'/spec['cacheName']/name
 out.parent.mkdir(parents=True,exist_ok=True)
 expected=e.get('lfs',{}).get('sha256')
 if out.exists() and out.stat().st_size==size and (not expected or sha(out)==expected):return
 url='https://huggingface.co/'+spec['repo']+'/resolve/'+spec['revision']+'/'+name
 step=16*1024*1024
 parts=ROOT/'download-parts'/spec['cacheName']/name
 parts.mkdir(parents=True,exist_ok=True)
 def fetch(i):
  start=i*step;end=min(size-1,start+step-1);dest=parts/str(i)
  if dest.exists() and dest.stat().st_size==end-start+1:return
  err=None
  for attempt in range(3):
   try:
    req=urllib.request.Request(url+'?download=true&part='+str(i),headers={'Range':f'bytes={start}-{end}'})
    with urllib.request.urlopen(req,timeout=60) as f,dest.open('wb') as g:
     assert f.status==206 and f.headers['Content-Range']==f'bytes {start}-{end}/{size}'
     while b:=f.read(1048576):g.write(b)
    assert dest.stat().st_size==end-start+1
    return
   except Exception as ex:err=ex
  raise err
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  futures=[pool.submit(fetch,i) for i in range((size+step-1)//step)]
  for i,f in enumerate(concurrent.futures.as_completed(futures),1):
   f.result();print(json.dumps({'repo':spec['repo'],'file':name,'partsDone':i,'partsTotal':len(futures)}),flush=True)
 with out.open('wb') as target:
  for i in range((size+step-1)//step):
   with (parts/str(i)).open('rb') as source:
    while b:=source.read(1048576):target.write(b)
 assert out.stat().st_size==size
 if expected:assert sha(out)==expected
 for p in parts.iterdir():p.unlink()
 parts.rmdir()
 print(json.dumps({'verified':name,'bytes':size,'repo':spec['repo']}),flush=True)
for spec in MODELS.values():
 with urllib.request.urlopen('https://huggingface.co/api/models/'+spec['repo']+'/revision/'+spec['revision']+'?blobs=true',timeout=30) as f:info=json.load(f)
 assert info['sha']==spec['revision']
 entries=[next(e for e in info['siblings'] if e['rfilename']==name) for name in ['tokenizer.json','model.safetensors']]
 for e in entries:get(spec,e)
 spec['files']=[{'name':e['rfilename'],'bytes':e['size'],'sha256':sha(ROOT/'potion-cache'/spec['cacheName']/e['rfilename'])} for e in entries]
 (ROOT/'potion-models.json').write_text(json.dumps(MODELS,indent=2)+'\n')
print('All pinned Potion assets ready.',flush=True)
