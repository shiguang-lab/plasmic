const {app}=require('electron');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {monitorEventLoopDelay}=require('node:perf_hooks');
const root=path.resolve(process.argv[2]),output=process.argv[3],node=process.argv[4];
require(path.join(root,'src/main.cjs'));
const {DesignReference}=require(path.join(root,'src/design-reference.cjs'));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'plasmic-reference-first-'));
fs.writeFileSync(path.join(profile,'design-reference.json'),JSON.stringify({command:node,args:[path.resolve(__dirname,'../fixtures/design-reference-server.cjs')]}));
app.setPath('userData',path.join(profile,'electron'));
app.whenReady().then(async()=>{
 const reader=new DesignReference(profile),delay=monitorEventLoopDelay({resolution:1});delay.enable();
 try{
  await new Promise(r=>setTimeout(r,20));delay.reset();const start=performance.now();
  const [a,b]=await Promise.all([reader.read({action:'index',filePath:'/tmp/a.pen'}),reader.read({action:'index',filePath:'/tmp/b.pen'})]);
  const firstConcurrentReadMs=performance.now()-start;
  const warmStart=performance.now();await reader.read({action:'index',filePath:'/tmp/a.pen'});const warmReadMs=performance.now()-warmStart;
  await new Promise(r=>setTimeout(r,20));delay.disable();
  const result={firstConcurrentReadMs,warmReadMs,eventLoopMaxMs:delay.max/1e6,totals:[a.total,b.total]};
  fs.writeFileSync(output,JSON.stringify(result,null,2));
 }finally{delay.disable();await reader.close();}
}).catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{fs.rmSync(profile,{recursive:true,force:true});app.exit(process.exitCode||0)});
