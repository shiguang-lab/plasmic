// Real Desktop shell/menu/preload with a private profile and offline project.
// A native UI driver supplies OS shortcuts. Named actions prepare fixture edits,
// read results, and send the Space/mouse pan probe. Nothing reaches the NAS.
const { app, session, BrowserWindow, webContents, dialog } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { createProjectBackend } = require("./real-project-backend.cjs");
const { studioContents } = require("../fixtures/native-studio.cjs");
const task = path.resolve(process.argv[2]), fixture = path.resolve(process.argv[3]);
const read = name => JSON.parse(fs.readFileSync(path.join(fixture,name)));
const opening=read("project-response.json"),startup=opening.startup;
const models={...read("model-resources.json"),...read("plume-resources.json")};
const codes=new Map(Object.entries(read("code-resources.json")).map(([key,value])=>{const u=new URL(key);u.searchParams.sort();return [u.pathname+u.search,value];}));
const profile=path.join(task,"native-profile-"+(process.env.PERF_NATIVE_RUN||"1"));
fs.mkdirSync(profile,{recursive:true,mode:0o700});
app.setPath("userData",profile);app.setPath("sessionData",profile);
const report={scope:"Offline fixture, production Desktop shell/menu/preload/controller, physical native keyboard input",checks:[],errors:[],blocked:[],previewErrors:[]};
const backend=createProjectBackend({opening,startup,models,codes,plume:read("plume-opening.json"),report,phase:()=>"native-experience",functional:true});
let main,aux,frame;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const stateFile=path.join(task,"native-state.json"),commandFile=path.join(task,"native-command.json"),resultFile=path.join(task,"native-result.json");
const write=(file,value)=>{const next=file+".next";fs.writeFileSync(next,JSON.stringify(value,null,2),{mode:0o600});fs.renameSync(next,file);};
async function ready() {
  const deadline=Date.now()+60000;
  while(Date.now()<deadline) {
    for(const candidate of studioContents(main).mainFrame.framesInSubtree) {
      try {if(await candidate.executeJavaScript("!!window.studioCtx?.activeCanvasReady && !!window.studioCtx?.initialViewportReady")){frame=candidate;return;}}catch{}
    }
    await pause(50);
  }
  throw Error("Fixture editor readiness timed out");
}
const rpc=(method,input={})=>require("../../src/local-rpc.cjs").requestRpc(profile,method,input);
async function command(action) {
  if(action==="prepare") {
    await ready();
    const prepared=await frame.executeJavaScript(`(async()=>{
      const s=studioCtx;clearInterval(s.asyncSaverTimer);await s.awaitStudioReady();s.needsFullSave=true;
      const f=s.currentArena.children[0];window.__keyboardFrame=f;
      window.__keyboardBefore=f.left;window.__keyboardBundle=JSON.stringify(s.bundler().bundle(s.site,s.siteInfo.id,s.appCtx.lastBundleVersion));
      await s.changeUnsafe(()=>{f.left+=17});await s.awaitEval();
      document.activeElement?.blur();document.body.tabIndex=-1;document.body.focus();
      return {before:window.__keyboardBefore,left:f.left};
    })()`);
    return prepared;
  }
  if(action==="state") {
    let editor;
    try{editor=await frame?.executeJavaScript(`(()=>{const s=studioCtx,v=s.getCurrentStudioViewportSnapshot();return {left:window.__keyboardFrame?.left,before:window.__keyboardBefore,changeCounter:s._changeCounter,saveStatus:s.saveStatus,revision:s.dbCtx().revisionNum,input:document.getElementById('keyboard-input')?.value,active:document.activeElement?.tagName,scroll:{x:v.scroll.x,y:v.scroll.y},scale:v.scale,isDevMode:s.isDevMode,spaceDown:!!s.isSpaceDown(),panMode:s.isPanMode(),panning:s.isPanning()}})()`);}catch{}
    const contents=studioContents(main);
    return {url:contents.getURL(),pid:contents.getOSProcessId(),contentsId:contents.id,focusedId:webContents.getFocusedWebContents()?.id,focusedFrameUrl:contents.focusedFrame?.url,topActive:await contents.executeJavaScript("document.activeElement?.tagName"),focused:contents.isFocused(),windowFocused:main.isFocused(),editor};
  }
  if(action==="prepare-input") return frame.executeJavaScript(`(()=>{let e=document.getElementById('keyboard-input');if(!e){e=document.createElement('input');e.id='keyboard-input';e.setAttribute('aria-label','Keyboard fixture');Object.assign(e.style,{position:'fixed',top:'100px',left:'300px',zIndex:'999999',background:'white',color:'black'});document.body.append(e);}e.value='';e.focus();return true;})()`);
  if(action==="remove-input") return frame.executeJavaScript("document.getElementById('keyboard-input')?.remove();document.body.focus();true");
  if(action==="restore") return frame.executeJavaScript(`(async()=>{const s=studioCtx;if(window.__keyboardFrame.left!==window.__keyboardBefore){await s.undo();await s.awaitEval();}if(window.__keyboardFrame.left!==window.__keyboardBefore)throw Error('Fixture model was not restored');return true;})()`);
  if(action==="browser-open") return rpc("browser",{action:"open"});
  if(action==="browser-close") return rpc("browser",{action:"close"});
  if(action==="aux-open") {aux=new BrowserWindow({width:420,height:240,title:"Focus fixture"});await aux.loadURL("data:text/html,<input autofocus aria-label='Other window'>");aux.show();aux.focus();return true;}
  if(action==="aux-close") {aux.close();aux=undefined;main.show();main.focus();return true;}
  if(action==="pan") {
    const contents=studioContents(main);
    app.focus({steal:true});main.show();main.focus();contents.focus();
    const focusDeadline=Date.now()+5000;
    while(!main.isFocused() || !contents.isFocused()) {
      if(Date.now()>focusDeadline)throw Error("Native pan fixture could not gain focus");
      await pause(25);
    }
    const target=await frame.executeJavaScript(`(()=>{const r=document.querySelector('.canvas-editor__canvas-clipper').getBoundingClientRect();return {x:r.x+96,y:r.y+r.height/2};})()`);
    // Frame geometry is relative to the Host iframe; sendInputEvent uses the
    // top-level Studio viewport's DIP coordinates.
    const offset=await contents.executeJavaScript(`(()=>{const r=document.querySelector('iframe.studio-frame')?.getBoundingClientRect()??document.querySelector('iframe')?.getBoundingClientRect();return {x:r?.x??0,y:r?.y??0};})()`);
    const x=Math.round(target.x+offset.x),y=Math.round(target.y+offset.y);
    const origin=main.getContentBounds();
    const mouse=(type,px,py)=>contents.sendInputEvent({type,x:px,y:py,globalX:origin.x+px,globalY:origin.y+py,button:"left",clickCount:1});
    const before=await command("state");
    contents.focus();
    mouse("mouseMove",x,y);mouse("mouseDown",x,y);mouse("mouseUp",x,y);await pause(80);
    contents.sendInputEvent({type:"keyDown",keyCode:"Space"});await pause(100);
    const keyDown=await command("state");
    mouse("mouseDown",x,y);
    for(let i=1;i<=5;i++){mouse("mouseMove",x+i*10,y+i*6);await pause(20);}
    const dragging=await command("state");
    mouse("mouseUp",x+50,y+30);contents.sendInputEvent({type:"keyUp",keyCode:"Space"});await pause(150);
    const after=await command("state");
    if(!keyDown.editor.spaceDown || !dragging.editor.panning)throw Error("Native pan input did not reach the editor: "+JSON.stringify({windowFocused:keyDown.windowFocused,contentsFocused:keyDown.focused,spaceDown:keyDown.editor.spaceDown,panning:dragging.editor.panning}));
    if(after.editor.scroll.x!==before.editor.scroll.x-50 || after.editor.scroll.y!==before.editor.scroll.y-30)throw Error("Native pan did not move the viewport");
    if(after.editor.changeCounter!==before.editor.changeCounter || after.editor.spaceDown || after.editor.panning)throw Error("Native pan changed model or retained input state");
    return {target,offset,keyDown,dragging,before,after};
  }
  if(action==="finish") {write(path.join(task,"native-report.json"),report);app.exit(0);return true;}
  throw Error("Unknown fixture command");
}
app.on("window-all-closed",()=>{});
app.whenReady().then(async()=>{
  const ses=session.fromPartition("persist:plasmic-desktop");
  ses.webRequest.onBeforeRequest({urls:["ws://*/*","wss://*/*"]},(_,callback)=>callback({cancel:true}));
  ses.fetch=async(request,options={})=>{
    const r=typeof request==="string"?new Request(request,options):request;
    if(new URL(r.url).pathname==="/api/auth/session")return Response.json({authenticated:true});
    return backend(r);
  };
  dialog.showErrorBox=(title,message)=>report.errors.push({title,message});
  main=await require("../../src/main.cjs").startDesktop();
  main.setTitle("Plasmic keyboard acceptance");
  write(stateFile,{ready:true,profile,projectId:startup.projectId,title:main.getTitle()});
  let lastId;
  fs.rmSync(commandFile,{force:true});fs.rmSync(resultFile,{force:true});
  setInterval(async()=>{
    let value;try{value=JSON.parse(fs.readFileSync(commandFile));}catch{return;}
    if(value.id===lastId)return;lastId=value.id;
    try{const result=await command(value.action);report.checks.push({action:value.action,result});write(resultFile,{id:value.id,result});}
    catch(error){write(resultFile,{id:value.id,error:error.stack});}
  },100);
}).catch(error=>{write(stateFile,{error:error.stack});app.exit(1);});
setTimeout(()=>{write(stateFile,{error:"Native experience fixture timed out"});app.exit(2);},20*60000);
