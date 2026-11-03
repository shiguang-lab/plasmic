// Run serially; reject comparisons overlapping another diagnostic benchmark.
const fs=require('node:fs'),path=require('node:path'),{spawn,execFileSync}=require('node:child_process');
const [taskArg,fixturesArg,phase='timing',profileRound='1',variants='baseline,cached-js,cached-wasm']=process.argv.slice(2);
if(!taskArg||!fixturesArg)throw Error('task fixtures-json [functional|profile|timing|memory|drag] [first-round] [variants]');
const task=path.resolve(taskArg),fixtures=JSON.parse(fs.readFileSync(fixturesArg));
const repo=path.resolve(__dirname,'../../../..'),electron=path.join(repo,'desktop/node_modules/.bin/electron');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function contenders(){return execFileSync('ps',['-Ao','pid,command'],{encoding:'utf8'}).split('\n').filter(s=>s.trim().split(/\s+/)[1]?.endsWith('/Electron.app/Contents/MacOS/Electron')&&s.includes('desktop/tests/performance/'));}
async function run(dataset,variant,round){
  while(contenders().length){console.log('WAIT other diagnostic benchmark');await pause(10000);}
  const id=`${phase}-${dataset}-${round}-${variant}`;
  if(fs.existsSync(path.join(task,id+'.json'))||fs.existsSync(path.join(task,id+'.log')))throw Error('Run already exists: '+id);
  const log=fs.openSync(path.join(task,id+'.log'),'w');
  const child=spawn(electron,[path.join(__dirname,'run.cjs'),task,fixtures[dataset],variant,id,phase],{cwd:repo,stdio:['ignore',log,log]});
  const overlap=[];
  const timer=setInterval(()=>{for(const c of contenders())if(!c.includes(' '+id+' ')&&!overlap.includes(c))overlap.push(c);},1000);
  const code=await new Promise(resolve=>child.on('exit',resolve));clearInterval(timer);fs.closeSync(log);
  if(code!==0)throw Error('Failed '+id+'; inspect its private log');
  const result=JSON.parse(fs.readFileSync(path.join(task,id+'.json')));
  if(result.error||result.errors.length)throw Error('Renderer errors '+id);
  if(overlap.length&&phase!=='functional'){
    fs.renameSync(path.join(task,id+'.json'),path.join(task,id+'-excluded-contention.json'));
    fs.writeFileSync(path.join(task,id+'-contention.json'),JSON.stringify(overlap),{mode:0o600});
    console.log('EXCLUDED contention '+id);return run(dataset,variant,round+'r');
  }
  console.log(JSON.stringify({id,code,setup:result.setup,inputs:result.inputs.length,cases:result.functional?.length,overlap:overlap.length}));
}
(async()=>{
  const modes=variants.split(',');
  for(const dataset of Object.keys(fixtures)){
    if(phase==='functional')await run(dataset,modes.at(-1),1);
    else if(phase==='profile'){for(const mode of modes)await run(dataset,mode,profileRound);}
    else if(phase==='memory'){for(let r=0;r<2;r++)for(const mode of r?modes.slice().reverse():modes)await run(dataset,mode,r+1);}
    else for(let r=0;r<3;r++)for(let i=0;i<modes.length;i++)await run(dataset,modes[(i+r)%modes.length],r+Number(profileRound));
  }
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
