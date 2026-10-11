const fs=require('fs'),path=require('path');
const {JSDOM}=require(path.resolve(__dirname,'../../../..','platform/wab/node_modules/jsdom'));
const base=fs.readFileSync(path.join(__dirname,'../consistent-v2/ui.js'),'utf8');
const proposal=fs.readFileSync(path.join(__dirname,'ui.js'),'utf8');
const views=['focused','overview','library','search','store','installed','manage','resources','view','delivery','light','readonly','component','history','comments','issues','share','code','preview','navigation'];
const out={};
for(const view of views){
 const dom=new JSDOM('<div id="root"></div>',{runScripts:'outside-only',url:'https://design.invalid/?screen=focused&view='+view});
 dom.window.eval(base+'\n'+proposal);
 const doc=dom.window.document;
 if(!doc.querySelector('.v3'))throw Error('Missing editor '+view);
 const routes=[...doc.querySelectorAll('[data-route]')].map(n=>n.dataset.route);
 for(const r of routes)if(!views.includes(r))throw Error('Unknown route '+r);
 out[view]={title:doc.title,routeCount:routes.length,common:[...doc.querySelectorAll('[data-common]')].map(n=>n.dataset.common)};
 dom.window.close();
}
fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify({method:'Offline DOM execution only; no network or browser rendering',views:out},null,2));
console.log('20 views constructed; all proposal navigation targets resolve.');
