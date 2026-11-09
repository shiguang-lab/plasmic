import { testProfile, testIdentityAssertion } from "@/wab/server/__testonly__/shiguang-fixture";
import { runAppServer } from "@/wab/server/app-backend-real";
import { ensureDbConnection, closeDbConnections } from "@/wab/server/db/DbCon";
import { seedTestDb } from "@/wab/server/db/DbInit";
import { DbMgr, SUPER_USER } from "@/wab/server/db/DbMgr";
import http from "node:http";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { it } from "vitest";
import { _testonly } from "@/wab/server/util/url";

it("runs the real local backend for browser acceptance", async()=>{
 _testonly.ssrfAllowedIpAddresses.push("127.0.0.1");
 const databaseUri="postgresql://wab@127.0.0.1:55436/wab_mobx_acceptance_20261108";
 const emails=["admin@admin.example.com","user@example.com","user2@example.com"];
 emails.forEach((email,index)=>testProfile(email,["Plasmic Admin","Plasmic User","Plasmic User 2"][index]));
 const con=await ensureDbConnection(databaseUri,"default");
 await con.transaction(async em=>{
  if(!fs.existsSync("/tmp/mobx-comprehensive/seed-complete"))await seedTestDb(em);
  const db=new DbMgr(em,SUPER_USER);
  const flags=JSON.parse((await db.tryGetDevFlagOverrides())?.data??"{}");
  await db.setDevFlagOverrides(JSON.stringify({...flags,defaultHostUrl:"https://localhost:3009/static/host.html",codegenOriginHost:"https://localhost:3008",adminEmailWhitelist:[emails[0]],autoSave:true}));
 });
 const sessions=Object.fromEntries(emails.map(email=>[email,randomUUID()]));
 const assertions=new Map(Object.entries(sessions).map(([email,session])=>[session,testIdentityAssertion(email)]));
 const backend=await runAppServer({databaseUri,port:3006,host:"https://localhost:3008",production:false,integrationSessionSecret:"acceptance-only",mailFrom:"",mailUserOps:"",terminationGracePeriodMs:5000,keepAliveTimeoutMs:60000,genericWorkerPoolSize:1,loaderWorkerPoolSize:1});
 // A loopback test gateway issues the same signed assertions as the existing
 // server fixtures. Authentication, authorization, DB and sockets remain real.
 const proxy=(await import("http-proxy-3")).default.createProxyServer({target:"http://127.0.0.1:3006",ws:true});
 const authorize=(req:any)=>{
  delete req.headers["x-sg-identity"];
  const session=(req.headers.cookie??"").split(";").map((s:string)=>s.trim()).find((s:string)=>s.startsWith("__Secure-sg_session="))?.split("=").slice(1).join("=");
  const assertion=assertions.get(session);
  if(assertion)req.headers["x-sg-identity"]=assertion;
 };
 const gateway=http.createServer(async(req,res)=>{
  authorize(req);
  if(req.url==="/api/auth/session"){
   const response=await fetch("http://127.0.0.1:3006/api/v1/auth/self",{headers:req.headers as any});
   const body=await response.json();
   res.writeHead(response.status,{"Content-Type":"application/json"}).end(JSON.stringify({authenticated:response.ok&&!!body.user}));return;
  }
  proxy.web(req,res);
 });
 gateway.on("upgrade",(req,socket,head)=>{authorize(req);proxy.ws(req,socket,head)});
 await new Promise<void>(resolve=>gateway.listen(3004,"127.0.0.1",resolve));
 fs.writeFileSync("/tmp/mobx-comprehensive/sessions.json",JSON.stringify(sessions),{mode:0o600});
 fs.writeFileSync("/tmp/mobx-comprehensive/backend-ready.json",JSON.stringify({port:3004,database:"wab_mobx_acceptance_20261108",identity:"existing signed IAM fixtures",ready:true}));
 await new Promise<void>(resolve=>{
  const timer=setInterval(()=>{if(fs.existsSync("/tmp/mobx-comprehensive/stop-backend")){clearInterval(timer);resolve()}},1000);
 });
 await new Promise<void>(resolve=>gateway.close(()=>resolve()));proxy.close();
 await new Promise<void>(resolve=>backend.close(()=>resolve()));await closeDbConnections();
});
