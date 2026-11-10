const { app, BrowserWindow, ipcMain } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'plasmic-island-feedback-'));
app.setPath('userData', profile);
app.on('window-all-closed', () => {});
let win, state;
ipcMain.handle('desktop:presentation', () => state);
const pixels = color => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="${color}"/></svg>`)}`;
const before = pixels('red'), after = pixels('blue');
const watchdog = setTimeout(() => { console.error('Island feedback timed out'); app.exit(1); }, 30000);
const inspect = code => win.webContents.executeJavaScript(code);
async function until(code) {
  await inspect(`new Promise((resolve,reject)=>{
    const start=performance.now();
    function check(){if(${code})resolve(true);else if(performance.now()-start>4000)reject(new Error('Feedback did not settle'));else requestAnimationFrame(check);}
    check();
  })`);
}

app.whenReady().then(async () => {
  state = { expanded: true, context: { allowed: true, loading: false, identity: 'initial', mode: 'edit' }, activity: {}, appearance: 'dark', update: { phase: 'disabled' } };
  win = new BrowserWindow({ width: 456, height: 180, show: false, webPreferences: { preload: path.join(__dirname, '../src/island-preload.cjs'), sandbox: true, contextIsolation: true, backgroundThrottling: false, offscreen: true } });
  await win.loadFile(path.join(__dirname, '../src/island.html'));
  const cases = [
    ['enter interactive', 'read', { mode: 'edit' }, { mode: 'preview', previewKind: 'interactive' }],
    ['close interactive', 'read', { mode: 'preview', previewKind: 'interactive' }, { mode: 'edit' }],
    ['close preview', 'read', { mode: 'preview', previewKind: 'in-app' }, { mode: 'edit' }],
    ['switch preview kind', 'read', { mode: 'preview', previewKind: 'interactive' }, { mode: 'preview', previewKind: 'in-app' }],
    ['close interactive write', 'write', { mode: 'preview', previewKind: 'interactive' }, { mode: 'edit' }],
  ];
  for (const [name, kind, from, to] of cases) {
    state = { ...state, context: { allowed: true, loading: false, identity: name, ...from }, image: { src: before, identity: name, width: 400, height: 300, feedback: { id: name, kind, regions: [{ x: 0, y: 0, width: 1, height: 1 }] } }, activity: { operation: { id: name, kind, phase: 'running' } } };
    win.webContents.send('desktop:island-state', state);
    await until("document.querySelector('.feedback-operation[data-phase=running]') && document.getElementById('mirror').src === " + JSON.stringify(before));
    const remaining = await inspect(`(async()=>{
      window.oldRegion=document.querySelector('.feedback-region');
      window.oldCycle=${kind === 'read' ? 'oldRegion.firstChild' : 'oldRegion'};
      window.oldAnimation=oldCycle.getAnimations()[0];
      await oldAnimation.ready;
      const duration=oldAnimation.effect.getTiming().duration;
      // Finish part-way through the third cycle to catch iteration-count truncation.
      oldAnimation.currentTime=duration*2.4;
      // Seeking across cycles queues an iteration event; observe only the next natural boundary.
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      window.exitStarted=performance.now();
      window.exitEvents=new Promise(resolve=>{
        oldCycle.addEventListener('animationiteration',()=>{
          const cycle=performance.now()-exitStarted;
          oldRegion.addEventListener('animationend',()=>resolve({cycle,fade:performance.now()-exitStarted-cycle}),{once:true});
        },{once:true});
      });
      return duration-oldAnimation.currentTime%duration;
    })()`);
    // Mirror invalidation arrives before the replacement capture, just as in the island host.
    state = { ...state, context: { allowed: true, loading: false, identity: name + '-next', ...to }, image: null, activity: {} };
    win.webContents.send('desktop:island-state', state);
    assert.deepEqual(await inspect(`({connected:oldCycle.isConnected,phase:oldRegion.parentElement.dataset.phase,pixels:document.getElementById('mirror').src,visible:oldCycle.checkVisibility()})`), { connected: true, phase: 'running', pixels: before, visible: true }, name);
    state = { ...state, image: { src: after, identity: name + '-next', width: 300, height: 500, feedback: null } };
    win.webContents.send('desktop:island-state', state);
    assert.equal(await inspect('oldCycle.getAnimations()[0]===oldAnimation && document.getElementById("mirror").src===' + JSON.stringify(before)), true, name + ' preserves animation and pixels');
    const timing = await inspect('exitEvents');
    assert.ok(timing.cycle >= remaining - 150 && timing.cycle < remaining + 500, name + ' finishes the remaining cycle: ' + JSON.stringify(timing));
    assert.ok(timing.fade >= 1400 && timing.fade < 2000, name + ' finishes the real result fade: ' + JSON.stringify(timing));
    await until('!oldCycle.isConnected && document.getElementById("mirror").src===' + JSON.stringify(after));
    assert.equal(await inspect('document.getElementById("feedback").hidden'), true, name + ' does not reuse old geometry');
    console.log('Passed:', name, timing);
  }
  win.destroy(); clearTimeout(watchdog); fs.rmSync(profile, { recursive: true, force: true }); app.exit(0);
}).catch(error => {
  console.error(error.stack); win?.destroy(); clearTimeout(watchdog); fs.rmSync(profile, { recursive: true, force: true }); app.exit(1);
});
