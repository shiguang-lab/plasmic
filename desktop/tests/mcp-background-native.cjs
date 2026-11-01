// Run with Node after build:mcp; the client and the owned RPC host are isolated.
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {execFileSync}=require("node:child_process");
const {Client}=require("@modelcontextprotocol/sdk/client/index.js");
const {StdioClientTransport}=require("@modelcontextprotocol/sdk/client/stdio.js");
const profile=fs.mkdtempSync(path.join(os.tmpdir(),"plasmic-background-"));
let stop,client;
(async()=>{
  stop=await require("../src/local-rpc.cjs").startRpc(profile,async()=>({}));
  const command=path.resolve(__dirname,"../mcp-bin",`${process.platform}-${process.arch}`,process.platform==="win32"?"plasmic-mcp.exe":"plasmic-mcp");
  const transport=new StdioClientTransport({command,args:[],env:{...process.env,PLASMIC_DESKTOP_PROFILE:profile},stderr:"pipe"});
  client=new Client({name:"background-test",version:"1"},{capabilities:{}});await client.connect(transport);
  assert((await client.listTools()).tools.length>0);
  let children=0;
  if(process.platform!=="win32"){
    children=execFileSync("ps",["-axo","ppid=,comm="],{encoding:"utf8"}).split("\n").filter(row=>Number(row.trim().split(/\s+/)[0])===transport.pid).length;
    assert.equal(children,0,"MCP must not start GPU, network or GUI subprocesses");
  }
  const closed=new Promise(resolve=>{client.onclose=resolve;});await stop();stop=undefined;
  await Promise.race([closed,new Promise((_,reject)=>setTimeout(()=>reject(Error("MCP did not exit with its RPC host")),2000).unref())]);
  console.log(JSON.stringify({passed:true,transport:"standalone",children}));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  await client?.close();if(stop)await stop();fs.rmSync(profile,{recursive:true,force:true});
});
