const test=require('node:test');
const assert=require('node:assert/strict');
const {IslandFraming}=require('../src/island-framing.cjs');
const context={projectId:'p',sessionId:'s',arenaId:'arena',mode:'edit',frameUuid:'a'};
const a={index:0,frameUuid:'a',componentUuid:'page-a',x:16,y:16,width:1440,height:1024};
const b={index:1,frameUuid:'b',componentUuid:'page-b',x:1616,y:200,width:390,height:844};
const scene={width:2022,height:1060,background:'#222',boards:[a,b]};
const op=(id,targets,extra={})=>({...context,id,kind:'read',phase:'running',targets,...extra});
const page=(framing,operation,operations=[operation],ctx=context,view=scene)=>framing.select(view,ctx,operation,operations);

test('opens in overview, fits the complete target page, and keeps it after results and metadata queries',()=>{
 const f=new IslandFraming();
 assert.equal(f.select(scene,context,null,[]).view,'overview');
 const read=op('read',[{componentUuid:'page-a',elementUuid:'tiny-node'}]);
 let view=page(f,read);
 assert.equal(view.view,'page'); assert.equal(view.width,1440);assert.equal(view.height,1024);
 assert.deepEqual(view.boards,[{...a,x:0,y:0}],'node reads never crop the page to an element');
 view=page(f,{...read,phase:'completed'},[]);assert.equal(view.view,'page');
 assert.equal(f.select(scene,context,null,[]).boards[0].frameUuid,'a','result expiry preserves the view');
 assert.equal(page(f,op('save',[],{kind:'save',phase:'completed'}),[]).view,'page','save does not reframe');
 assert.equal(page(f,op('state',[],{kind:'resource',phase:'completed'}),[]).view,'page','metadata does not reframe');
 assert.equal(page(f,op('next',[{componentUuid:'page-b'}])).boards[0].frameUuid,'b');
});

test('whole-canvas and multi-page operations use the full overview; multiple edits in one page stay focused',()=>{
 const f=new IslandFraming();
 assert.equal(page(f,op('a',[{componentUuid:'page-a'}])).view,'page');
 assert.equal(page(f,op('global',[{viewport:true}])).view,'overview');
 assert.equal(page(f,op('batch',[{componentUuid:'page-a'},{componentUuid:'page-b'}],{kind:'write'})).view,'overview');
 const view=page(f,op('same-page',[{componentUuid:'page-a',elementUuid:'one'},{componentUuid:'page-a',elementUuid:'two'}],{kind:'write'}));
 assert.equal(view.view,'page');assert.equal(view.width,1440);
});

test('a fast page read followed immediately by save or metadata retains its completed canvas intent',()=>{
 const f=new IslandFraming(), read=op('fast',[{frameUuid:'b'}],{phase:'completed'});
 const metadata=op('metadata',[],{kind:'resource',phase:'completed'});
 assert.equal(page(f,metadata,[read]).boards[0].frameUuid,'b');
 assert.equal(page(f,op('save',[],{kind:'save',phase:'completed'}),[read]).view,'page');
});

test('concurrent page operations show overview and focus the remaining active page when the group narrows',()=>{
 const f=new IslandFraming(), one=op('one',[{frameUuid:'a'}]),two=op('two',[{frameUuid:'b'}]);
 assert.equal(page(f,two,[one,two]).view,'overview');
 assert.equal(page(f,one,[two]).boards[0].frameUuid,'b');
 assert.equal(page(f,{...two,phase:'completed'},[]).boards[0].frameUuid,'b');
});

test('explicit frame identity wins; responsive duplicates use the matching active frame or overview',()=>{
 const f=new IslandFraming(), duplicate={...b,componentUuid:'page-a'},view={...scene,boards:[a,duplicate]};
 assert.equal(page(f,op('exact',[{componentUuid:'page-a',frameUuid:'b'}]),undefined,context,view).boards[0].frameUuid,'b');
 assert.equal(page(f,op('component',[{componentUuid:'page-a'}]),undefined,context,view).boards[0].frameUuid,'a');
 assert.equal(page(f,op('ambiguous',[{componentUuid:'page-a'}]),undefined,{...context,frameUuid:'missing'},view).view,'overview');
 assert.equal(page(f,op('mismatch',[{componentUuid:'page-b',frameUuid:'a'}])).view,'overview');
});

test('navigation carries explicit intent across arenas, while manual context changes clear previous page focus',()=>{
 const f=new IslandFraming(), old=op('old',[{frameUuid:'a'}]);
 page(f,old);
 const next={...context,arenaId:'another'};
 assert.equal(page(f,{...old,phase:'completed'},[],next).view,'overview');
 const navigate=op('navigate',[{frameUuid:'b'}],{kind:'view'});
 assert.equal(page(f,navigate,[],next).view,'overview');
 assert.equal(page(f,{...navigate,phase:'completed'},[],next).boards[0].frameUuid,'b');
 assert.equal(page(f,{...navigate,phase:'completed'},[],{...next,projectId:'other'}).view,'overview');
});

test('failed, unbound and foreign calls cannot select an unrelated page; unresolved targets fall back to overview',()=>{
 const f=new IslandFraming();
 for(const extra of [{phase:'failed'},{projectId:'other'},{sessionId:'other'},{mode:'preview'},{projectId:undefined}])
  assert.equal(page(f,op(JSON.stringify(extra),[{frameUuid:'a'}],extra)).view,'overview');
 assert.equal(page(f,op('missing',[{frameUuid:'not-rendered'}])).view,'overview');
});
