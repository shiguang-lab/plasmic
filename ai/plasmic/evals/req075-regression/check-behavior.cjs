// Supplemental evaluation of public model expressions; never substitutes for Preview.
// Input: normalized {pagePath: {nodeName: props}} from a full public readback.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const model = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const cases = [];
const roles = ['管理员', '运营', '只读'];
const statuses = ['初始化', '圈选中', '启用', '圈选失败', '停用', '重新启用圈选中', '重新启用圈选失败'];
function evaluate(value, context) {
  if (typeof value !== 'string' || !value.startsWith('{{')) return value;
  return vm.runInNewContext('(' + value.slice(2, -2).trim() + ')', context, {timeout:1000});
}
function context(role, status='启用') {
  return {$state:{role,applied:{},tabs:{activeKey:'all'},rows:[],sqlEditor:{value:''}},$ctx:{query:{role,status}},$refs:{regularForm:{validateFields:async()=>({})},onetimeForm:{validateFields:async()=>({})}},$globalActions:{'plasmic-antd6-config-provider.showMessage':()=>{}}};
}
async function check(name, fn) {
  try {await fn();cases.push({name,passed:true});}
  catch(e) {cases.push({name,passed:false,error:e.message});}
}
(async()=>{
for(const [path,nodes] of Object.entries(model)) for(const role of roles) {
  await check(`menu ${path} ${role}`,()=>{
    const menu=evaluate(nodes.AppShell.menuItems,context(role));
    assert.equal(menu.length,1);assert.equal(menu[0].key,'groups');
    const visible=menu[0].children.filter(x=>!x.hidden);
    assert.deepEqual(Array.from(visible,x=>x.label),['客群列表','客群圈选器']);
    assert.deepEqual(Array.from(visible,x=>x.href),['/req-075/groups','/req-075/regular'].map(x=>x+'?role='+encodeURIComponent(role)));
    assert.deepEqual(Array.from(visible[0].children,x=>[x.key,x.hidden]),[['onetime',true],['detail',true]]);
  });
}
for(const role of roles) for(const status of statuses) for(const type of ['常规','一次性']) {
 await check(`row actions ${role} ${status} ${type}`,()=>{
  const ctx=context(role,status);ctx.row={id:42,name:'验收客群',key:'GROUP',type,status,owner:'经营 OS 管理员'};
  const props=model['/req-075/groups'].AllGroupsRowActions;
  const actions=evaluate(props.items,ctx);const keys=Array.from(actions,x=>x.key);
  const expected=['detail'];
  if(role!=='只读') {
    expected.push('edit');if(['初始化','圈选失败'].includes(status))expected.push('sql');expected.push('copy');
    if(['初始化','圈选失败','重新启用圈选失败'].includes(status))expected.push('launch');
    if(status==='初始化')expected.push('delete');
    if(role==='管理员'&&status==='启用')expected.push('disable','export');
    if(status==='停用')expected.push('enable');
  }
  assert.deepEqual(keys,expected);assert.equal(props.max,3);
  for(const key of ['delete','disable','enable','launch'])if(keys.includes(key))assert.ok(actions.find(x=>x.key===key).confirm);
 });
 await check(`application access ${role} ${status} ${type}`,()=>{
  for(const busy of [false,true]){const ctx=context(role,status);ctx.$state.applicationBusy=busy;
   assert.equal(evaluate(model['/req-075/detail'].OpenApplication.disabled,ctx),role==='只读'||status!=='启用'||busy);}
 });
}
for(const role of roles)for(const status of statuses)for(const type of ['常规','一次性'])await check(`record retry ${role} ${status} ${type}`,()=>{
 const ctx=context(role,status);ctx.$ctx.query.type=type;ctx.row={status:'失败'};
 const keys=Array.from(evaluate(model['/req-075/detail'].SelectionRecordsRowActions.items,ctx),x=>x.key);
 assert.deepEqual(keys,role!=='只读'&&type==='常规'&&['圈选失败','重新启用圈选失败'].includes(status)?['view','retry']:['view']);
});
for(const path of ['/req-075/regular','/req-075/onetime']) {
 for(const [label,sql,pass] of [
  ['valid',"SELECT uid, app_source FROM cdm_users WHERE app_source = 'TACO'",true],
  ['write',"DELETE FROM cdm_users WHERE app_source = 'TACO'",false],
  ['namespace',"SELECT uid, app_source FROM ods_users WHERE app_source = 'TACO'",false],
  ['missing field',"SELECT uid FROM cdm_users WHERE app_source = 'TACO'",false],
  ['wrong app',"SELECT uid, app_source FROM cdm_users WHERE app_source = 'PESO'",false],
  ['dangerous function',"SELECT uid, app_source, SLEEP(5) FROM cdm_users WHERE app_source = 'TACO'",false],
  ['multiple statements',"SELECT uid, app_source FROM cdm_users; SELECT uid, app_source FROM cdm_users WHERE app_source = 'TACO'",false],
  ['variable',"SELECT uid, app_source FROM cdm_users WHERE dt='${bizdate}' AND app_source = 'TACO'",false]
 ]) await check(`SQL ${path} ${label}`,async()=>{
   const ctx=context('管理员');ctx.$state.sqlEditor.value=sql;ctx.$state.preflight='success';ctx.$state.saved=true;
   await evaluate(model[path].ValidateSQL.onClick,ctx)();
   assert.equal(ctx.$state.validation,pass?'passed':'failed');assert.equal(ctx.$state.preflight,'idle');assert.equal(ctx.$state.saved,false);
 });
}
for(const role of roles) for(const [action,before,after] of [
 ['launch','初始化','圈选中'],['launch','圈选失败','圈选中'],['launch','重新启用圈选失败','重新启用圈选中'],
 ['enable','停用','重新启用圈选中'],['disable','启用','停用'],['delete','初始化',null],['copy','启用','初始化']
]) await check(`transition ${role} ${action} ${before}`,()=>{
 const ctx=context(role,before);ctx.row={id:42,name:'验收',key:'GROUP',status:before};ctx.$state.rows=[{...ctx.row}];
 evaluate(model['/req-075/groups'].AllGroupsRowActions.onAction,ctx)(action);
 if(role==='只读'||(action==='disable'&&role!=='管理员'))assert.equal(ctx.$state.rows[0].status,before);
 else if(action==='delete')assert.equal(ctx.$state.rows.length,0);
 else if(action==='copy'){assert.equal(ctx.$state.rows.length,2);assert.equal(ctx.$state.rows[0].status,after);assert.notEqual(ctx.$state.rows[0].key,'GROUP');assert.equal(ctx.$state.rows[1].status,before);}
 else assert.equal(ctx.$state.rows[0].status,after);
});
await check('list applied filters and market isolation',()=>{
 const ctx=context('管理员');ctx.$ctx.query={};ctx.$state.rows=[
  {id:1,name:'目标',key:'A',market:'MX',scenario:'客经',type:'常规',status:'启用',owner:'甲'},
  {id:2,name:'其他',key:'B',market:'MX',scenario:'贷后',type:'一次性',status:'初始化',owner:'乙'},
  {id:3,name:'目标',key:'C',market:'PE',scenario:'客经',type:'常规',status:'启用',owner:'甲'}];
 const data=()=>Array.from(evaluate(model['/req-075/groups'].AllGroupsTable.data,ctx).data,x=>x.id);
 assert.deepEqual(data(),[1,2]);ctx.$state.draft={keyword:'不存在'};assert.deepEqual(data(),[1,2]);
 for(const filter of [{scenario:'客经'},{type:'常规'},{status:'启用'},{keyword:'甲'}]){ctx.$state.applied={market:'MX',...filter};assert.deepEqual(data(),[1]);}
 ctx.$state.applied={market:'PE'};assert.deepEqual(data(),[3]);ctx.$state.applied={market:'MX',keyword:'不存在'};assert.deepEqual(data(),[]);
});
await check('reenable retry preserves history and reports pending state',()=>{
 const ctx=context('管理员','重新启用圈选失败');ctx.$state.selectionFilters={};ctx.$state.selectionRetry=true;
 const nodes=model['/req-075/detail'];assert.equal(evaluate(nodes.GroupStatus.text,ctx),'重新启用圈选中');
 assert.equal(evaluate(nodes.StatusMetricText.__text,ctx),'重新启用圈选中');assert.equal(evaluate(nodes.SelectionResult.__text,ctx),'重新启用圈选中');
 const records=evaluate(nodes.SelectionRecordsTable.data,ctx).data;
 assert.deepEqual(Array.from(records,x=>x.status),['进行中','成功','失败']);assert.equal(records[0].count,0);
});
for(const path of ['/req-075/regular','/req-075/onetime'])for(const failed of [false,true])await check(`preflight lifecycle ${path} ${failed?'failure':'success'}`,async()=>{
 const ctx=context('管理员');ctx.$state.validation='passed';ctx.$state.sqlEditor.value=failed?'SELECT missing_partition':'SELECT ready';
 const timers=[];ctx.setTimeout=fn=>timers.push(fn);
 const node=model[path][path.endsWith('regular')?'SubmitSQL':'PreflightSQL'];
 await evaluate(node.onClick,ctx)();assert.equal(ctx.$state.preflight,'running');assert.equal(ctx.$state.preflightOpen,true);assert.equal(timers.length,1);
 timers[0]();assert.equal(ctx.$state.preflight,failed?'failed':'success');
});
await check('application native busy props',()=>{
 const modal=model['/req-075/detail'].ApplicationModal;
 for(const busy of [false,true]){const ctx=context('管理员');ctx.$state.applicationBusy=busy;
  for(const prop of ['okButtonProps','cancelButtonProps'])assert.equal(evaluate(modal[prop],ctx).disabled,busy);
  assert.equal(evaluate(modal.confirmLoading,ctx),busy);
 }
});
for(const [table,stateKey,kindKey,kinds] of [
 ['SelectionRecordsTable','selectionFilters','trigger',['上线','手动圈选']],
 ['ApplicationRecordsTable','applicationFilters','type',['营销活动','通知触达']]
]) await check(`record filters ${table}`,()=>{
 const ctx=context('管理员');ctx.$state[stateKey]={};ctx.$state.newApplications=[];
 const data=()=>Array.from(evaluate(model['/req-075/detail'][table].data,ctx).data,x=>x.id);
 assert.deepEqual(data(),[1,2]);
 for(const [filter,expected] of [
  [{[kindKey]:kinds[0]},[1]],[{[kindKey]:kinds[1]},[2]],
  [{status:'成功'},[1]],[{status:'失败'},[2]],
  [{start:'2026-10-06'},[1]],[{end:'2026-10-05'},[2]],
  [{start:'2026-10-05',end:'2026-10-06'},[1,2]],
  [{start:'2026-10-07'},[]],[{status:'成功',[kindKey]:kinds[1]},[]]
 ]){ctx.$state[stateKey]=filter;assert.deepEqual(data(),expected);}
 ctx.$state[stateKey]={};assert.deepEqual(data(),[1,2]);
});
await check('retention choices preserve all source-required options',()=>{
 assert.deepEqual(Array.from(model['/req-075/regular'].Retention.options,x=>x.value),['3 天','7 天','30 天','60 天','180 天','长期']);
});
const result={scope:'public model expression checks; not rendered Preview or backend integration',passed:cases.every(x=>x.passed),cases};
console.log(JSON.stringify(result,null,2));process.exitCode=result.passed?0:1;
})();
