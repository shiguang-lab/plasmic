const key = new URLSearchParams(location.search).get('screen') || 'home';
const paths = {
  grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  folder:'M3 7V5h6l2 2h10v13H3z', plus:'M12 4v16 M4 12h16',
  search:'M16 16l5 5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  layers:'M2 7l10-5 10 5-10 5z M2 12l10 5 10-5 M2 17l10 5 10-5',
  image:'M3 3h18v18H3z M3 16l6-6 7 7 3-3 2 2 M15 7h.01',
  spark:'M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z',
  settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z',
  user:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-3a8 8 0 0 1 16 0v3',
  arrow:'M5 12h14 M13 6l6 6-6 6', back:'M19 12H5 M11 6l-6 6 6 6',
  chevron:'M8 5l7 7-7 7', down:'M5 9l7 7 7-7', close:'M5 5l14 14 M19 5L5 19',
  undo:'M8 5L3 10l5 5 M3 10h11a7 7 0 0 1 0 14', redo:'M16 5l5 5-5 5 M21 10H10a7 7 0 0 0 0 14',
  pointer:'M5 3l14 10-7 1-3 7z', hand:'M7 12V6a2 2 0 0 1 4 0v5 M11 11V4a2 2 0 0 1 4 0v7 M15 11V6a2 2 0 0 1 4 0v9c0 5-3 7-6 7-4 0-6-3-9-8a2 2 0 0 1 3-2l2 2',
  frame:'M3 8h18 M3 16h18 M8 3v18 M16 3v18',
  more:'M5 12h.01 M12 12h.01 M19 12h.01', desktop:'M3 3h18v14H3z M8 22h8 M12 17v5',
  tablet:'M5 2h14v20H5z M12 18h.01', mobile:'M7 2h10v20H7z M12 18h.01',
  comment:'M3 3h18v14H9l-6 4z', check:'M4 12l5 5L20 6',
  history:'M3 12a9 9 0 1 0 3-7 M3 3v6h6 M12 7v6l4 2',
  link:'M9 15l6-6 M8 16l-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0 M16 8l2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0',
  book:'M3 3h7l2 2 2-2h7v18h-7l-2 2-2-2H3z M12 5v18',
  database:'M3 5c0-4 18-4 18 0v14c0 4-18 4-18 0z M3 5c0 4 18 4 18 0 M3 12c0 4 18 4 18 0',
  lock:'M5 10h14v11H5z M8 10V6a4 4 0 0 1 8 0v4',
  chart:'M3 3v18h18 M7 17V9 M12 17V5 M17 17v-6', send:'M3 3l18 9-18 9 4-9z M7 12h14',
  stop:'M6 6h12v12H6z', refresh:'M20 8a9 9 0 0 0-16-1 M20 3v5h-5 M4 16a9 9 0 0 0 16 1 M4 21v-5h5'
};
const I=n=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[n]||paths.grid}"/></svg>`;
const B=(text,style='',icon='')=>`<button class="${style}">${icon?I(icon):''}${text}</button>`;
const IB=n=>B('','icon-btn',n);
const logo=()=>`<div class="logo"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M7 3h14a8 8 0 0 1 0 16h-7l4-5h3a3 3 0 0 0 0-6H11z M11 13h7l-4 5h-3a3 3 0 0 0 0 6h10l-4 5h-6a8 8 0 0 1 0-16z"/></svg>Plasmic</div>`;
const field=(label,value='',type='text')=>`<div class="field"><label>${label}</label><input type="${type}" value="${value}" placeholder="${value?'':'请输入'}"></div>`;
const select=(values,active)=>`<select>${values.map(v=>`<option ${v===active?'selected':''}>${v}</option>`).join('')}</select>`;
const tabs=(items,active)=>`<div class="tabs">${items.map(x=>B(x,x===active?'active':'')).join('')}</div>`;
const avatar=(s='林')=>`<span class="avatar">${s}</span>`;
const nav=(items,active)=>items.map(([label,icon])=>`<div class="nav-item ${label===active?'active':''}">${I(icon)}${label}</div>`).join('');
const hint=t=>`<div class="hint">${t}</div>`;
const setting=(title,sub,on=true)=>`<div class="setting-row"><div>${title}<p>${sub}</p></div><span class="switch ${on?'':'off'}"></span></div>`;
const table=(cols,rows)=>`<table class="dark-table"><thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const groupNames=['高价值企业客户','海外市场潜在客户','产品试用用户','行业峰会参会者','竞品流失用户','华东区域重点客户'];
const bizForm=()=>`${field('客群名称','高价值企业客户')}<div class="field"><label>类型</label>${select(['企业客群','活动客群','行业客群'])}</div>${field('负责人','林悦')}<div class="field"><label>备注</label><textarea placeholder="补充客群说明"></textarea></div>`;
function business(kind='list',opts={}){
  const mobile=kind==='mobile';
  const title={list:'客群列表',query:'客群圈选器',form:'新建一次性客群',detail:'客群详情',mobile:'客群列表'}[kind]||'客群列表';
  let content='';
  if(kind==='list') content=`<div class="biz-filters"><span>市场</span>${select(['MX','CN'])}<span>状态</span>${select(['全部','活跃'])}<input placeholder="搜索客群名称或关键词">${B('查询','primary')}${B('重置')}</div><div class="biz-tabs"><span class="active">全部客群 (6)</span><span>我负责的 (3)</span><span class="spacer"></span>${B('新建客群','primary','plus')}</div><div class="biz-table ${opts.selected?'selected':''}">${opts.selected?'<div class="selection-tools">Table　 ·　 编辑内容　 ·　 AI 修改　 ·　 ⋯</div>':''}<table><thead><tr><th>□</th><th>客群名称</th><th>类型</th><th>状态</th>${opts.added?'<th>负责人</th>':''}<th>更新时间</th><th>操作</th></tr></thead><tbody>${groupNames.map((g,i)=>`<tr><td>□</td><td>${g}</td><td>${['企业客群','潜在客群','行业客群','活动客群'][i%4]}</td><td><span class="biz-status">${i===4?'待激活':'活跃'}</span></td>${opts.added?`<td>${i%2?'张三':'林悦'}</td>`:''}<td>2026-10-0${9-i} 14:24</td><td class="actions">查看　编辑　⋯</td></tr>`).join('')}</tbody></table></div><div class="biz-pagination">共 6 条　 ‹　 <span style="color:#2563eb">1</span>　 ›　 20 条/页</div>`;
  if(kind==='query')content=`<div class="form-card"><h2>筛选条件</h2><p>添加条件，圈选符合要求的客户</p><div class="biz-filters">${select(['客户地区'])}${select(['等于'])}${select(['华东'])}${B('删除')}</div><div class="biz-filters">${select(['客户等级'])}${select(['等于'])}${select(['A'])}${B('删除')}</div>${B('添加条件','','plus')}</div><div class="form-card"><h2>圈选结果</h2><p>当前条件匹配 128 位客户</p>${B('保存为客群','primary')}</div>`;
  if(kind==='form')content=`<div class="form-card">${bizForm()}<div class="row">${B('取消')}${B('创建客群','primary')}</div></div>`;
  if(kind==='detail')content=`<div class="form-card"><h2>高价值企业客户</h2><p>企业客群　 ·　 活跃　 ·　 负责人 林悦</p><div class="form-row"><div><small>客户数量</small><h1>128</h1></div><div><small>本月新增</small><h1>24</h1></div></div></div><div class="form-card"><h2>基本信息</h2><p>地区：华东　　创建时间：2026-10-01</p><h2>活动记录</h2><p>10 月 09 日　更新客户筛选条件</p><p>10 月 06 日　新增 12 位客户</p></div>`;
  if(mobile)content=`<input placeholder="搜索客群"><div class="row" style="margin-top:18px">${B('全部客群')}${B('新建客群','primary')}</div>${groupNames.slice(0,3).map(g=>`<div class="mobile-card"><div class="row between"><strong>${g}</strong><span style="color:#34896a">活跃</span></div><p style="margin:10px 0">企业客群 · 负责人 林悦</p><small>更新于 10 月 09 日</small></div>`).join('')}`;
  return `<div class="business ${mobile?'mobile':''}"><aside class="biz-sidebar"><div class="biz-brand">◇ 经营 OS</div>${[['首页','grid'],['数据看板','chart'],['客户洞察','user'],['客群管理','layers'],['营销中心','spark'],['内容中心','book'],['自动化','link'],['系统设置','settings']].map(([t,i])=>`<div class="biz-nav ${t==='客群管理'?'active':''}">${I(i)}${t}</div>`).join('')}<div class="user">Market Team<br><small>市场部</small></div></aside><main class="biz-main"><div class="biz-top">${I('search')}${I('comment')}<span class="avatar" style="background:#2563eb;color:white">张</span></div><div class="biz-content"><h1>${title}</h1><p>${mobile?'管理客群，随时查看客户动态':'管理和运营客户客群，支持多维筛选与分组管理'}</p>${content}</div></main>${opts.drawer?`<div class="biz-drawer"><div class="row between"><h2>新建客群</h2>${I('close')}</div><div style="margin-top:36px">${bizForm()}</div><div class="footer">${B('取消')}${B('创建','primary')}</div></div>`:''}</div>`;
}
