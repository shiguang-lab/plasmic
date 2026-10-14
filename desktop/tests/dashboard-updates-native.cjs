const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const path = require("node:path");
const root = path.resolve(__dirname, "../src") + path.sep;
app
  .whenReady()
  .then(async () => {
    const win = new BrowserWindow({
      show: false,
      width: 1600,
      height: 900,
      webPreferences: { sandbox: true },
    });
    const ui = fs.readFileSync(root + "update-ui.js", "utf8");
    const i18n = fs.readFileSync(root + "renderer-i18n.js", "utf8");
    const html =
      '<html><head><style>body{font:14px sans-serif;color:#252a38}header{display:flex;align-items:center;justify-content:space-between;gap:4px;height:48px}.brand-group{display:flex;align-items:center;gap:12px}#brand{display:block;width:160px;height:48px}button{border:0;background:transparent}#avatar{width:32px;height:32px}</style></head><body><header><div class="brand-group"><a id="brand">Plasmic</a><span data-desktop-update-slot="header"></span></div><button id="avatar">User</button></header><script>window.commands=[];window.desktopUpdates={command:async(c)=>{commands.push(c);return window.statusFixture},onStatus:f=>window.sendStatus=f};window.statusFixture={phase:"current",currentVersion:"0.1.0"};</script></body></html>';
    await win.loadURL(
      "data:text/html;charset=utf-8," + encodeURIComponent(html),
    );
    await win.webContents.executeJavaScript(i18n);
    await win.webContents.executeJavaScript(ui);
    const evaluate = (s) => win.webContents.executeJavaScript(s);
    await evaluate(
      `(()=>{const hidden=document.createElement('div');hidden.style.visibility='hidden';hidden.innerHTML='<span data-desktop-update-slot="header"></span>';document.body.prepend(hidden);})()`,
    );
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(
      await evaluate(
        `document.getElementById('plasmic-desktop-update').parentElement.parentElement.className`,
      ),
      "brand-group",
    );
    const geometry = () =>
      evaluate(
        `(()=>{const c=document.getElementById('plasmic-desktop-update');const b=c.querySelector('button');const r=b.getBoundingClientRect();const a=document.getElementById('avatar').getBoundingClientRect();return {height:r.height,width:r.width,right:r.right,avatarLeft:a.left,left:r.left,brandRight:document.getElementById('brand').getBoundingClientRect().right,hidden:c.hidden,iconOpacity:getComputedStyle(c.querySelector('.update-icon')).opacity,labelDisplay:getComputedStyle(c.querySelector('.update-label')).display};})()`,
      );
    let g = await geometry();
    assert.equal(g.hidden, true);
    assert.equal(
      await evaluate(
        `getComputedStyle(document.querySelector('[data-desktop-update-slot]')).display`,
      ),
      "none",
    );
    for (const phase of [
      "available",
      "downloading",
      "downloaded",
      "installing",
    ]) {
      await evaluate(
        `window.statusFixture={phase:'${phase}',currentVersion:'0.1.0',version:'0.2.0',percent:42};window.sendStatus(window.statusFixture)`,
      );
      g = await geometry();
      assert.equal(g.hidden, false);
      assert.equal(g.height, 32);
      assert.ok(g.width <= 112);
      assert.equal(g.left - g.brandRight, 12);
      if (phase === "downloaded") {
        assert.equal(
          await evaluate(
            `document.querySelector('.update-icon svg').dataset.icon`,
          ),
          "download",
        );
        assert.equal(g.labelDisplay, "none");
        assert.equal(g.width, 32);
        await evaluate(`document.querySelector('.update-action').click()`);
        assert.equal(await evaluate("commands.at(-1)"), "open");
      }
    }
    await evaluate(
      `window.sendStatus({phase:'downloading',currentVersion:'0.1.0',version:'0.2.0',percent:42})`,
    );
    win.setSize(1100, 900);
    await new Promise((r) => setTimeout(r, 120));
    g = await geometry();
    assert.equal(g.width, 32);
    assert.equal(g.labelDisplay, "none");
    await evaluate(
      `window.sendStatus({phase:'current',currentVersion:'0.1.0'})`,
    );
    g = await geometry();
    assert.equal(g.hidden, true);
    assert.equal(
      await evaluate(
        `getComputedStyle(document.querySelector('[data-desktop-update-slot]')).display`,
      ),
      "none",
    );
    assert.equal(await evaluate('commands.includes("check")'), false);
    assert.equal(await evaluate('commands.includes("install")'), false);
    for (const width of [1600, 1100, 700]) {
      win.setSize(width, 900);
      await new Promise((r) => setTimeout(r, 120));
      await evaluate(
        `window.sendStatus({phase:'downloaded',currentVersion:'0.1.0',version:'0.2.0'});document.getElementById('plasmic-desktop-update').dispatchEvent(new Event('mouseenter'))`,
      );
      const placement = await evaluate(
        `(()=>{const c=document.getElementById('plasmic-desktop-update'),b=c.querySelector('button').getBoundingClientRect(),t=c.querySelector('.update-tooltip'),r=t.getBoundingClientRect();return {top:r.top,bottom:b.bottom,left:r.left,right:r.right,viewport:innerWidth,arrow:r.left+parseFloat(t.style.getPropertyValue('--update-tooltip-arrow-x')),anchor:b.left+b.width/2,text:t.textContent};})()`,
      );
      assert.equal(placement.top, placement.bottom + 8);
      assert.ok(placement.left >= 8);
      assert.ok(placement.right <= placement.viewport - 8);
      assert.ok(Math.abs(placement.arrow - placement.anchor) < 1);
      assert.ok(placement.text.trim().length > 0);
      await evaluate(
        `document.getElementById('plasmic-desktop-update').dispatchEvent(new Event('mouseleave'))`,
      );
    }
    console.log(
      "PASS: left brand spacing, conditional visibility, download icon, responsive progress, anchored tooltip content and details-only click",
    );
    win.destroy();
    app.quit();
  })
  .catch((e) => {
    console.error(e);
    app.exit(1);
  });
