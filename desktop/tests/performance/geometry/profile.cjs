// Source-map CPU attribution and renderer timeline totals, outside timing runs.
const fs=require('node:fs'),path=require('node:path');
const {TraceMap,originalPositionFor}=require('@jridgewell/trace-mapping');
const task=path.resolve(process.argv[2]),build=path.join(task,'build'),maps=new Map();
const short=s=>s.includes('/wab/')?s.slice(s.indexOf('/wab/')+1):s.includes('/geometry/')?'experiment/'+s.split('/geometry/').at(-1):s.includes('node_modules/')?s.slice(s.lastIndexOf('node_modules/')+13):path.basename(s);
function locate(frame){
  if(!frame.url)return {file:'runtime',fn:frame.functionName||'(anonymous)'};
  let file;
  try{file=path.resolve(build,'.'+new URL(frame.url).pathname);}catch{return {file:'runtime',fn:frame.functionName};}
  if(!file.startsWith(build+path.sep))return {file:'runtime',fn:frame.functionName};
  if(!maps.has(file))maps.set(file,fs.existsSync(file+'.map')?new TraceMap(JSON.parse(fs.readFileSync(file+'.map'))):null);
  const map=maps.get(file),p=map&&originalPositionFor(map,{line:frame.lineNumber+1,column:frame.columnNumber});
  return {file:p?.source?short(p.source):short(file),fn:p?.name||frame.functionName||'(anonymous)'};
}
const results=[];
for(const name of fs.readdirSync(task).filter(s=>/^profile-(gp|complex)-\d+-(baseline|cached-js|cached-wasm)\.json$/.test(s))){
  const id=name.slice(0,-5),self=new Map(),inclusive=new Map();let activeUs=0,idleUs=0;
  for(const cpuFile of fs.readdirSync(task).filter(s=>s.startsWith(id+'-cpu-')&&s.endsWith('.json'))){
    const p=JSON.parse(fs.readFileSync(path.join(task,cpuFile))),nodes=new Map(p.nodes.map(n=>[n.id,n])),parents=new Map();
    for(const n of p.nodes)for(const c of n.children||[])parents.set(c,n.id);
    const resolved=new Map(p.nodes.map(n=>[n.id,locate(n.callFrame)]));
    for(let i=0;i<(p.samples||[]).length;i++){
      const node=p.samples[i],duration=p.timeDeltas?.[i]||0,frame=resolved.get(node);
      if(frame.fn==='(idle)'){idleUs+=duration;continue;}
      activeUs+=duration;
      const key=frame.file+':'+frame.fn;self.set(key,(self.get(key)||0)+duration);
      const files=new Set();let n=node;
      while(n!==undefined){files.add(resolved.get(n).file);n=parents.get(n);}
      for(const file of files)inclusive.set(file,(inclusive.get(file)||0)+duration);
    }
  }
  const top=m=>[...m].sort((a,b)=>b[1]-a[1]).slice(0,16).map(([name,us])=>({name,ms:us/1000,activeShare:us/activeUs}));
  const tracePath=path.join(task,id+'.trace.json'),timeline={};
  if(fs.existsSync(tracePath))for(const e of JSON.parse(fs.readFileSync(tracePath)).traceEvents){
    if(e.ph==='X'&&['Layout','UpdateLayoutTree','Paint','MajorGC','MinorGC'].includes(e.name)){
      const t=timeline[e.name]??={count:0,ms:0};t.count++;t.ms+=(e.dur||0)/1000;
    }
  }
  results.push({id,cpuProfileAvailable:activeUs>0,activeMs:activeUs/1000,idleMs:idleUs/1000,topSelf:top(self),inclusiveFiles:top(inclusive),timeline});
}
fs.writeFileSync(path.join(task,'profiles-analysis.json'),JSON.stringify(results,null,2),{mode:0o600});
console.log(JSON.stringify(results.map(x=>({id:x.id,topSelf:x.topSelf.slice(0,5),timeline:x.timeline})),null,2));
