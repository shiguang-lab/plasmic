// Fresh-process diagnostics. RPC responses are local fixtures, never live designs.
const fs=require("node:fs"),path=require("node:path"),os=require("node:os"),assert=require("node:assert/strict");
const {spawn,execFileSync}=require("node:child_process");
const crypto=require("node:crypto");
const root=path.resolve(__dirname,"../.."),mode=process.argv[2],output=process.argv[3];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const hash=x=>crypto.createHash("sha256").update(x).digest("hex");
function tree(pid) {
  const rows=execFileSync("ps",["-axo","pid=,ppid=,rss=,pcpu=,comm="],{encoding:"utf8"}).trim().split("\n").map(s=>{
    const m=s.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+([\d.]+)\s+(.*)$/);
    return m&&{pid:+m[1],parent:+m[2],rssKiB:+m[3],cpuPercent:+m[4],name:path.basename(m[5])};
  }).filter(Boolean);
  const ids=new Set([pid]);let count;do{count=ids.size;for(const p of rows)if(ids.has(p.parent))ids.add(p.pid);}while(count!==ids.size);
  const processes=rows.filter(p=>ids.has(p.pid));return {rssSumMiB:processes.reduce((n,p)=>n+p.rssKiB,0)/1024,processes};
}
async function mcp() {
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),"plasmic-seven-mcp-"));
  const {startRpc}=require(root+"/src/local-rpc.cjs");
  const {Client}=require("@modelcontextprotocol/sdk/client/index.js");
  const {StdioClientTransport}=require("@modelcontextprotocol/sdk/client/stdio.js");
  let mutations=0;
  const png="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=";
  const dispatch=async(method,input)=>{
    if(method==="get_app_state")return {ok:true,large:"x".repeat(96000)};
    if(method==="get_screenshot")return {data:png,mimeType:"image/png",width:1,height:1};
    if(method==="execute"&&input.name==="save"){mutations++;return {saved:true};}
    if(method==="execute"&&input.name==="validate")throw Error("Expected diagnostic error");
    return {ok:true};
  };
  let stop=await startRpc(profile,dispatch);
  const samples=[],children=new Set();
  const before=process.env.PLASMIC_PERF_DESKTOP;
  if(!before)throw Error("fixed-mcp requires PLASMIC_PERF_DESKTOP baseline");
  const helper=path.join(root,"mcp-bin",`${process.platform}-${process.arch}`,process.platform==="win32"?"plasmic-mcp.exe":"plasmic-mcp");
  const launch=runtime=>({command:runtime==="fixed"?helper:require("electron"),
    args:runtime==="fixed"?[]:[before+"/src/entry.cjs","--mcp"],
    env:{...process.env,PLASMIC_DESKTOP_PROFILE:profile,DSH_AGENTS_HOME:path.join(profile,"agents")},stderr:"pipe"});
  try {
    for(const runtime of ["before","fixed","fixed","before"]) {
      const beforeMutations=mutations;
      const transport=new StdioClientTransport(launch(runtime));
      const client=new Client({name:"diagnostic",version:"1"},{capabilities:{}}),start=performance.now();
      let stderr="";await client.connect(transport);children.add(client);transport.stderr?.on("data",b=>{stderr+=b;});
      const startupMs=performance.now()-start,listing=await client.listTools();
      const response=await client.callTool({name:"get_app_state",arguments:{}});
      const ref=JSON.parse(response.content[0].text);assert.equal(ref.__type,"ResultReference");
      let text="",offset=0;
      do {const page=await client.callTool({name:"read_result",arguments:{resultId:ref.resultId,path:["large"],offset,limit:16000}});
        const data=JSON.parse(page.content[0].text);text+=data.text;offset=data.nextOffset;}while(offset!==undefined);
      assert.equal(text,"x".repeat(96000));
      const saved=await client.callTool({name:"execute",arguments:{name:"save"}});assert.equal(JSON.parse(saved.content[0].text).saved,true);
      assert.equal(mutations-beforeMutations,1);
      const error=await client.callTool({name:"execute",arguments:{name:"validate"}});assert.equal(error.isError,true);
      const image=await client.callTool({name:"get_screenshot",arguments:{}});assert.equal(image.content.find(c=>c.type==="image").data,png);
      const style=await client.callTool({name:"get_style",arguments:{}});assert(JSON.parse(style.content[0].text).styles.length>0);
      const skill=await client.callTool({name:"read_skill",arguments:{}});assert.equal(JSON.parse(skill.content[0].text).source,"published");
      await sleep(800);const measurements=[];for(let i=0;i<4;i++){measurements.push(tree(transport.pid));await sleep(250);}
      samples.push({runtime,startupMs,toolCount:listing.tools.length,toolHash:hash(JSON.stringify(listing.tools)),
        rssSumMiBMean:measurements.reduce((n,s)=>n+s.rssSumMiB,0)/measurements.length,processes:measurements.at(-1).processes,
        functional:{initialize:true,listTools:true,rpc:true,largeResultPaging:true,mutationExactlyOnce:true,error:true,image:true,bundledStyle:true,bundledSkill:true},stderrBytes:Buffer.byteLength(stderr)});
      await client.close();children.delete(client);await sleep(500);
    }
    // The current bridge keeps STDIO alive and reconnects when the host returns.
    const live=[];
    for(const runtime of ["before","fixed"]) {
      const transport=new StdioClientTransport(launch(runtime));
      const client=new Client({name:"lifecycle",version:"1"},{capabilities:{}});await client.connect(transport);children.add(client);
      assert.equal((await client.callTool({name:"get_app_state",arguments:{}})).isError,false);
      let closed=false;client.onclose=()=>{closed=true;};live.push({runtime,client,closed:()=>closed});
    }
    await stop();await sleep(1000);
    for(const c of live)assert.equal(c.closed(),c.runtime==="before");
    stop=await startRpc(profile,dispatch);
    const fixed=live.find(c=>c.runtime==="fixed");
    assert.equal((await fixed.client.callTool({name:"get_app_state",arguments:{}})).isError,false);
    const hostDisconnect=live.map(c=>({runtime:c.runtime,exited:c.closed(),reconnected:c.runtime==="fixed"}));
    for(const c of live){await c.client.close();children.delete(c.client);}
    return {samples,hostDisconnect,
      limitation:"Actual native helper vs saved Electron baseline. RSS sums include shared pages; macOS native runtime only."};
  } finally {for(const c of children)await c.close().catch(()=>{});await stop().catch(()=>{});fs.rmSync(profile,{recursive:true,force:true});}
}
async function imageChild() {
  const sharp=require("sharp");
  if(output==="disabled")sharp.cache(false);
  const {encodeImagePreview}=require(root+"/src/image-preview.cjs");
  // Deterministic photographic-like RGB input with local gradients and noise.
  let seed=17;const pixels=Buffer.alloc(1600*1000*3);
  for(let i=0;i<pixels.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;pixels[i]=((i/3/1600|0)+(i/3%1600|0)+(seed>>>28))&255;}
  const input=await sharp(pixels,{raw:{width:1600,height:1000,channels:3}}).png().toBuffer();
  const before=process.memoryUsage().rss/1048576,start=performance.now(),latencies=[];let peak=before,first;
  for(let i=0;i<12;i++) {const t=performance.now();const image=await encodeImagePreview(input);latencies.push(performance.now()-t);const digest=hash(image.data);first??=digest;assert.equal(digest,first);peak=Math.max(peak,process.memoryUsage().rss/1048576);}
  await sleep(500);
  console.log(JSON.stringify({cache:output,totalMs:performance.now()-start-500,latencies,baselineRssMiB:before,peakRssMiB:peak,
    finalRssMiB:process.memoryUsage().rss/1048576,cacheStats:sharp.cache(),outputHash:first,images:12}));
}
async function images() {
  const samples=[];
  for(const cache of ["default","disabled","disabled","default"]) {
    const child=spawn(process.execPath,[__filename,"image-child",cache],{stdio:["ignore","pipe","pipe"]});
    let text="",err="";child.stdout.on("data",b=>text+=b);child.stderr.on("data",b=>err+=b);
    const code=await new Promise(r=>child.on("exit",r));assert.equal(code,0,err);samples.push(JSON.parse(text));
  }
  assert.equal(new Set(samples.map(s=>s.outputHash)).size,1);return {samples,pixelOutputIdentical:true};
}
(async()=>{if(mode==="image-child")return imageChild();
  const result=mode==="fixed-mcp"?await mcp():mode==="images"?await images():null;if(!result)throw Error("Unknown mode");
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify({mode,node:process.version,platform:process.platform,arch:process.arch,...result},null,2));console.log(JSON.stringify({mode,passed:true,output}));
})().catch(e=>{console.error(e);process.exitCode=1;});
