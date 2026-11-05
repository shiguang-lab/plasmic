"""Download only the pinned text-only models, validating LFS SHA-256."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import urllib.request

ROOT=Path(__file__).resolve().parent
SPECS={
 'litert':{'repo':'litert-community/embeddinggemma-2-text-270m-litert-lm','revision':'9be6e8b90982095dc05c2bd162e4b954ee4dbac7','file':'embeddinggemma-2-text-270m.litertlm','quantization':'INT4 per-channel QAT, text backbone and token embeddings','dimensions':768},
 'gguf':{'repo':'unsloth/embeddinggemma-2-GGUF','revision':'031f0d4b35536f69ab3509d4893c923264fcf253','file':'embeddinggemma-2-UD-Q4_K_XL.gguf','quantization':'UD-Q4_K_XL','dimensions':768},
}
def digest(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  while b:=f.read(1048576):h.update(b)
 return h.hexdigest()
for key,spec in SPECS.items():
 with urllib.request.urlopen('https://huggingface.co/api/models/'+spec['repo']+'/revision/'+spec['revision']+'?blobs=true',timeout=30) as r:info=json.load(r)
 assert info['sha']==spec['revision']
 entry=next(e for e in info['siblings'] if e['rfilename']==spec['file'])
 size=entry['size'];sha=entry['lfs']['sha256'];out=ROOT/'models'/spec['file'];out.parent.mkdir(exist_ok=True)
 if not (out.exists() and out.stat().st_size==size and digest(out)==sha):
  step=16*1024*1024;parts=ROOT/'parts'/key;parts.mkdir(parents=True,exist_ok=True)
  def fetch(i):
   start=i*step;end=min(size-1,start+step-1);part=parts/str(i)
   if part.exists() and part.stat().st_size==end-start+1:return
   err=None
   for attempt in range(3):
    try:
     url='https://huggingface.co/'+spec['repo']+'/resolve/'+spec['revision']+'/'+spec['file']+'?download=true&part='+str(i)
     req=urllib.request.Request(url,headers={'Range':f'bytes={start}-{end}'})
     with urllib.request.urlopen(req,timeout=60) as r,part.open('wb') as w:
      assert r.status==206 and r.headers['Content-Range']==f'bytes {start}-{end}/{size}'
      while b:=r.read(1048576):w.write(b)
     assert part.stat().st_size==end-start+1
     return
    except Exception as e:err=e
   raise err
  with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
   futures=[pool.submit(fetch,i) for i in range((size+step-1)//step)]
   for n,f in enumerate(concurrent.futures.as_completed(futures),1):
    f.result();print(json.dumps({'model':key,'partsDone':n,'partsTotal':len(futures)}),flush=True)
  with out.open('wb') as w:
   for i in range(len(futures)):
    with (parts/str(i)).open('rb') as r:
     while b:=r.read(1048576):w.write(b)
  assert out.stat().st_size==size and digest(out)==sha
  for p in parts.iterdir():p.unlink()
  parts.rmdir()
 spec.update({'bytes':size,'sha256':sha})
 print(json.dumps({'verified':key,'bytes':size,'sha256':sha}),flush=True)
 (ROOT/'models.json').write_text(json.dumps(SPECS,indent=2)+'\n')
