"""Measure only the native llama-server child; scoring/client run in the observer."""
import argparse
import ctypes
import datetime
import hashlib
import http.client
import json
import os
from pathlib import Path
import platform
import resource
import socket
import subprocess
import threading
import time
from evaluation import evaluate

parser=argparse.ArgumentParser();parser.add_argument('mode',choices=['quality','resources']);parser.add_argument('--data',required=True);parser.add_argument('--repeat',type=int,default=1);parser.add_argument('--timeout',type=float,default=180)
args=parser.parse_args();root=Path(__file__).resolve().parent;tag='gguf-'+args.mode+(('-'+str(args.repeat)) if args.mode=='resources' else '')
spec=json.loads((root/'models.json').read_text())['gguf'];out=root/(tag+'.json')
sock=socket.socket();sock.bind(('127.0.0.1',0));port=sock.getsockname()[1];sock.close()
command=[str(root/'build/bin/llama-server'),'--model',str(root/'models'/spec['file']),
 '--embeddings','--pooling','mean','--embd-normalize','2','--ctx-size','512','--batch-size','512','--ubatch-size','512',
 '--parallel','1','--threads','2','--threads-batch','2','--threads-http','1','--gpu-layers','0','--no-warmup',
 '--host','127.0.0.1','--port',str(port)]
class TaskInfo(ctypes.Structure):_fields_=[('virtual',ctypes.c_uint64),('resident',ctypes.c_uint64),('rest64',ctypes.c_uint64*4),('rest32',ctypes.c_int32*12)]
libproc=ctypes.CDLL('/usr/lib/libproc.dylib');libproc.proc_pidinfo.argtypes=[ctypes.c_int,ctypes.c_int,ctypes.c_uint64,ctypes.c_void_p,ctypes.c_int]
def rss(pid):
 info=TaskInfo();n=libproc.proc_pidinfo(pid,4,0,ctypes.byref(info),ctypes.sizeof(info));return info.resident if n==ctypes.sizeof(info) else 0
peak=[0];stop=threading.Event();stages=[];timed_out=[];report=None
environment=os.environ.copy();environment['VECLIB_MAXIMUM_THREADS']='2'
start=time.perf_counter()
with (root/(tag+'.stderr.log')).open('w') as errors:
 child=subprocess.Popen(command,cwd=root,env=environment,stdout=errors,stderr=errors)
 def expire():timed_out.append(True);child.kill()
 timer=threading.Timer(args.timeout,expire);timer.start()
 def monitor():
  while not stop.wait(.02):peak[0]=max(peak[0],rss(child.pid))
 thread=threading.Thread(target=monitor,daemon=True);thread.start()
 def phase(name):
  value=rss(child.pid);peak[0]=max(peak[0],value);stages.append({'phase':name,'rssBytes':value,'sampledPeakRssBytes':peak[0]})
 try:
  ready=False
  while time.perf_counter()-start<60:
   if child.poll() is not None:raise RuntimeError('llama-server exited: '+str(child.returncode))
   try:
    conn=http.client.HTTPConnection('127.0.0.1',port,timeout=.3);conn.request('GET','/health');response=conn.getresponse();response.read();conn.close()
    if response.status==200:ready=True;break
   except (OSError,http.client.HTTPException):pass
   time.sleep(.02)
  if not ready:raise TimeoutError('Server not ready within 60 seconds')
  load_ms=(time.perf_counter()-start)*1000;phase('loaded')
  conn=http.client.HTTPConnection('127.0.0.1',port,timeout=30)
  def post(endpoint,value):
   conn.request('POST',endpoint,json.dumps(value,ensure_ascii=False).encode(),{'Content-Type':'application/json'})
   response=conn.getresponse();raw=response.read()
   if response.status!=200:raise RuntimeError('HTTP '+str(response.status)+': '+raw.decode()[:1500])
   return json.loads(raw)
  tokens_by_text={}
  def encode(texts):
   tokens=[]
   for text in texts:
    ids=post('/tokenize',{'content':text,'add_special':True})['tokens'];tokens_by_text[text]=ids;tokens.append(ids[:512])
   response=post('/v1/embeddings',{'input':tokens,'encoding_format':'float'})
   return [entry['embedding'] for entry in sorted(response['data'],key=lambda e:e['index'])]
  report=evaluate(encode,args.data,args.mode,phase)
  report['summary'].update({'model':spec,'runtime':'llama.cpp v0.9.0','commit':'cd959bae99ff4bed22bef2604f45241c09bbb8c8','mode':args.mode,'repeat':args.repeat,
   'date':datetime.datetime.now(datetime.timezone.utc).isoformat(),'platform':platform.platform(),'device':'CPU only, Metal disabled at build','threads':2,
   'localLoadMs':load_ms,'loadDefinition':'Spawn through HTTP health ready, including dynamic library/model load; --no-warmup, first inference separate.',
   'timing':'Loopback persistent HTTP: native /tokenize for each text, explicit first-512-token cap, then /v1/embeddings; includes JSON/IPC and normalization. No remote service.',
   'modelSettings':{'context':512,'logicalBatch':512,'physicalBatch':512,'parallelSlots':1,'pooling':'mean','normalization':2,'warmup':False,'accelerateThreads':2},
   'maxUntruncatedInputTokens':max(map(len,tokens_by_text.values())),'uniqueInputsTruncated':sum(len(v)>512 for v in tokens_by_text.values()),
   'serverCommand':command,'binaryBytes':(root/'build/bin/llama-server').stat().st_size,
   'binarySha256':hashlib.sha256((root/'build/bin/llama-server').read_bytes()).hexdigest(),
   'limitations':['Frozen manually labeled pilot, no independent holdout.','Different quantization/tokenizer from ONNX q4; identical token cap does not prove identical encoded inputs.','Native server RSS excludes Python scoring/client observer.','Loopback HTTP timing is not pure inference time or remote service latency.','No actual Studio/Electron or other platform benchmark.']})
  if args.mode=='quality':
   data=json.loads(Path(args.data).read_text())
   from evaluation import query_text,document_text
   report['tokenIds']={**{'doc:'+e['id']:tokens_by_text[document_text(e)][:512] for e in data['corpus']},**{'query:'+e['id']:tokens_by_text[query_text(e['intent'])][:512] for e in data['cases']}}
  phase('finished');conn.close()
 except BaseException as error:
  (root/(tag+'.failure.json')).write_text(json.dumps({'error':str(error),'timedOut':bool(timed_out),'memoryStages':stages,'sampledPeakRssBytes':peak[0]},indent=2)+'\n')
  raise
 finally:
  timer.cancel()
  if child.poll() is None:child.terminate()
  try:child.wait(timeout=10)
  except subprocess.TimeoutExpired:child.kill();child.wait()
  stop.set();thread.join()
if report is not None:
 report['summary'].update({'memoryStages':stages,'sampledPeakRssBytes':peak[0],'osMaxRssBytes':resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss,
  'memoryObserver':'External macOS proc_pidinfo every 20 ms and phase boundaries; only llama-server child. Darwin RUSAGE_CHILDREN maxRSS bytes after exit, one child per observer.'})
 out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'file':out.name,'top3':report['summary'].get('hitAt3'),'p95':report['summary'].get('warmP95Ms'),'rssMiB':{s['phase']:round(s['rssBytes']/1048576,1) for s in stages}}),flush=True)
