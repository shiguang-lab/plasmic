const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1150 }, colorScheme: 'light' });
  const errors = [];
  const checks = [];
  page.on('pageerror', e => errors.push(e.message));
  const url = pathToFileURL(path.join(__dirname, 'preview.html')).href;
  const load = async () => {
    await page.goto(url);
    await page.frameLocator('iframe').locator('.ph-app[data-layout=creative] h1').waitFor();
    const frame = page.frames()[1];
    await frame.locator('.ph-app[data-layout=creative] [data-page=projects]').click();
    return frame;
  };
  const capture = async (frame, name, layout = 'creative') => {
    const app = frame.locator(`.ph-app[data-layout=${layout}]`);
    await app.screenshot({ path: path.join(__dirname, `${name}.png`) });
    checks.push({ name, width: await app.evaluate(e => e.getBoundingClientRect().width) });
  };
  let frame = await load();
  let app = frame.locator('.ph-app[data-layout=creative]');
  if (await app.locator('.ph-brand img').count() !== 1) throw Error('Missing source brand mark');
  if (await app.locator('.ph-brand-island').count() !== 1 || await app.locator('.ph-action-island').count() !== 1) throw Error('Missing editor islands');
  if (await app.locator('.ph-top [data-action=navigator]').count()) throw Error('Duplicate top space picker');
  const chrome = await app.evaluate(e => {
    const bounds = e.getBoundingClientRect();
    const left = e.querySelector('.ph-brand-island').getBoundingClientRect();
    const right = e.querySelector('.ph-action-island').getBoundingClientRect();
    return { leftInset: left.left - bounds.left, rightInset: bounds.right - right.right, verticalOffset: left.top - right.top };
  });
  if (Math.abs(chrome.leftInset - chrome.rightInset) > 1 || Math.abs(chrome.verticalOffset) > 1) throw Error(`Chrome misaligned: ${JSON.stringify(chrome)}`);
  await app.getByRole('button', { name: '查看 Admin Templates的详情', exact: true }).click();
  if (await app.locator('.ph-detail h2').textContent() !== 'Admin Templates') throw Error('Selection did not update detail');
  await capture(frame, 'project-detail');
  await app.getByRole('button', { name: '查看 REQ075 客群管理 · 需求对齐重生成的详情', exact: true }).click();
  await app.locator('.ph-detail').getByRole('button', { name: '更多操作', exact: true }).click();
  if (await app.locator('.ph-detail [role=menu] button').count() !== 6) throw Error('Detail menu lost project actions');
  await app.locator('.ph-detail').getByRole('button', { name: '更多操作', exact: true }).click();
  await capture(frame, 'home-light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await capture(frame, 'home-dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await app.getByLabel('搜索项目', { exact: true }).fill('Admin');
  if (await app.locator('[data-project]').count() !== 1) throw Error(`Search did not filter: input=${await app.getByLabel('搜索项目', { exact: true }).inputValue()}, projects=${await app.locator('[data-project]').count()}`);
  await app.getByLabel('搜索项目', { exact: true }).fill('nothing-matches');
  await capture(frame, 'search-empty');
  await app.getByRole('button', { name: '清空筛选', exact: true }).click();
  await app.getByLabel('筛选工作区', { exact: true }).selectOption('personal');
  if (await app.locator('[data-project]').count() !== 0) throw Error('Workspace filter did not filter');
  await app.getByRole('button', { name: '清空筛选', exact: true }).click();
  await app.getByRole('button', { name: '列表视图', exact: true }).click();
  if (await app.locator('tbody tr').count() !== 2) throw Error('List count mismatch');
  await capture(frame, 'project-list');
  await app.getByRole('button', { name: '网格视图', exact: true }).click();
  await app.getByRole('button', { name: 'REQ075 客群管理 · 需求对齐重生成的操作', exact: true }).click();
  await capture(frame, 'project-menu');
  for (const text of ['重命名', '配置项目', '复制项目', '移至工作区', '设为工作区模板', '删除项目']) {
    if (await app.locator('[role=menu]').getByRole('button', { name: text, exact: true }).count() !== 1) throw Error(`Missing project action: ${text}`);
  }
  await app.locator('[role=menu]').getByRole('button', { name: '复制项目', exact: true }).click();
  await capture(frame, 'duplicate-project');
  await app.getByRole('button', { name: '关闭对话框', exact: true }).click();
  await app.getByRole('button', { name: '浏览组织与工作区', exact: true }).click();
  await capture(frame, 'space-navigator');
  await app.getByRole('button', { name: '关闭空间导航', exact: true }).click();
  await app.locator('[data-page=workspace]').first().click();
  await capture(frame, 'workspace');
  await app.getByRole('button', { name: '分享', exact: true }).click();
  if (await app.getByLabel('邀请角色').locator('option').allTextContents().then(r => r.join(',')) !== '查看者,评论者,内容编辑者,设计者,开发者') throw Error('Roles mismatch');
  await capture(frame, 'share-workspace');
  await app.getByRole('button', { name: '关闭对话框', exact: true }).click();
  await app.getByRole('tab', { name: '数据源', exact: true }).click();
  await capture(frame, 'workspace-data');
  await app.locator('[data-page=personal]').first().click();
  await capture(frame, 'personal-empty');
  await app.locator('[data-page=projects]').click();
  await app.getByRole('button', { name: '新建项目', exact: true }).click();
  await capture(frame, 'create-blank');
  await app.getByRole('button', { name: '已有模板', exact: true }).click();
  await capture(frame, 'create-template');
  if (!await app.getByRole('button', { name: '创建项目', exact: true }).isDisabled()) throw Error('Unselected template must not submit');
  await app.getByRole('button', { name: '关闭对话框', exact: true }).click();
  await app.locator('[data-page=org]').click();
  await capture(frame, 'organization');
  await app.locator('[data-action=account]').click();
  await app.getByRole('button', { name: '设置', exact: true }).click();
  await capture(frame, 'settings');
  frame = await load();
  await frame.locator('[data-variant=项目工作台]').evaluate(e => e.hidden = true);
  await frame.locator('[data-variant=空间浏览]').evaluate(e => e.hidden = false);
  await capture(frame, 'compact-library', 'compact');
  for (const width of [1024, 760, 540, 320]) {
    await page.setViewportSize({ width, height: 1500 });
    frame = await load();
    app = frame.locator('.ph-app[data-layout=creative]');
    const geometry = await app.evaluate(e => ({ client: e.clientWidth, scroll: e.scrollWidth, outside: [...e.querySelectorAll('button,input,select')].filter(n => { const r=n.getBoundingClientRect(); const p=e.getBoundingClientRect(); return r.width && (r.left < p.left-1 || r.right > p.right+1); }).map(n => n.textContent.trim()) }));
    if (geometry.scroll > geometry.client+2 || geometry.outside.length) throw Error(`Overflow at ${width}: ${JSON.stringify(geometry)}`);
    if (width <= 540) {
      const columns = await app.locator('.ph-grid').evaluate(e => getComputedStyle(e).gridTemplateColumns.split(' ').length);
      if (columns !== 1) throw Error(`Project tiles must stack at ${width}`);
    }
    await capture(frame, `responsive-${width}`);
    await app.getByRole('button', { name: '新建项目', exact: true }).click();
    const dialog = await app.locator('[role=dialog]').boundingBox();
    const bounds = await app.boundingBox();
    if (dialog.x < bounds.x || dialog.x + dialog.width > bounds.x + bounds.width+1) throw Error(`Dialog overflow at ${width}`);
  }
  if (errors.length) throw Error(errors.join(';'));
  fs.writeFileSync(path.join(__dirname, 'verification.json'), JSON.stringify({ scope: 'Local UI design only; no production requests or business mutations', consoleErrors: errors, interactions: ['search', 'workspace filter', 'grid/list', 'six project actions', 'duplicate fields', 'five share roles', 'workspace navigation', 'CMS empty state', 'personal space', 'blank/template create', 'settings', 'two layout variants'], checks }, null, 2));
  await browser.close();
  console.log(`Verified ${checks.length} UI views, responsive geometry and local interactions; zero page errors.`);
})().catch(e => { console.error(e); process.exit(1); });
