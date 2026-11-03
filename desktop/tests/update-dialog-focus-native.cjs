// Native focus/lifecycle regression through cross-origin nested editor iframes.
// Actual OS shortcut delivery is tested separately in native-studio-experience.
const { app, BrowserWindow, session, ipcMain } = require("electron");
const { StudioWindow } = require("../src/studio-window.cjs");
const { createUpdateDialog } = require("../src/update-dialog.cjs");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const profile=fs.mkdtempSync(path.join(os.tmpdir(),"plasmic-dialog-focus-"));
app.setPath("userData",profile);app.setPath("sessionData",profile);
app.on("window-all-closed",()=>{});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label){const deadline=Date.now()+5000;while(Date.now()<deadline){if(await fn())return;await pause(20);}throw Error("Timed out: "+label);}
const timer=setTimeout(()=>app.exit(1),30000);
app.whenReady().then(async()=>{
  const ses=session.fromPartition("focus-fixture");
  const origin="https://studio.test";
  ses.protocol.handle("https",request=>{
    const url=new URL(request.url);
    if(url.pathname.endsWith(".js"))return new Response(fs.readFileSync(path.join(__dirname,"../src",path.basename(url.pathname))),{headers:{"Content-Type":"application/javascript"}});
    let html;
    if(url.hostname==="host.test")html='<iframe src="https://editor.test/editor" style="width:100%;height:100%"></iframe>';
    else if(url.hostname==="editor.test")html='<body tabindex="-1"><h1>Editor</h1>';
    else html='<iframe src="https://host.test/outer" style="width:100%;height:100%"></iframe><script>window.forwardedEscapes=0;document.body.addEventListener("keydown",e=>{if(e.key==="Escape"){forwardedEscapes++;e.preventDefault();}});</script><script defer src="/renderer-i18n.js"></script><script defer src="/update-dialog.js"></script>';
    return new Response('<!doctype html><html><body>'+html+'</body></html>',{headers:{"Content-Type":"text/html"}});
  });
  ipcMain.handle("desktop:ui-appearance",()=>"light");
  ipcMain.handle("desktop:ui-locale",()=>({locale:"en",messages:{}}));
  const state={phase:"disabled",currentVersion:"fixture"};
  ipcMain.handle("desktop:update",()=>state);
  const manager={state,command:async()=>state};
  const window=new BrowserWindow({show:false,width:900,height:700});
  const studio=new StudioWindow(window,{studioOrigin:origin,backgroundColor:"#fff",projectId:url=>new URL(url||"about:blank").pathname.match(/^\/projects\/([^/]+)/)?.[1],beforeNavigate:async()=>{},webPreferences:{session:ses,preload:path.resolve(__dirname,"../src/preload.cjs"),sandbox:true,contextIsolation:true}});
  ipcMain.handle("desktop:view-state",event=>({active:event.sender===studio.webContents}));
  let open;
  const attach=contents=>{open=createUpdateDialog(manager,window,contents);};
  studio.on("contents-created",attach);attach(studio.webContents);
  window.show();app.focus({steal:true});window.focus();
  const counts=[];
  for(const project of ["first","second"]){
    await studio.loadURL(origin+"/projects/"+project);
    const contents=studio.webContents;
    const frame=contents.mainFrame.framesInSubtree.find(f=>f.url==="https://editor.test/editor");
    assert(frame,"Nested editor frame is loaded");
    await frame.executeJavaScript("document.body.focus();window.focus();true");
    await until(()=>contents.focusedFrame===frame,"initial nested focus");
    for(const close of ["button","escape"]){
      open();
      await until(()=>contents.mainFrame.executeJavaScript("!!document.getElementById('plasmic-desktop-update-dialog').shadowRoot.querySelector('dialog').open"),"dialog open");
      assert.equal(contents.isFocused(),true,"Opening updates must activate the Studio WebContentsView");
      assert.notEqual(contents.focusedFrame,frame);
      if(close==="button")await contents.mainFrame.executeJavaScript("document.getElementById('plasmic-desktop-update-dialog').shadowRoot.getElementById('primary').click();true");
      else {
        contents.sendInputEvent({type:"keyDown",keyCode:"Escape"});
        contents.sendInputEvent({type:"keyUp",keyCode:"Escape"});
      }
      await until(()=>contents.mainFrame.executeJavaScript("!document.getElementById('plasmic-desktop-update-dialog').shadowRoot.querySelector('dialog').open"),"dialog closed after "+close);
      await until(()=>contents.focusedFrame===frame,"nested focus after "+close);
      assert.equal(await contents.mainFrame.executeJavaScript("forwardedEscapes"),0,"Dialog keys must not reach Studio shortcut forwarding");
      counts.push({project,close,nestedFocusRestored:true,underlyingShortcutBlocked:true});
    }
    assert.equal(ipcMain.listenerCount("desktop:update-dialog-closed"),2);
  }
  const destroyed=[studio.dashboard,studio.editor].filter(Boolean).map(view=>new Promise(resolve=>view.webContents.once("destroyed",resolve)));
  window.destroy();await Promise.all(destroyed);
  assert.equal(ipcMain.listenerCount("desktop:update-dialog-closed"),0);
  console.log(JSON.stringify({passed:true,cases:counts,rendererListenersReleased:true}));
  clearTimeout(timer);app.exit(0);
}).catch(error=>{console.error(error);app.exit(1);});
