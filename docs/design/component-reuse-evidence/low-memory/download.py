"""Download only pinned probe assets; verify every size and available LFS SHA-256."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parent
SPECS = {
    'bekko128': {'repo':'hotchpotch/bekko-static-embedding-v1', 'revision':'c18167b8f244c1bc6de21ce9b710bac8a29c4615', 'modelFile':'onnx/model_int8_dim128.onnx', 'kind':'static', 'dimensions':128},
    'bekko256': {'repo':'hotchpotch/bekko-static-embedding-v1', 'revision':'c18167b8f244c1bc6de21ce9b710bac8a29c4615', 'modelFile':'onnx/model_int8_dim256.onnx', 'kind':'static', 'dimensions':256},
    'bge': {'repo':'Xenova/bge-small-zh-v1.5', 'revision':'75c43b069aac4d136ba6bc1122f995fedcfd2781', 'modelFile':'onnx/model_quantized.onnx', 'kind':'cls', 'dimensions':512},
    'granite': {'repo':'onnx-community/granite-embedding-97m-multilingual-r2-ONNX', 'revision':'536a9f241cb3f02a9c5995a1e708c784bd274859', 'modelFile':'onnx/model_quantized.onnx', 'kind':'cls', 'dimensions':384},
}

def fetch(spec, entry):
    filename=entry['rfilename']
    dest=ROOT/'cache'/spec['repo']/spec['revision']/filename
    dest.parent.mkdir(parents=True,exist_ok=True)
    expected=entry.get('lfs',{}).get('sha256')
    if dest.exists() and dest.stat().st_size==entry['size']:
        if not expected or hashlib.sha256(dest.read_bytes()).hexdigest()==expected:
            return
    url='https://huggingface.co/'+spec['repo']+'/resolve/'+spec['revision']+'/'+filename
    last=None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url,timeout=60) as source, dest.open('wb') as out:
                while block:=source.read(1024*1024):out.write(block)
            assert dest.stat().st_size==entry['size'],filename
            if expected:assert hashlib.sha256(dest.read_bytes()).hexdigest()==expected,filename
            print(json.dumps({'downloaded':filename,'bytes':entry['size'],'repo':spec['repo']}),flush=True)
            return
        except Exception as error:last=error
    raise last

for spec in SPECS.values():
    with urllib.request.urlopen('https://huggingface.co/api/models/'+spec['repo']+'/revision/'+spec['revision']+'?blobs=true',timeout=30) as f:info=json.load(f)
    assert info['sha']==spec['revision']
    names=[spec['modelFile'],'tokenizer.json']
    if spec['kind']!='static':names+=['config.json','tokenizer_config.json','special_tokens_map.json']
    entries=[next(e for e in info['siblings'] if e['rfilename']==n) for n in names]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(lambda e:fetch(spec,e),entries))
    spec['files']=[{'name':e['rfilename'],'bytes':e['size'],'sha256':hashlib.sha256((ROOT/'cache'/spec['repo']/spec['revision']/e['rfilename']).read_bytes()).hexdigest()} for e in entries]
    (ROOT/'models.json').write_text(json.dumps(SPECS,indent=2)+'\n')
print('All pinned model assets verified.',flush=True)
