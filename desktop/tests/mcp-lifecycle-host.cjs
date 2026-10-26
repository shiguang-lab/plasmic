// Owned GUI fixture: real bootstrap and quit handlers, no NAS or design edits.
const { app, dialog, session } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const profile = process.env.PLASMIC_DESKTOP_PROFILE;
dialog.showErrorBox = (title, detail) => { console.error(title,detail);app.exit(1); };
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === "../desktop.config.json" && parent.filename.endsWith("/src/main.cjs")) {
    // This fixture replaces all renderer content; match the installed fixture assets.
    const config = originalLoad.call(this,request,parent,isMain);
    const assets = JSON.parse(fs.readFileSync(path.join(__dirname,"../renderer/desktop-assets.json"),"utf8"));
    return {...config,webImage:assets.webImage};
  }
  if (request === "./asset-handler.cjs" && parent.filename.endsWith("/src/main.cjs")) {
    return { createAssetHandler: () => async () => new Response(`<html><body>MCP lifecycle fixture<script>
      addEventListener('message',event=>{
        if(event.source!==window || event.origin!==location.origin || event.data?.channel!=='plasmic-desktop-request')return;
        postMessage({channel:'plasmic-desktop-response',id:event.data.id,result:{ready:false,tools:{},availableEditorTools:[]}},location.origin);
      });
    </script></body></html>`, {headers:{"Content-Type":"text/html"}}) };
  }
  return originalLoad.call(this,request,parent,isMain);
};
const { bootstrap } = require("../src/main.cjs");
Module._load = originalLoad;
app.whenReady().then(() => {
  session.fromPartition("persist:plasmic-desktop").fetch = async () => Response.json({authenticated:true});
  const timer = setInterval(() => {
    if (fs.existsSync(path.join(profile,"quit"))) {
      clearInterval(timer);
      app.quit();
    }
  }, 25);
  app.once("will-quit", () => clearInterval(timer));
});
bootstrap();
