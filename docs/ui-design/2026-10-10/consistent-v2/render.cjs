const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');
const root = __dirname;
const screens = JSON.parse(fs.readFileSync(path.join(root, 'screens.json'), 'utf8'));
const esc = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
(async () => {
  fs.mkdirSync(path.join(root, 'images'), { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const measurements = {};
  for (const [id, title] of screens) {
    await page.goto(pathToFileURL(path.join(root, 'screen.html')).href + '?screen=' + id);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(root, 'images', id + '.png') });
    measurements[id] = await page.evaluate(() => {
      const common = {};
      for (const el of document.querySelectorAll('[data-common]')) {
        const r = el.getBoundingClientRect();
        common[el.dataset.common] = { x: r.x, y: r.y, width: r.width, height: r.height, text: el.textContent.trim().replace(/\s+/g, ' ') };
      }
      for (const name of ['modal', 'footer', 'tabs']) {
        const el = document.querySelector('.modal' + (name === 'modal' ? '' : ' .' + name));
        if (el) { const r = el.getBoundingClientRect(); common['dialog-' + name] = { x: r.x, y: r.y, width: r.width, height: r.height }; }
      }
      for (const label of ['项目名称', '所属工作空间']) {
        const el = [...document.querySelectorAll('.modal-grid .field')].find(el => el.querySelector('label')?.textContent === label);
        if (el) { const r = el.getBoundingClientRect(); common[label] = { x: r.x, y: r.y, width: r.width, height: r.height }; }
      }
      const overflow = [...document.querySelectorAll('.left-panel,.right-panel,.modal,.settings-body,.cms-body')]
        .map(el => ({ element: el.className, bottom: el.getBoundingClientRect().bottom, right: el.getBoundingClientRect().right }))
        .filter(r => r.bottom > 1000 || r.right > 1600);
      return { common, overflow, width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight };
    });
    console.log(id + ' · ' + title);
  }
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  assert(errors.length === 0, 'Browser errors: ' + errors.join('; '));
  for (const [id, m] of Object.entries(measurements)) {
    assert(!m.overflow.length, `${id}: panel overflow ${JSON.stringify(m.overflow)}`);
    assert(m.width === 1600 && m.height === 1000, `${id}: page overflow ${m.width} × ${m.height}`);
  }
  const compare = (ids, name, includeText = true) => {
    const values = ids.map(id => {
      const v = { ...measurements[id].common[name] };
      if (!includeText) delete v.text;
      return JSON.stringify(v);
    });
    assert(values.every(v => v === values[0]), `Inconsistent ${name}: ${ids.join(', ')}`);
  };
  const editorIds = screens.map(s => s[0]).filter(id => measurements[id].common.actions && !['share', 'export', 'publish'].includes(id));
  compare(editorIds, 'actions');
  compare(editorIds.filter(id => !['readonly', 'save-error'].includes(id)), 'project');
  compare(editorIds, 'rail', false);
  compare(['focused', 'editor-light'], 'left');
  compare(['focused', 'editor-light'], 'inspector');
  compare(['focused', 'editor-light'], 'world');
  compare(['focused', 'editor-light'], 'composer');
  compare(['overview', 'zen'], 'world');
  compare(['share', 'export', 'publish'], 'actions');
  compare(['preview', 'preview-mobile', 'review'], 'preview-devices', false);
  for (const name of ['dialog-modal', 'dialog-footer', 'dialog-tabs']) {
    compare(['new-ai', 'new-template', 'new-blank'], name);
    compare(['share', 'export', 'publish'], name);
  }
  for (const name of ['项目名称', '所属工作空间']) compare(['new-ai', 'new-template', 'new-blank'], name);
  fs.writeFileSync(path.join(root, 'verification.json'), JSON.stringify({ size: '1600 × 1000', screenCount: screens.length, browserErrors: errors, sharedLayoutChecks: 'passed', measurements }, null, 2));
  const groups = [...new Set(screens.map(s => s[2]))];
  const galleryCss = `*{box-sizing:border-box}body{margin:0;background:#15161b;color:#edeef5;font:14px/1.6 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}header{padding:36px 40px 26px;border-bottom:1px solid #373842}h1{font-size:30px;margin:0}p{color:#9295a7;margin:8px 0}a{color:#bea5ff;text-decoration:none}nav{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}nav a,.tag{border:1px solid #373842;border-radius:8px;padding:7px 12px}.rules{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:24px}.rules div{background:#202128;padding:16px;border-radius:10px}.rules strong{display:block;margin-bottom:5px}.rules small{color:#9295a7}main{padding:0 40px 50px}h2{padding-top:28px;font-size:21px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}.card{border:1px solid #373842;border-radius:12px;background:#202128;overflow:hidden}.card img{width:100%;display:block}.caption{padding:16px 20px}.caption h3{margin:0;font-size:16px}.caption p{font-size:13px;margin:5px 0 14px}.links{display:flex;gap:18px;font-size:12px}.num{color:#9295a7;margin-right:10px}.scope{margin:24px 0;padding:18px;border:1px solid #373842;border-radius:10px}footer{padding:24px 40px;border-top:1px solid #373842;color:#9295a7}@media(max-width:900px){.grid{grid-template-columns:1fr}.rules{grid-template-columns:1fr 1fr}header,main{padding-left:20px;padding-right:20px}}`;
  const gallery = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Plasmic · 全页面 UI 图集 V2</title><style>${galleryCss}</style></head><body><header><h1>Plasmic · 全页面 UI 图集</h1><p>V2 · ${screens.length} 张统一设计稿 · 1600 × 1000 · 暗黑主题与无限画布</p><div class="rules"><div><strong>一个工作空间</strong><small>总览、聚焦与专注共用画布；面板不挤压画板。</small></div><div><strong>一套操作入口</strong><small>项目栏、预览、分享与工具轨道位置固定。</small></div><div><strong>一个属性结构</strong><small>设计 / 交互 / 数据；注册 Props 和事件名保持英文。</small></div><div><strong>一套主题规则</strong><small>浅色只改变编辑器配色，页面内容与布局保持一致。</small></div></div><nav>${groups.map((g,i)=>`<a href="#group-${i}">${g}</a>`).join('')}<a href="design-spec.html">一致性规范</a><a href="implementation-plan.html">改造计划</a></nav></header><main><div class="scope">浏览器中的登录、注册、重置密码和授权页面沿用现有界面；App 内登录状态与账户展示采用 2026.10.11 新版方案。其余页面覆盖用户侧页面与关键状态。内部运维、回调及旧版重复路由不作为独立设计页面。图中业务内容、计划、用量与接口为布局示例；这是产品设计稿，尚未接入真实运行逻辑。旧版独立生成图片不再作为当前方案。</div>${groups.map((g,i)=>`<section id="group-${i}"><h2>${g}</h2><div class="grid">${screens.filter(s=>s[2]===g).map(([id,title,group,desc])=>`<article class="card" id="${id}"><a href="images/${id}.png" target="_blank"><img src="images/${id}.png" alt="${esc(title)}" loading="lazy" width="1600" height="1000"></a><div class="caption"><h3><span class="num">${String(screens.findIndex(s=>s[0]===id)+1).padStart(2,'0')}</span>${esc(title)}</h3><p>${esc(desc)}</p><div class="links"><a href="images/${id}.png" target="_blank">查看原图 ↗</a><a href="screen.html?screen=${id}" target="_blank">查看 HTML 设计稿 ↗</a></div></div></article>`).join('')}</div></section>`).join('')}</main><footer>全部图片由共享 HTML/CSS 渲染。<a href="screens.json">页面清单</a> · <a href="verification.json">一致性检查</a> · <a href="design-spec.html">设计规范</a></footer></body></html>`;
  const currentGallery = gallery.replace('</header>', '<p><a href="../../2026-10-11/app-auth/index.html">App 登录与账户新版设计 · 12 张页面与状态图 ↗</a></p></header>');
  fs.writeFileSync(path.join(root, 'index.html'), currentGallery);
  const parentIndex = path.join(root, '..', 'index.html');
  const oldIndex = path.join(root, '..', 'index-v1.html');
  if (!fs.existsSync(oldIndex)) fs.copyFileSync(parentIndex, oldIndex);
  fs.writeFileSync(parentIndex, currentGallery.replace('<head>', '<head><base href="consistent-v2/">'));
  const contact = `<!doctype html><html><head><meta charset="utf-8"><style>body{background:#15161b;color:white;font:14px sans-serif;margin:20px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}img{width:100%;display:block}p{margin:6px 0 16px}</style></head><body><div class="grid">${screens.map(([id,title])=>`<div><img src="images/${id}.png"><p>${title}</p></div>`).join('')}</div></body></html>`;
  fs.writeFileSync(path.join(root, 'contact-sheet.html'), contact);
  await page.setViewportSize({ width: 1800, height: 1200 });
  await page.goto(pathToFileURL(path.join(root, 'contact-sheet.html')).href);
  await page.screenshot({ path: path.join(root, 'contact-sheet.png'), fullPage: true });
  await browser.close();
  console.log(`${screens.length} screens rendered; shared layout checks passed.`);
})().catch(e => { console.error(e); process.exit(1); });
