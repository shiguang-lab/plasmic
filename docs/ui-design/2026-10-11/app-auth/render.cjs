const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');
const root = __dirname;
const screens = JSON.parse(fs.readFileSync(path.join(root, 'screens.json'), 'utf8'));
const pageUrl = pathToFileURL(path.join(root, 'screen.html')).href;
const assert = (v, msg) => { if (!v) throw new Error(msg); };
(async () => {
  fs.mkdirSync(path.join(root, 'images'), { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const previewSource = pathToFileURL(path.resolve(root, '../../2026-10-10/consistent-v2/screen.html')).href;
  await page.goto(previewSource + '?screen=overview');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(root, 'images/canvas-dark.png') });
  await page.locator('.editor').evaluate(el => { el.classList.add('light'); el.style.color = 'var(--text)'; });
  await page.screenshot({ path: path.join(root, 'images/canvas-light.png') });
  const layouts = {};
  for (const s of screens) {
    await page.goto(pageUrl + '?state=' + s.id);
    await page.evaluate(() => document.fonts.ready);
    const metrics = await page.evaluate(() => {
      const rect = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
      const shared = Object.fromEntries([...document.querySelectorAll('[data-shared]')].map(el => [el.dataset.shared, rect(el)]));
      if (document.querySelector('.auth-actions>.primary')) shared.primary = rect(document.querySelector('.auth-actions>.primary'));
      const body = document.querySelector('.auth-body');
      const brand = document.querySelector('.chrome-brand');
      const settings = document.querySelector('.auth-settings');
      const controls = document.querySelector('.window-controls');
      const actions = document.querySelector('.auth-actions');
      const textBottom = body ? Math.max(...[...body.children].map(el => el.getBoundingClientRect().bottom)) : 0;
      const boundaries = [...document.querySelectorAll('.window-controls,.auth-settings,.chrome-brand,.auth-card,.hero,.app-content,.settings-body')].map(el => rect(el));
      return { shared, brand: brand ? rect(brand) : null, settings: settings ? rect(settings) : null, controls: rect(controls),
        settingsDrag: settings ? getComputedStyle(settings).webkitAppRegion : null,
        supportRows: document.querySelectorAll('.benefit-row,.login-step').length,
        standaloneStatusIcons: document.querySelectorAll('.status-icon').length,
        headingColor: body ? getComputedStyle(body.querySelector('h2')).color : null,
        foregroundColor: getComputedStyle(document.querySelector('.desktop')).color,
        textBottom, actionsTop: actions?.getBoundingClientRect().top, boundaries,
        providerCopy: /拾光|shiguang/i.test(document.getElementById('root').innerText),
        titleBars: document.querySelectorAll('.titlebar,.auth-header').length,
        windowControls: document.querySelectorAll('.window-controls button').length,
        dragRegion: getComputedStyle(document.querySelector('.window-drag-region')).backgroundColor,
        brokenImages: [...document.images].filter(im => !im.complete || !im.naturalWidth).length,
        passwordFields: document.querySelectorAll('input[type=password]').length };
    });
    if (s.id !== 'account') {
      assert(metrics.supportRows === 3, s.id + ': missing support information');
      assert(metrics.standaloneStatusIcons === 0, s.id + ': standalone status icon');
      assert(metrics.headingColor === metrics.foregroundColor, s.id + ': heading does not follow theme');
      assert(metrics.brand.y < 52, s.id + ': brand in window operation area');
      assert(metrics.settings.y === 72 && metrics.settings.y + metrics.settings.h <= 130, s.id + ': settings in content top corner');
      assert(metrics.settings.y >= metrics.controls.y + metrics.controls.h + 20, s.id + ': settings separated from window controls');
      assert(metrics.settingsDrag === 'no-drag', s.id + ': settings cannot be clicked');
      if (s.id !== 'entry-windows') assert(metrics.brand.x > metrics.controls.x + metrics.controls.w, s.id + ': brand must follow window controls');
      const primary = metrics.shared.primary;
      assert(metrics.settings.x + metrics.settings.w === primary.x + primary.w, s.id + ': settings must align with content edge');
    }
    assert(metrics.brokenImages === 0, s.id + ': broken images');
    assert(metrics.passwordFields === 0, s.id + ': independent password form');
    assert(!metrics.providerCopy, s.id + ': provider copy visible');
    assert(metrics.titleBars === 0, s.id + ': standalone title bar');
    assert(metrics.windowControls === 3, s.id + ': window controls missing');
    assert(metrics.dragRegion === 'rgba(0, 0, 0, 0)', s.id + ': opaque drag region');
    assert(!metrics.actionsTop || metrics.textBottom <= metrics.actionsTop - 8, s.id + ': text overlaps actions');
    assert(metrics.boundaries.every(b => b.x >= 0 && b.y >= 0 && b.x + b.w <= 1600 && b.y + b.h <= 1000), s.id + ': screen overflow');
    layouts[s.id] = metrics;
    await page.screenshot({ path: path.join(root, 'images', s.id + '.png') });
    console.log(s.id + ' · ' + s.title);
  }
  const authIds = screens.filter(s => s.id !== 'account').map(s => s.id);
  for (const name of ['hero', 'card', 'actions', 'primary']) {
    assert(authIds.every(id => layouts[id].shared[name]), 'Missing shared element: ' + name);
    const positions = authIds.map(id => JSON.stringify(layouts[id].shared[name]));
    assert(positions.every(p => p === positions[0]), 'Inconsistent shared position: ' + name);
  }
  for (const name of ['brand', 'settings']) {
    const positions = authIds.filter(id => name !== 'brand' || id !== 'entry-windows').map(id => JSON.stringify(layouts[id].shared[name]));
    assert(positions.every(p => p === positions[0]), 'Inconsistent top corner position: ' + name);
  }
  await page.goto(pageUrl + '?state=entry');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  assert(new URL(page.url()).searchParams.get('state') === 'opening', 'Login button interaction');
  await page.getByRole('button', { name: '取消登录' }).click();
  assert(new URL(page.url()).searchParams.get('state') === 'entry', 'Cancel interaction');
  await page.goto(pageUrl + '?state=waiting');
  await page.getByRole('button', { name: '复制登录链接', exact: true }).click();
  assert(await page.locator('.feedback').isVisible(), 'Copied state interaction');
  assert(errors.length === 0, 'Browser errors: ' + errors.join('; '));
  fs.writeFileSync(path.join(root, 'verification.json'), JSON.stringify({ screenCount: screens.length, browserErrors: errors, sharedLayout: 'passed', contentBounds: 'passed', localStateLinks: 'passed', independentPasswordFields: 0, layouts }, null, 2));
  const cards = screens.map((s, i) => `<section><a href="images/${s.id}.png" target="_blank"><img src="images/${s.id}.png" alt="${s.title}" loading="lazy"></a><div class="caption"><h2>${String(i + 1).padStart(2, '0')} · ${s.title}</h2><p>${s.note}</p><div class="links"><a href="images/${s.id}.png" target="_blank">查看原图 ↗</a><a href="screen.html?state=${s.id}">查看可编辑设计稿 ↗</a><code>${s.phase}</code></div></div></section>`).join('');
  const gallery = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Plasmic · App 登录与账户设计</title><link rel="stylesheet" href="../../2026-10-10/consistent-v2/ui.css"><style>header,main,footer{max-width:1680px;padding:36px 40px;margin:auto}header p{color:var(--muted);margin:12px 0}.gallery{display:grid;grid-template-columns:1fr 1fr;gap:24px}section{border:1px solid var(--border);border-radius:12px;background:var(--panel);overflow:hidden}img{display:block;width:100%}.caption{padding:20px}.caption h2{font-size:17px}.caption p{margin:10px 0;color:var(--muted);font-size:13px}.links{display:flex;gap:18px;flex-wrap:wrap;font-size:12px}code{color:var(--muted)}footer{color:var(--muted);font-size:12px}@media(max-width:900px){.gallery{grid-template-columns:1fr}header,main,footer{padding:24px}}</style></head><body><header><a href="../../2026-10-10/consistent-v2/index.html">← 全页面图集</a><h1 style="margin-top:18px">App 登录与账户设计</h1><p>2026.10.11 · ${screens.length} 张页面 / 状态图 · 与主图集共享设计变量</p><p>全窗口布局，保留系统窗口操作。这里只设计 App 的入口、等待、结果、恢复与账户展示。图片与可点击状态示意均未接入真实登录。</p></header><main class="gallery">${cards}</main><footer><a href="design-spec.html">交互规范</a> · <a href="verification.json">一致性检查</a> · 主布局及主按钮位置在所有登录状态间保持一致。</footer></body></html>`;
  fs.writeFileSync(path.join(root, 'index.html'), gallery);
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
  await page.screenshot({ path: path.join(root, 'contact-sheet.png'), fullPage: true });
  await browser.close();
  console.log(screens.length + ' screenshots; borderless chrome, provider-neutral copy, window controls, shared positions and state interactions passed.');
})().catch(e => { console.error(e); process.exit(1); });
