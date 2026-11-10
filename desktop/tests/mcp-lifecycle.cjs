// The same STDIO clients survive real GUI shutdown/crash and reconnect on use.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { setTimeout: delay } = require("node:timers/promises");
const { requestRpc } = require("../src/local-rpc.cjs");
const electron = require("electron");
const children = new Set();
const output = [];
const report = [];
let profile;
async function deadline(promise, label, ms = 10000) {
  let timer;
  try {
    return await Promise.race([promise,new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(new Error("Timed out: "+label)),ms);
    })]);
  } finally { clearTimeout(timer); }
}
function launch(script, args = []) {
  const child=spawn(electron,[script,...args],{env:{...process.env,PLASMIC_DESKTOP_PROFILE:profile},stdio:["pipe","pipe","pipe"]});
  children.add(child);
  child.output="";
  child.stdout.on("data",chunk=>{child.output+=chunk;output.push(String(chunk));});
  child.stderr.on("data",chunk=>{child.output+=chunk;output.push(String(chunk));});
  child.exited=new Promise((resolve,reject)=>{
    child.once("error",reject);
    child.once("exit",(code,signal)=>{children.delete(child);resolve({code,signal});});
  });
  return child;
}
async function until(check,label) {
  const end=Date.now()+15000;
  while(Date.now()<end) {if(await check())return;await delay(30);}
  throw new Error("Timed out: "+label);
}
async function transport() {
  const child=launch(path.join(__dirname,"../src/entry.cjs"),["--mcp"]);
  child.stdin.write(JSON.stringify({jsonrpc:"2.0",id:1,method:"initialize",params:{protocolVersion:"2025-11-25",capabilities:{},clientInfo:{name:"lifecycle-test",version:"1"}}})+"\n");
  await until(()=>child.output.split("\n").some(line=>{
    try{return JSON.parse(line).result?.serverInfo?.name==="plasmic-desktop";}catch{return false;}
  }),"MCP initialized: "+child.output);
  child.stdin.write(JSON.stringify({jsonrpc:"2.0",method:"notifications/initialized"})+"\n");
  child.requestId = 1;
  return child;
}
async function request(client, method, params) {
  const id = ++client.requestId;
  client.stdin.write(JSON.stringify({jsonrpc:"2.0",id,method,params})+"\n");
  let response;
  await until(() => client.output.split("\n").some(line => {
    try { const value = JSON.parse(line); if (value.id === id) {response = value;return true;} } catch {}
    return false;
  }), "MCP response: " + client.output);
  assert.equal(response.error, undefined, JSON.stringify(response));
  return response.result;
}
const state = client => request(client, "tools/call", {name:"get_app_state",arguments:{}});
(async()=>{
  profile=await fs.mkdtemp(path.join(os.tmpdir(),"plasmic-mcp-lifecycle-"));
  const clients=await Promise.all([transport(),transport(),transport()]);
  const pids=clients.map(client=>client.pid);
  for (const client of clients) {
    assert.ok((await request(client,"tools/list",{})).tools.length);
    const result=await state(client);
    assert.equal(result.isError,true);
    assert.equal(JSON.parse(result.content[0].text).detail.operationExecuted,false);
  }
  for(const kind of ["quit","crash","reopen"]) {
    await fs.rm(path.join(profile,"quit"),{force:true});
    const gui=launch(path.join(__dirname,"mcp-lifecycle-host.cjs"));
    await until(async()=>{
      try {
        const ready = (await fs.readFile(path.join(profile, "logs/lifecycle.log"), "utf8")).trim().split("\n").map(JSON.parse)
          .some(row => row.pid === gui.pid && row.event === "startup.ready");
        return ready && (await requestRpc(profile,"get_app_state")).windowOpen;
      } catch { return false; }
    },"GUI startup: "+gui.output);
    for(const client of clients) {
      assert.equal(client.stdin.writableEnded,false);
      const result=await state(client);
      assert.equal(result.isError,false,JSON.stringify(result));
    }
    if(kind==="crash")gui.kill("SIGKILL");
    else await fs.writeFile(path.join(profile,"quit"),"");
    const guiExit=await deadline(gui.exited,"GUI exit: "+gui.output);
    if(kind!=="crash")assert.equal(guiExit.code,0,gui.output);
    for(const client of clients) {
      assert.equal(client.exitCode,null,"Bridge survives Desktop shutdown");
      assert.equal(client.stdin.writableEnded,false,"The MCP client did not close stdin");
      const result=await state(client);
      assert.equal(result.isError,true);
      assert.equal(JSON.parse(result.content[0].text).detail.operationExecuted,false);
    }
    assert.deepEqual(clients.map(client=>client.pid),pids);
    report.push({kind,clientsSurvived:clients.length,offlineToolsRejected:true});
  }
  for(const client of clients) {
    client.stdin.end();
    assert.equal((await deadline(client.exited,"MCP exits on stdin EOF",5000)).code,0,client.output);
  }
  console.log(JSON.stringify({passed:true,cases:report}));
})().catch(error=>{console.error(error,output.join(""));process.exitCode=1;}).finally(async()=>{
  for(const child of children)child.kill("SIGKILL");
  await Promise.allSettled([...children].map(child=>child.exited));
  if(profile)await fs.rm(profile,{recursive:true,force:true});
});
