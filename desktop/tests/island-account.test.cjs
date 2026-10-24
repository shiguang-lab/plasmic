const {test}=require('node:test');
const assert=require('node:assert/strict');
const {IslandAccount}=require('../src/island-account.cjs');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
function fixture(){
 let time=1, reads=[], notices=0;
 const data={self:{user:{id:'a',firstName:'Li',lastName:'Lei',email:'li@example.test'}},app:{teams:[{id:'t',name:'Team'}],workspaces:[{id:'w',name:'Work',teamId:'t'}]},projects:{projects:[{id:'p'},{id:'p2'}]}};
 const request=async path=>{reads.push(path);return path.includes('auth/self')?data.self:path.includes('app-ctx')?data.app:data.projects};
 const account=new IslandAccount(request,()=>notices++,()=>time);
 return {account,data,reads,get notices(){return notices},advance(){time+=30001}};
}
test('account summary reads authenticated API data once per cache interval and invalidation refreshes counts',async()=>{
 const f=fixture();await f.account.refresh();
 assert.equal(f.account.snapshot().status,'ready');assert.deepEqual(f.account.snapshot().counts,{organizations:1,workspaces:1,projects:2});
 assert.equal(f.account.snapshot().user.name,'Li Lei');assert.equal(f.reads.length,3);
 await Promise.all([f.account.refresh(),f.account.refresh()]);assert.equal(f.reads.length,3);
 f.data.projects.projects.push({id:'new'});f.account.invalidate(false);await f.account.refresh();assert.equal(f.account.snapshot().counts.projects,3);
 f.advance();await f.account.refresh();assert.equal(f.reads.length,9);
});
test('logout and account replacement discard in-flight data, including late responses',async()=>{
 const f=fixture();await f.account.refresh();const pending=deferred();
 f.account.request=()=>pending.promise;f.account.invalidate();
 assert.deepEqual(f.account.snapshot(),{status:'loading'});
 const old=f.account.refresh();f.account.clear('signed-out');pending.resolve(f.data.self);await old;
 assert.deepEqual(f.account.snapshot(),{status:'signed-out'});
 f.account.request=async path=>path.includes('auth/self')?{user:{id:'b',email:'b@example.test'}}:path.includes('app-ctx')?{teams:[],workspaces:[]}:{projects:[]};
 await f.account.refresh();assert.equal(f.account.snapshot().user.id,'b');assert.deepEqual(f.account.snapshot().counts,{organizations:0,workspaces:0,projects:0});
});
test('missing session, access failures, malformed responses and timeouts never fabricate zero counts',async()=>{
 const f=fixture();f.data.self={};await f.account.refresh();assert.equal(f.account.snapshot().status,'signed-out');assert.equal(f.reads.length,1);
 for(const failure of [new Error('NAS request failed: HTTP 401'),new Error('NAS request failed: HTTP 403'),new Error('The operation was aborted due to timeout')]){
  f.account.invalidate();f.account.request=async()=>{throw failure};await f.account.refresh();
  assert.equal(f.account.snapshot().status,failure.message.includes('401')?'signed-out':'error');assert.equal(f.account.snapshot().counts,undefined);
 }
 f.account.invalidate();f.account.request=async path=>path.includes('auth/self')?{user:{id:'b',email:'b@example.test'}}:{};
 await f.account.refresh();assert.equal(f.account.snapshot().status,'error');assert.equal(f.account.snapshot().counts,undefined);
});
test('concurrent refreshes share one read and disposal ignores pending results',async()=>{
 const f=fixture(),pending=deferred();let reads=0;f.account.request=()=>{reads++;return pending.promise};
 const a=f.account.refresh(),b=f.account.refresh();assert.equal(a,b);assert.equal(reads,1);f.account.dispose();pending.resolve(f.data.self);await a;
 assert.equal(f.account.snapshot().status,'loading');assert.equal(reads,1);
});
