"""Observe a compiled Go child, excluding the Python observer's own memory."""
import argparse
import ctypes
import hashlib
import json
import os
from pathlib import Path
import subprocess
import threading
import time

ROOT=Path(__file__).resolve().parent
parser=argparse.ArgumentParser()
parser.add_argument('library',choices=['hugot','hugot-go','potion'])
parser.add_argument('model')
parser.add_argument('mode',choices=['quality','resources'])
parser.add_argument('--repeat',type=int,default=1)
parser.add_argument('--node-root',type=Path,required=True)
parser.add_argument('--timeout',type=float,default=180)
args=parser.parse_args()
node=args.node_root.resolve()
tag=f'{args.library}-{args.model}-{args.mode}'+(f'-{args.repeat}' if args.mode=='resources' else '')
out=ROOT/(tag+'.json')
binary=ROOT/('hugot-go-probe' if args.library=='hugot-go' else args.library+'-probe')
cmd=[str(binary),'-model',args.model,'-mode',args.mode,'-data',str(node/'data.json'),'-output',str(out),'-repeat',str(args.repeat),'-handshake']
environment=os.environ.copy()
if args.library.startswith('hugot'):
 if args.model=='gemma':
  spec=json.loads((node/'data.json').read_text())['models']['gemma'];model_path=node/'cache'/spec['repo']/spec['revision']
 else:
  spec=json.loads((node/'low-memory/models.json').read_text())[args.model];model_path=node/'low-memory/cache'/spec['repo']/spec['revision']
 cmd+=['-model-path',str(model_path),'-ort-library',str(ROOT/'ort-lib'),'-backend','go' if args.library=='hugot-go' else 'ort']
else:
 spec=json.loads((ROOT/'potion-models.json').read_text())[args.model]
 for name in ['model.safetensors','tokenizer.json']:assert (ROOT/'potion-cache'/spec['cacheName']/name).exists()
 environment['GO_POTION_HOME']=str(ROOT/'potion-cache')

class TaskInfo(ctypes.Structure):
 _fields_=[('virtual',ctypes.c_uint64),('resident',ctypes.c_uint64),('rest64',ctypes.c_uint64*4),('rest32',ctypes.c_int32*12)]
libproc=ctypes.CDLL('/usr/lib/libproc.dylib',use_errno=True)
libproc.proc_pidinfo.argtypes=[ctypes.c_int,ctypes.c_int,ctypes.c_uint64,ctypes.c_void_p,ctypes.c_int]
libproc.proc_pidinfo.restype=ctypes.c_int
def rss(pid):
 info=TaskInfo();count=libproc.proc_pidinfo(pid,4,0,ctypes.byref(info),ctypes.sizeof(info))
 return info.resident if count==ctypes.sizeof(info) else 0
stages=[];peaks=[0];stop=threading.Event();other_output=[]
with (ROOT/(tag+'.stderr.log')).open('w') as errors:
 child=subprocess.Popen(cmd,cwd=ROOT,env=environment,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=errors,text=True,bufsize=1)
 timed_out=[]
 def expire():
  timed_out.append(True);child.kill()
 watchdog=threading.Timer(args.timeout,expire);watchdog.start()
 def monitor():
  while not stop.wait(.02):peaks[0]=max(peaks[0],rss(child.pid))
 thread=threading.Thread(target=monitor,daemon=True);thread.start()
 try:
  for line in child.stdout:
   try:event=json.loads(line)
   except json.JSONDecodeError:
    other_output.append(line);continue
   if event['event']=='phase':
    event['rssBytes']=rss(child.pid);peaks[0]=max(peaks[0],event['rssBytes']);event['sampledPeakRssBytes']=peaks[0]
    stages.append(event);child.stdin.write('\n');child.stdin.flush()
  status=child.wait()
 finally:watchdog.cancel();stop.set();thread.join();child.stdin.close();child.stdout.close()
 (ROOT/(tag+'.stdout.log')).write_text(''.join(other_output))
 if status:
  (ROOT/(tag+'.failure.json')).write_text(json.dumps({'library':args.library,'model':args.model,'mode':args.mode,'status':status,'timedOut':bool(timed_out),'timeoutSeconds':args.timeout,'memoryStages':stages,'sampledPeakRssBytes':peaks[0]},indent=2)+'\n')
  print((ROOT/(tag+'.stderr.log')).read_text()[-10000:]);raise SystemExit(status)
report=json.loads(out.read_text());report['summary']['model']=spec
report['summary']['memoryObserver']='macOS proc_pidinfo(PROC_PIDTASKINFO), external parent; child RSS only; sample every 20ms and at blocked phase checkpoints. Darwin getrusage maxRSS is bytes.'
report['summary']['binarySha256']=hashlib.sha256(binary.read_bytes()).hexdigest()
report['summary']['binaryBytes']=binary.stat().st_size
report['summary']['memoryStages']=stages
report['summary']['sampledPeakRssBytes']=peaks[0]
report['summary']['osMaxRssBytes']=max(s['osMaxRssBytes'] for s in stages)
out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'file':out.name,'hitAt3':report['summary'].get('hitAt3'),'p95':report['summary'].get('warmP95Ms'),'rssMiB':{s['phase']:round(s['rssBytes']/1048576,1) for s in stages}},ensure_ascii=False),flush=True)
