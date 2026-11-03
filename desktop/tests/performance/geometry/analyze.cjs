const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const task=path.resolve(process.argv[2]);
const stats=values=>{
  const a=values.filter(Number.isFinite).sort((a,b)=>a-b);if(!a.length)return null;
  return {n:a.length,min:a[0],median:a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2,p95:a[Math.ceil(a.length*.95)-1],max:a.at(-1)};
};
const runs=[];
for(const name of fs.readdirSync(task)){
  if(!/^(timing|profile|memory|functional|drag)-(gp|complex)-.+\.json$/.test(name)||/excluded|contention/.test(name))continue;
  const d=JSON.parse(fs.readFileSync(path.join(task,name)));if(!d.variant||d.error||d.errors?.length)continue;
  const q=d.queries?.samples||[],input=d.inputs||[];
  const row={file:name,phase:d.phase,dataset:name.split('-')[1],variant:d.variant,buildHash:d.build.rendererHash,setup:d.setup,wasm:d.wasm,
    query:stats(q.map(x=>x.totalMs)),feedback:stats(input.map(x=>x.feedbackMs)),nativeQuery:stats(input.flatMap(x=>x.query.map(y=>y.totalMs))),
    selected:input.map(x=>x.selected.length),nativeSelectionHash:input.length?digest(input.map(x=>x.selected)):undefined,
    querySelected:d.queries?.output.map(x=>x.selected),errors:d.errors,
    reads:Object.fromEntries(['rectReads','rectRequests','styleReads','styleRequests','numericRects','clipMs','collectMs','rectMs','styleMs','predicateMs','packMs','kernelMs','pruneMs'].map(key=>[key,stats(q.map(x=>x[key]))])),
    cases:d.functional,
    fullFunctional:d.fullFunctional?{cases:d.fullFunctional.cases.map(x=>({case:x.case,passed:x.passed??x.rendered})),reopen:d.fullFunctional.reopen}:undefined,
    memory:d.memory.map(x=>({label:x.label,rendererRssMiB:x.processes.filter(p=>p.type==='Tab').reduce((s,p)=>s+p.rssKiB,0)/1024,
      heapMiB:x.heaps.reduce((s,h)=>s+h.usedSize,0)/1048576,
      backingStorageMiB:x.heaps.reduce((s,h)=>s+(h.backingStorageSize||0),0)/1048576,isolates:x.heaps.length})),
    peakRendererRssMiB:d.peakRendererRssKiB/1024,
    drag:d.drag?{modelUnchanged:d.drag.modelUnchanged,results:d.drag.results.map(r=>({count:r.count,construction:stats(r.samples),targetGeometryHash:digest(r.targets)}))}:undefined,
  };
  runs.push(row);
}
const groups=[];
for(const dataset of ['gp','complex'])for(const variant of ['baseline','cached-js','cached-wasm']){
  const timing=runs.filter(r=>r.phase==='timing'&&r.dataset===dataset&&r.variant===variant);
  if(!timing.length)continue;
  groups.push({dataset,variant,runs:timing.length,
    medianOfQueryMedians:stats(timing.map(r=>r.query.median)),medianOfFeedbackMedians:stats(timing.map(r=>r.feedback.median)),
    perRun:timing.map(r=>({file:r.file,queryMedian:r.query.median,queryP95:r.query.p95,feedbackMedian:r.feedback.median,feedbackP95:r.feedback.p95}))});
}
const equivalence=Object.fromEntries(['gp','complex'].map(dataset=>{
  const timing=runs.filter(r=>r.phase==='timing'&&r.dataset===dataset);
  return [dataset,{runs:timing.length,nativeSelectionsMatch:new Set(timing.map(r=>r.nativeSelectionHash)).size===1,
    querySelectionCountsMatch:new Set(timing.map(r=>digest(r.querySelected))).size===1}];
}));
const dragGroups=[];
for(const count of [1,3,6])for(const variant of ['baseline','cached-js']){
  const samples=runs.filter(r=>r.phase==='drag'&&r.variant===variant).map(r=>r.drag.results.find(x=>x.count===count));
  if(samples.length)dragGroups.push({count,variant,runs:samples.length,medianOfConstructionMedians:stats(samples.map(r=>r.construction.median)),targetGeometryHashes:[...new Set(samples.map(r=>r.targetGeometryHash))]});
}
const dragEquivalence=Object.fromEntries([1,3,6].map(count=>{
  const samples=dragGroups.filter(g=>g.count===count).flatMap(g=>g.targetGeometryHashes);
  return [count,{groups:samples.length,targetGeometryMatches:samples.length>1&&new Set(samples).size===1}];
}));
const result={scope:'Offline actual Studio diagnostics; no deployed product changes',privateArtifacts:task,runs,groups,equivalence,dragGroups,dragEquivalence};
fs.writeFileSync(path.join(task,'analysis.json'),JSON.stringify(result,null,2),{mode:0o600});
console.log(JSON.stringify(groups,null,2));
