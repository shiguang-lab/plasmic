const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { inspectTargets, clipRegion, feedbackOperation } = require('../src/island-feedback.cjs');
const { operationTargets } = require('../src/island-activity.cjs');

test('feedback targets retain only real model/ref identities and never treat dependency reads as current canvas reads', () => {
  assert.deepEqual(operationTargets('execute',{name:'read',input:{elements:[{componentUuid:'p',elementUuid:'e',text:'private'}]}}),[{componentUuid:'p',elementUuid:'e'}]);
  assert.deepEqual(operationTargets('execute',{name:'read',input:{componentUuids:['p','q']}}),[{componentUuid:'p'},{componentUuid:'q'}]);
  assert.deepEqual(operationTargets('execute',{name:'read',input:{fromProject:'library'}}),[]);
  assert.deepEqual(operationTargets('execute',{name:'read',input:{collection:'components'}}),[{viewport:true}]);
  assert.deepEqual(operationTargets('preview',{action:'click',ref:'doc:1',value:'secret'}),[{ref:'doc:1'}]);
  assert.deepEqual(operationTargets('execute_batch',{operations:[{name:'changeElement',input:{componentUuid:'p',elementUuid:'e'}}]}),[{componentUuid:'p',elementUuid:'e'}]);
  for(const input of [{elements:'bad'}, {componentUuids:[{}]}, {componentUuid:{secret:true}}]) assert.doesNotThrow(()=>operationTargets('execute',{name:'read',input}));
});

test('geometry follows visible model nodes and native Preview refs without mutating the DOM', (t) => {
  const dom = new JSDOM('<html data-plasmic-component-uuid="p" data-plasmic-frame-uuid="f"><body><section style="overflow-x:hidden;overflow-y:hidden"><button data-plasmic-valkey="root.e">Submit</button></section></body></html>',{runScripts:'outside-only'});
  t.after(()=>dom.window.close());const w=dom.window,doc=w.document,button=doc.querySelector('button'),parent=button.parentElement;
  w.Element.prototype.checkVisibility=function(){return !this.hidden};
  button.getBoundingClientRect=()=>({left:40,top:30,right:240,bottom:110,width:200,height:80});
  parent.getBoundingClientRect=()=>({left:0,top:0,right:150,bottom:90,width:150,height:90});
  Object.defineProperties(parent,{clientWidth:{value:150},clientHeight:{value:90}});
  const inspect=(targets,mode='edit',page)=>JSON.parse(JSON.stringify(w.eval(`(${inspectTargets.toString()})(${JSON.stringify(targets)},${JSON.stringify(mode)},${JSON.stringify(page)})`)));
  const before=doc.documentElement.outerHTML;
  assert.deepEqual(inspect([{componentUuid:'p',elementUuid:'e'}]),[{x:40,y:30,width:110,height:60}]);
  assert.deepEqual(inspect([{componentUuid:'other',elementUuid:'e'}]),[]);
  assert.deepEqual(inspect([{frameUuid:'other'}]),[]);
  button.hidden=true;assert.deepEqual(inspect([{componentUuid:'p',elementUuid:'e'}]),[]);button.hidden=false;
  parent.className='live-root-container';parent.setAttribute('data-plasmic-preview-component','p');
  w.__plasmicRuntimeInspection={id:'doc',nodes:new Map([['doc:1',button]])};
  assert.equal(inspect([{ref:'doc:1'}],'preview','p').length,1);
  assert.deepEqual(inspect([{ref:'old:1'}],'preview','p'),[]);
  assert.deepEqual(inspect([{ref:'doc:1'}],'preview','next'),[]);
  parent.removeAttribute('class');parent.removeAttribute('data-plasmic-preview-component');
  assert.equal(doc.documentElement.outerHTML,before);
});

test('feedback is clipped to the captured pixels and invalidated by page/view changes, errors and expiry', () => {
  assert.deepEqual(clipRegion({x:50,y:70,width:200,height:100},{x:100,y:50,width:400,height:200}),{x:0,y:.1,width:.375,height:.5});
  assert.equal(clipRegion({x:0,y:0,width:10,height:10},{x:100,y:50,width:400,height:200}),null);
  const context={projectId:'p',sessionId:'s',mode:'edit',arenaId:'a'};
  const op={...context,id:'one',kind:'read',phase:'running',url:'url'};
  assert.equal(feedbackOperation(op,context,'url'),op);
  for(const patch of [{phase:'failed'},{phase:'queued'},{kind:'save'},{sessionId:'next'},{arenaId:'other'},{mode:'preview'},{url:'next'}]) assert.equal(feedbackOperation({...op,...patch},context,'url'),null);
  assert.equal(feedbackOperation({...op,phase:'completed',finishedAt:100},context,'url',1700),null);
  assert.ok(feedbackOperation({...op,phase:'completed',finishedAt:100},context,'url',1000));
});
