import argparse
import ctypes
import hashlib
import json
import os
from pathlib import Path
import subprocess
import threading

parser=argparse.ArgumentParser();parser.add_argument('mode',choices=['quality','resources']);parser.add_argument('--data',required=True);parser.add_argument('--repeat',type=int,default=1);parser.add_argument('--timeout',type=float,default=180)
args=parser.parse_args();root=Path(__file__).resolve().parent;tag='litert-'+args.mode+(('-'+str(args.repeat)) if args.mode=='resources' else '')
out=root/(tag+'.json');stages=[];peak=[0];stop=threading.Event();timed_out=[]
class TaskInfo(ctypes.Structure):_fields_=[('virtual',ctypes.c_uint64),('resident',ctypes.c_uint64),('rest64',ctypes.c_uint64*4),('rest32',ctypes.c_int32*12)]
libproc=ctypes.CDLL('/usr/lib/libproc.dylib');libproc.proc_pidinfo.argtypes=[ctypes.c_int,ctypes.c_int,ctypes.c_uint64,ctypes.c_void_p,ctypes.c_int]
def rss(pid):
 info=TaskInfo();n=libproc.proc_pidinfo(pid,4,0,ctypes.byref(info),ctypes.sizeof(info));return info.resident if n==ctypes.sizeof(info) else 0
with (root/(tag+'.stderr.log')).open('w') as errors:
 child=subprocess.Popen([str(root/'pyenv/bin/python'),str(root/'litert-worker.py'),'--data',args.data,'--mode',args.mode,'--output',str(out),'--repeat',str(args.repeat)],cwd=root,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=errors,text=True,bufsize=1)
 def expire():timed_out.append(True);child.kill()
 timer=threading.Timer(args.timeout,expire);timer.start()
 def monitor():
  while not stop.wait(.02):peak[0]=max(peak[0],rss(child.pid))
 thread=threading.Thread(target=monitor,daemon=True);thread.start();other=[]
 try:
  for line in child.stdout:
   try:event=json.loads(line)
   except json.JSONDecodeError:other.append(line);continue
   if event.get('event')=='phase':
    event['rssBytes']=rss(child.pid);peak[0]=max(peak[0],event['rssBytes']);event['sampledPeakRssBytes']=peak[0];stages.append(event);child.stdin.write('\n');child.stdin.flush()
  code=child.wait()
 finally:timer.cancel();stop.set();thread.join();child.stdin.close();child.stdout.close()
 (root/(tag+'.stdout.log')).write_text(''.join(other))
 if code:
  (root/(tag+'.failure.json')).write_text(json.dumps({'status':code,'timedOut':bool(timed_out),'memoryStages':stages,'sampledPeakRssBytes':peak[0]},indent=2)+'\n')
  print((root/(tag+'.stderr.log')).read_text()[-9000:]);raise SystemExit(code)
report=json.loads(out.read_text());report['summary'].update({'memoryStages':stages,'sampledPeakRssBytes':peak[0],'osMaxRssBytes':max(s['osMaxRssBytes'] for s in stages),'memoryObserver':'External proc_pidinfo(PROC_PIDTASKINFO), child RSS only, sampled every 20 ms and at blocked phase checkpoints. Darwin maxRSS bytes.'})
out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'file':out.name,'top3':report['summary'].get('hitAt3'),'p95':report['summary'].get('warmP95Ms'),'rssMiB':{s['phase']:round(s['rssBytes']/1048576,1) for s in stages}}),flush=True)
