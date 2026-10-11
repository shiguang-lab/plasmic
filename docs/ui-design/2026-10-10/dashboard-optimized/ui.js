const q = new URLSearchParams(location.search);
const requested = q.get('screen') || 'projects';
const key = requested==='new-project-workspace'?'new-project':requested;
const context = requested==='new-project-workspace'?'workspace':q.get('context');
const listView = key==='list'||q.get('view')==='list';
const p = {
 grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',list:'M8 5h13 M8 12h13 M8 19h13 M3 5h.01 M3 12h.01 M3 19h.01',
 folder:'M3 7V5h6l2 2h10v13H3z',plus:'M12 4v16 M4 12h16',search:'M16 16l5 5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',frame:'M3 8h18 M3 16h18 M8 3v18 M16 3v18',user:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-3a8 8 0 0 1 16 0v3',down:'M7 10l5 5 5-5',right:'M9 5l7 7-7 7',more:'M5 12h.01 M12 12h.01 M19 12h.01',book:'M3 3h7l2 2 2-2h7v18h-7l-2 2-2-2H3z M12 5v18',settings:'M4 7h16 M4 17h16 M8 4v6 M16 14v6',close:'M5 5l14 14 M19 5L5 19',edit:'M4 16L16 4l4 4L8 20H4z',layers:'M2 7l10-5 10 5-10 5z M2 12l10 5 10-5 M2 17l10 5 10-5',database:'M3 5c0-4 18-4 18 0v14c0 4-18 4-18 0z M3 5c0 4 18 4 18 0 M3 12c0 4 18 4 18 0',help:'M12 17h.01 M9 8a3 3 0 1 1 4 3l-1 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',check:'M5 12l4 4L19 6',copy:'M8 8h13v13H8z M16 8V3H3v13h5',move:'M4 12h16 M14 6l6 6-6 6',trash:'M4 6h16 M9 6V3h6v3 M6 6l1 15h10l1-15 M10 10v7 M14 10v7',out:'M9 4H3v16h6 M9 12h12 M16 7l5 5-5 5',collapse:'M9 3v18 M3 3h18v18H3z',arrow:'M7 17L17 7 M7 7h10v10'
};
const I = n => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${p[n] || p.frame}"/></svg>`;
const go = (screen, text, cls = '', icon = '') => `<a class="${cls}" href="?screen=${screen}">${icon ? I(icon) : ''}${text}</a>`;
const btn = (screen, text, cls = '', icon = '', label = '') => `<button class="${cls}" ${screen ? `data-screen="${screen}"` : ''} ${label ? `aria-label="${label}"` : ''}>${icon ? I(icon) : ''}${text}</button>`;
const av = '<span class="avatar">YA</span>';
const selectedWorkspace=q.get('workspace')||'all';
const names = ['REQ075 客群管理 · 需求对齐重生成', 'Admin Templates'];
const dates = ['2026年10月10日 09:51', '2026年10月9日 14:43'];
const scoped = ['workspace','data','workspace-menu','share','share-roles'].includes(key)||['workspace','data'].includes(context);
const personal = key.startsWith('playground')||context==='playground'||context==='playground-data';
const active = personal ? 'playground' : scoped ? 'workspace' : key === 'org'||context==='org' ? 'org' : 'projects';
function sidebar() {
 return `<aside><div class="identity">${go('account-menu', `${av}<strong>yanxianliang</strong>${I('down')}`, 'account')}</div><nav>${go('projects','所有项目','nav '+(active==='projects'?'active':''),'grid')}${go('playground','我的试验场','nav '+(active==='playground'?'active':''),'frame')}</nav><div class="nav-heading">组织${btn('','', 'icon-button','plus','新建组织')}</div><div class="org-nav"><button class="tree-toggle" aria-label="折叠组织导航">${I('down')}</button>${go('org','<span class="org-avatar">s</span>shuhe','org-link '+(active==='org'?'active':''))}</div><div class="tree-children">${go('workspace','Prototypes','nav '+(active==='workspace'?'active':''),'folder')}</div><div class="sidebar-bottom">${btn('','新建组织','nav','plus')}${go('https://docs.plasmic.app/','文档','nav','book').replace('href="?screen=https://docs.plasmic.app/"','href="https://docs.plasmic.app/"')}${(scoped||key==='org'||context==='org')?btn('','帮助','nav','help'):''}</div></aside>`;
}
function shell(content, path='所有项目') {
 return `<div class="desktop-bar"><div class="traffic"><b></b><b></b><b></b></div><span class="app-brand">${I('layers')}Plasmic</span><span class="window-title">${path}</span></div>${sidebar()}<main><div class="context-bar">${btn('','', 'icon-button collapse-nav','collapse','折叠侧栏')}<div class="breadcrumb">${scoped?`${go('org','shuhe')}${I('right')}<span>Prototypes</span>`:personal?'个人工作区':(key==='org'||context==='org')?'组织': '项目浏览器'}</div></div><div class="content">${content}</div></main>`;
}
function heading(title, right, meta='') {
 return `<header class="page-heading"><div><h1>${title}</h1>${meta?`<p>${meta}</p>`:''}</div><div class="head-actions">${right}</div></header>`;
}
const create = () => btn('new-project','新建项目','primary','plus');
function toolbar(list=false, data=false) {
 return `<div class="toolbar"><div class="tabs">${data||scoped||personal?`${go(personal?'playground':'workspace','项目',!data?'selected':'')}${go(personal?'playground-data':'data','数据源',data?'selected':'')}`:`<span class="selected">项目 <small>${selectedWorkspace==='playground'?0:2}</small></span>`}</div><div class="browse-tools">${!data?`${!scoped&&!personal&&context!=='org'&&(key==='projects'||['list','filter','search-empty','sort','project-menu','rename','account-menu','new-project','duplicate'].includes(key))?btn('filter',selectedWorkspace==='prototypes'?'Prototypes':selectedWorkspace==='playground'?'我的试验场':'全部工作区','quiet','down'):''}<label class="search">${I('search')}<input placeholder="搜索项目…" aria-label="搜索项目" value="${key==='search-empty'?'不存在的项目':''}"></label>${btn('sort','最近修改','quiet','down')}<div class="view-switch"><button class="icon-button ${!list?'selected':''}" data-view="grid" aria-label="网格视图">${I('grid')}</button><button class="icon-button ${list?'selected':''}" data-view="list" aria-label="列表视图">${I('list')}</button></div>`:''}</div></div>`;
}
function cover(i) {
 return `<div class="cover cover-${i}">${av}<div class="cover-canvas"><div class="corner top-left"></div><div class="corner top-right"></div><div class="corner bottom-left"></div><div class="corner bottom-right"></div><span class="cover-symbol">${I(i?'layers':'frame')}</span><strong>${i?'AT':'REQ075'}</strong><div class="cover-rule"></div></div><span class="cover-caption">项目</span></div>`;
}
function cards(list=false, withCreate=true, grouped=false) {
 return `<div class="projects ${list?'list':'grid'}">${list?'<div class="list-head"><span>项目名称</span><span>工作区</span><span>最后修改</span><span></span></div>':''}${names.map((n,i)=>`<article class="project" data-project="${i}">${list?`<div class="list-symbol">${I(i?'layers':'frame')}</div>`:cover(i)}<div class="project-info"><div class="project-title">${key==='rename'&&!i?`<input class="rename-input" aria-label="项目名称" value="${n}">`:`<strong title="${n}">${n}</strong>`}${key==='project-menu'&&!i?btn('rename','','rename icon-button','edit','重命名项目'):''}</div>${!list?`<div class="project-meta">${!grouped?go('workspace','Prototypes'):''}<span>${i?'10月9日':'10月10日'}修改</span></div>`:''}</div>${list?`${go('workspace','Prototypes','workspace-cell')}<span class="date-cell">${dates[i]}</span>`:''}<div class="card-actions">${av}${btn('project-menu','','icon-button more-button','more','项目操作')}</div></article>`).join('')}${!list&&withCreate?`<button class="new-tile" data-screen="new-project"><span class="new-tile-symbol">${I('plus')}</span><strong>新建项目</strong><span>从空白画布开始</span></button>`:''}</div>`;
}
function all(list=false, empty=false) {
 return shell(heading('所有项目',create())+toolbar(list)+(selectedWorkspace==='playground'?`<div class="empty-state">${I('folder')}<h2>此工作区暂无项目</h2><p>当前筛选：我的试验场</p>${btn('projects','清除筛选','secondary')}</div>`:empty?`<div class="empty-state">${I('search')}<h2>没有符合搜索条件的项目</h2><p>试试其他名称，或清空搜索条件。</p>${btn('projects','清空搜索','secondary')}</div>`:cards(list)));
}
function workspace(data=false) {
 const title=personal?'我的试验场':'Prototypes';
 return shell(heading(title,(personal?'':btn('share','分享','secondary','user')+btn('workspace-menu','','icon-button','more','工作区操作'))+(data?'':create()), personal?'个人工作区':`工作区 <span class="meta-dot">·</span> ${av} 1 位成员`)+toolbar(listView,data)+(data?`<div class="data-heading"><h2>内容管理系统（CMS）</h2>${btn('','新建 CMS','secondary','plus')}</div><div class="empty-state cms-empty">${I('database')}<h2>此工作区暂无 CMS</h2><p>创建 CMS，管理项目使用的内容。</p>${btn('','新建 CMS','secondary','plus')}</div>`:personal?`<div class="empty-state personal-empty"><div class="blank-frame">${I('frame')}</div><h2>从你的第一张画布开始</h2><p>此工作区暂无项目。</p>${create()}</div>`:cards(listView,true,true)),title);
}
function org() {
 return shell(heading('shuhe',btn('','新建工作区','primary','plus')+btn('','', 'icon-button','settings','组织设置'),'组织 · 1 位成员 · 2 项目')+toolbar(listView)+`<div class="org-section-label">工作区 <small>1</small></div><section class="workspace-section"><header><span class="folder-mark">${I('folder')}</span><div>${go('workspace','Prototypes','workspace-name')}<p>${av} 1 位成员</p></div><div class="head-actions">${btn('share','分享','secondary','user')}${btn('new-project','新建项目','secondary','plus')}${btn('workspace-menu','','icon-button','more','工作区操作')}</div></header>${cards(listView,false,true)}<div class="cms-strip"><span>${I('database')}内容管理系统（CMS）<small>暂无 CMS</small></span>${btn('','新建 CMS','quiet','plus')}</div></section>`,'shuhe');
}
const menuItems=[['settings','配置项目',''],['copy','复制项目','duplicate'],['move','移至工作区',''],['layers','设为工作区模板',''],['trash','删除项目','']];
function menu(items,cls) {return `<div class="menu ${cls}" role="menu">${items.map(([icon,text,screen])=>`${icon==='trash'?'<hr>':''}${btn(screen,text,icon==='trash'?'danger':'',icon)}`).join('')}</div>`;}
function dialog(title,body,footer='',cls='') {return `<div class="scrim"><section class="dialog ${cls}"><header><h2>${title}</h2>${btn(scoped?'workspace':'projects','','icon-button','close','关闭')}</header>${body}${footer?`<footer>${footer}</footer>`:''}</section></div>`;}
const roles=['查看者','评论者','内容编辑者','设计者','开发者'];
function share() {
 return workspace()+dialog('工作区分享',`<div class="share-context">${I('folder')}<strong>Prototypes</strong></div><div class="invite-title">邀请成员</div><div class="invite-row"><input placeholder="通过邮箱邀请…" aria-label="邀请邮箱">${btn('share-roles','开发者','role-button','down')}${btn('','邀请','primary')}</div><div class="member-heading">谁有访问权限</div><div class="member"><span class="org-avatar">s</span><div><strong>shuhe organization</strong><p>通过组织访问此工作区</p></div><span class="spacer"></span>${go('org','管理','text-link')}</div><div class="member">${av}<div><strong>yanxianliang</strong></div><span class="spacer"></span><span class="subtle">所有者</span></div>`, '', 'share-dialog');
}
let out;
if(key==='org')out=org();
else if(['workspace','workspace-menu','data','playground','playground-data'].includes(key))out=workspace(key==='data'||key==='playground-data');
else if(['share','share-roles'].includes(key))out=share();
else if(context==='org')out=org();
else if(scoped||personal)out=workspace(context==='data'||context==='playground-data');
else out=all(listView,key==='search-empty');
if(key==='project-menu')out+=menu(menuItems,'project-menu');
if(key==='workspace-menu')out+=menu([['move','移动到其他组织',''],['trash','删除 工作区','']],'workspace-menu');
if(key==='sort')out+=menu([['check','最近修改','projects'],['','按名称排序','projects']],'sort-menu');
if(key==='filter')out+=`<div class="menu filter-menu"><div class="menu-caption">按工作区筛选</div><button data-filter="all">${I('check')}全部工作区</button><hr><button data-filter="prototypes">${I('folder')}Prototypes</button><button data-filter="playground">${I('frame')}我的试验场</button></div>`;
if(key==='account-menu')out+=`<div class="menu account-menu"><div class="account-caption">${av}<strong>yanxianliang</strong></div><hr>${btn('','设置','','settings')}${btn('','退出登录','','out')}</div>`;
if(key==='new-project')out+=`<section class="creation-panel"><header><strong>新建项目</strong>${btn(context==='workspace'?'workspace':'projects','','icon-button','close','取消')}</header><div class="menu-caption">Blank</div><button class="blank-option">${I('frame')}<div><strong>Blank project</strong><span>从空白画布开始</span></div>${I('arrow')}</button><footer>${btn(context==='workspace'?'workspace':'projects','取消','quiet')}</footer></section>`;
if(key==='duplicate')out+=dialog('复制项目',`<label class="field">项目名称<input value="Copy of REQ075 客群管理 · 需求对齐重生成" aria-label="副本名称"></label><label class="field">目标工作区<select aria-label="目标工作区"><option value="">选择工作区…</option><option>Prototypes</option></select></label>`,`<button class="primary" disabled>复制项目</button>${btn('projects','取消','secondary')}`);
if(key==='share-roles')out+=`<div class="menu role-menu">${roles.map(r=>btn('share',r,'',r==='开发者'?'check':'')).join('')}</div>`;
document.getElementById('root').innerHTML=out;
const overlays=new Set(['new-project','project-menu','rename','duplicate','workspace-menu','share','share-roles','sort','account-menu']);
document.querySelectorAll('[data-screen]').forEach(b=>b.addEventListener('click',()=>{const next=b.dataset.screen;const base=context||(personal?'playground':scoped?'workspace':key==='org'?'org':'projects');location.search='?screen='+next+(overlays.has(next)?'&context='+base:'');}));
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{location.search='?screen=projects&workspace='+b.dataset.filter;}));
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{q.set('view',b.dataset.view);if(key==='list')q.set('screen','projects');location.search=q.toString();}));
document.querySelector('.collapse-nav')?.addEventListener('click',()=>document.body.classList.toggle('nav-collapsed'));
document.querySelector('.tree-toggle')?.addEventListener('click',()=>document.querySelector('.tree-children').classList.toggle('hidden'));
document.querySelector('.search input')?.addEventListener('input',e=>{const s=e.target.value.toLowerCase();document.querySelectorAll('[data-project]').forEach(el=>el.hidden=!names[Number(el.dataset.project)].toLowerCase().includes(s));document.querySelector('.new-tile')?.classList.toggle('hidden',!!s)});
if(key==='duplicate')document.querySelector('select').addEventListener('change',e=>document.querySelector('.dialog button[disabled]')?.removeAttribute('disabled'));
// Anchor overlays to their originating controls so they stay aligned at different widths.
const anchors={ 'project-menu':['.project:first-child .more-button','.project-menu'], 'sort':['.browse-tools [data-screen="sort"]','.sort-menu'], 'filter':['.browse-tools [data-screen="filter"]','.filter-menu'], 'new-project':['.page-heading [data-screen="new-project"]','.creation-panel'], 'workspace-menu':['.page-heading [data-screen="workspace-menu"]','.workspace-menu'], 'share-roles':['.role-button','.role-menu'] };
if(anchors[key]) { const [source,target]=anchors[key]; const a=document.querySelector(source); const m=document.querySelector(target); if(a&&m) { const r=a.getBoundingClientRect(); m.style.left=(r.right-m.offsetWidth)+'px';m.style.top=(r.bottom+8)+'px';m.style.right='auto';} }
