const {test}=require('node:test');
const assert=require('node:assert/strict');
const {IslandAccount}=require('../src/island-account.cjs');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
function fixture(){
 let time=1, reads=[], notices=0;
 const data={self:{user:{id:'a',firstName:'Li',lastName:'Lei',email:'li@example.test'}},app:{teams:[{id:'t',name:'Team'}],workspaces:[{id:'w',name:'Work',teamId:'t'}]},projects:{projects:[{id:'p'},{id:'p2'}]}};
 const request=async path=>{reads.push(path);return path.includes('auth/self')?data.self:path.includes('app-ctx')?data.app:data.projects};
 const account=new IslandAccount(()=>account.request("/api/v1/auth/self"),request,()=>notices++,()=>time);
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
test('forced navigation refreshes share pending identity and summary reads, then fetch again after completion',async()=>{
 const f=fixture(),identity=deferred(),summary=deferred();const original=f.account.request;
 f.account.request=path=>path.includes('auth/self')?(f.reads.push(path),identity.promise):path.includes('app-ctx')?(f.reads.push(path),summary.promise):original(path);
 const first=f.account.refresh();
 assert.equal(f.account.refresh(null,true),first);
 assert.equal(f.account.refresh(null,true),first);
 assert.equal(f.reads.length,1);
 identity.resolve(f.data.self);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.account.refresh(null,true),first,'navigation must also share the remaining summary reads');
 assert.equal(f.reads.length,3);
 summary.resolve(f.data.app);await first;
 f.account.request=original;
 await f.account.refresh();assert.equal(f.reads.length,3,'normal polling retains its existing interval');
 await f.account.refresh(null,true);assert.equal(f.reads.length,6,'a later navigation still checks the server');
});
test('forced refresh retries a failed identity check without waiting for the summary interval',async()=>{
 const f=fixture();f.account.request=async()=>{throw new Error('Offline')};
 await f.account.refresh();assert.equal(f.account.snapshot().status,'error');
 f.account.request=async path=>{f.reads.push(path);return path.includes('auth/self')?f.data.self:path.includes('app-ctx')?f.data.app:f.data.projects};
 await f.account.refresh(null,true);
 assert.equal(f.account.snapshot().status,'ready');assert.equal(f.reads.length,3);
});
test('an auth invalidation starts a new forced read and rejects the old account result',async()=>{
 const f=fixture(),oldIdentity=deferred();const original=f.account.request;
 f.account.request=()=>oldIdentity.promise;
 const old=f.account.refresh();f.account.invalidate();
 f.data.self={user:{id:'replacement'}};f.account.request=original;
 const next=f.account.refresh(null,true);assert.notEqual(next,old);await next;
 oldIdentity.resolve({user:{id:'old-account'}});await old;
 assert.equal(f.account.snapshot().user.id,'replacement');assert.equal(f.reads.length,3);
});
test('navigation to a different workspace does not share the previous workspace task',async()=>{
 const f=fixture(),oldIdentity=deferred();const original=f.account.request;
 f.account.request=()=>oldIdentity.promise;
 const old=f.account.refresh('old-workspace');f.account.request=original;
 const next=f.account.refresh('new-workspace',true);assert.notEqual(next,old);await next;
 oldIdentity.resolve({user:{id:'old-account'}});await old;
 assert.equal(f.account.snapshot().user.id,'a');assert.equal(f.reads.length,3);
});
test('workspace statistics map nested teams and deduplicate effective users without counting invitations or blocked users',async()=>{
 const f=fixture();f.data.self.user.displayName='Displayed name';f.data.app.workspaces=[{id:'w',name:'Work',team:{id:'t'}}];f.data.projects.projects=[{id:'p',workspaceId:'w'},{id:'other',workspaceId:'another'}];
 const original=f.account.request;
 f.account.request=async path=>path.includes('/workspaces/')?{workspace:{team:{id:'t'}},perms:[
  {userId:'a',teamId:'t',accessLevel:'owner'},{userId:'a',workspaceId:'w',accessLevel:'editor'},
  {userId:'b',workspaceId:'w',accessLevel:'viewer'},{userId:'c',workspaceId:'w',accessLevel:'blocked'},
  {email:'invited@example.test',workspaceId:'w',accessLevel:'viewer'},
 ]}:original(path);
 await f.account.refresh('w');assert.equal(f.account.snapshot().user.name,'Displayed name');assert.deepEqual(f.account.snapshot().workspaces,[{id:'w',name:'Work',teamId:'t',projects:1,members:2}]);
 f.account.invalidate(false);f.account.request=async path=>path.includes('/workspaces/')?{workspace:{team:{id:'t'}},perms:[{userId:'a',workspaceId:'w',accessLevel:'viewer'}]}:original(path);
 await f.account.refresh('w');assert.equal(f.account.snapshot().workspaces[0].members,undefined,'partial inherited permission visibility is not a complete user count');
});
test('workspace navigation and sign-out ignore late membership reads',async()=>{
 const f=fixture(),pending=deferred();f.data.app.workspaces=[{id:'w',name:'Work',team:{id:'t'}}];const original=f.account.request;
 f.account.request=path=>path.includes('/workspaces/')?pending.promise:original(path);
 const load=f.account.refresh('w');await new Promise(resolve=>setImmediate(resolve));f.account.clear('signed-out');pending.resolve({workspace:{team:{id:'t'}},perms:[]});await load;assert.equal(f.account.snapshot().status,'signed-out');
});
