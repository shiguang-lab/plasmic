// Edits and saves only the isolated real-project replay, never a live project.
exports.run = async ({frame,win,ready,preview}) => {
  const result = await frame.executeJavaScript(`(async()=>{
    const s=studioCtx;clearInterval(s.asyncSaverTimer);
    const assert=(value,message)=>{if(!value)throw Error(message)};
    const cases=[];
    const arena=s.currentArena, camera=s.getCurrentStudioViewportSnapshot();
    const frames=arena.children.slice();
    const sync=async()=>{await s.awaitEval();await s.awaitStudioReady()};
    const serialize=()=>JSON.stringify(s.bundler().bundle(s.site,s.siteInfo.id,s.appCtx.lastBundleVersion));
    const before=serialize();
    for(const f of [...new Set([frames[0],frames.at(-1),frames[Math.floor(frames.length/2)]])]){
      s.changeSelection(()=>s.setStudioFocusOnFrame({frame:f,autoZoom:true}));
      await sync();const v=s.tryGetViewCtxForFrame(f);
      assert(v?.initialRenderReady && v.canvasCtx.doc().body.innerText.length>20,'Switched artboard is empty');
      cases.push({case:'switch-artboard',frame:f.uuid,rendered:true});
    }
    const page=s.site.pageArenas[0],name=page.component.name;
    await s.changeUnsafe(()=>s.siteOps().tryRenameArenas([{arena:page,newName:name+'Probe'}]));await sync();
    assert(page.component.name===name+'Probe','Rename failed');
    await s.undo();await sync();assert(page.component.name===name,'Rename undo failed');
    await s.redo();await sync();assert(page.component.name===name+'Probe','Rename redo failed');
    await s.undo();await sync();cases.push({case:'rename-undo-redo',passed:true});
    const f=frames[0];s.changeSelection(()=>s.setStudioFocusOnFrame({frame:f,autoZoom:true}));await sync();
    let vc=s.tryGetViewCtxForFrame(f);const root=f.container.component.tplTree,vs=root.vsettings[0];
    // Observe actual outline DOM after a command, rather than only the model.
    const outlineContains=label=>[...document.querySelectorAll('.tpltree__label')].some(e=>e.textContent.includes(label));
    const waitForOutline=async(label,present)=>{
      for(let i=0;i<150&&outlineContains(label)!==present;i++)await new Promise(r=>setTimeout(r,20));
      assert(outlineContains(label)===present,'Outline did not reflect element rename: '+label);
    };
    s.changeSelection(()=>vc.setStudioFocusByTpl(root));await sync();
    if(s.leftTabKey!=='outline'||s.navigationPanel!=='outline'||s.panelsHidden){s.showLayersPanel();await sync()}
    for(let i=0;i<150&&!document.querySelector('.tpltree__label');i++)await new Promise(r=>setTimeout(r,20));
    assert(document.querySelector('.tpltree__label'),'Outline panel did not open');
    const rootName=root.name,probeName='MigrationAuditRoot';
    assert(!outlineContains(probeName),'Outline probe name already exists');
    await s.changeUnsafe(()=>vc.getViewOps().renameTpl(probeName,root));await sync();
    assert(root.name===probeName,'Element rename failed');await waitForOutline(probeName,true);
    await s.undo();await sync();assert(root.name===rootName,'Element rename undo failed');await waitForOutline(probeName,false);
    await s.redo();await sync();await waitForOutline(probeName,true);
    await s.undo();await sync();assert(root.name===rootName,'Element name not restored');await waitForOutline(probeName,false);
    cases.push({case:'outline-dom-rename-undo-redo',passed:true});
    const original=vs.rs.values.opacity;
    const opacity=()=>{const val=vc.renderState.tpl2bestVal(root);const dom=val&&vc.renderState.sel2dom(val,vc.canvasCtx);assert(dom?.length,'Root DOM missing');return vc.canvasCtx.win().getComputedStyle(dom[0]).opacity};
    const prior=opacity();
    await s.changeUnsafe(()=>{vs.rs.values.opacity='0.83'});await sync();assert(opacity()==='0.83','Actual DOM style did not update');
    await s.undo();await sync();assert(opacity()===prior,'Style undo did not reach DOM');
    await s.redo();await sync();assert(opacity()==='0.83','Style redo did not reach DOM');
    await s.undo();await sync();assert(vs.rs.values.opacity===original,'Style model not restored');
    cases.push({case:'rendered-style-undo-redo',passed:true});
    const left=f.left;
    await s.changeUnsafe(()=>{f.left+=17});await sync();assert(f.left===left+17,'Frame move failed');
    await s.undo();await sync();assert(f.left===left,'Frame move undo failed');
    await s.redo();await sync();assert(f.left===left+17,'Frame move redo failed');
    await s.undo();await sync();cases.push({case:'frame-position-undo-redo',passed:true});
    if (${process.env.PERF_OPEN_COLD==='1'} && s.site.componentArenas.length>=7) {
      s.changeSelection(()=>vc.setStudioFocusByTpl(root));
      await s.changeUnsafe(()=>{vs.rs.values.opacity='0.87'});await sync();const old=vc;
      for(const a of s.site.componentArenas.slice(0,7)){s.changeSelection(()=>s.switchToArena(a));await sync()}
      assert(old.isDisposed,'Cold restoration did not evict the original frame');
      await s.undo();await sync();vc=s.tryGetViewCtxForFrame(f);
      assert(vc&&vc!==old&&vc.focusedTpl()===root,'Cold frame or selection restoration failed');
      assert(opacity()===prior,'Cold undo style did not reach DOM');
      cases.push({case:'cold-frame-undo-selection-style',passed:true});
      const restored=vc;
      for(const a of s.site.componentArenas.slice(0,7)){s.changeSelection(()=>s.switchToArena(a));await sync()}
      assert(restored.isDisposed,'Cold redo did not evict the restored frame');
      await s.redo();await sync();
      // Navigation updates the undo record's view; revisit the edited arena to check its DOM.
      s.changeSelection(()=>s.switchToArena(arena));await sync();vc=s.tryGetViewCtxForFrame(f);
      assert(vc&&vc!==restored&&vc.initialRenderReady,'Cold redo frame did not render');
      assert(opacity()==='0.87','Cold redo style did not reach DOM');
      await s.undo();await sync();
      s.changeSelection(()=>s.switchToArena(arena));await sync();vc=s.tryGetViewCtxForFrame(f);
      assert(opacity()===prior,'Final cold undo did not restore DOM');
      cases.push({case:'cold-frame-redo-rendered-style',passed:true});
      // Reload with a selected element so content controls observe Studio teardown.
      s.changeSelection(()=>vc.setStudioFocusByTpl(root));await sync();
      assert(vc.focusedTpl()===root,'Selected element missing before Studio reload');
    }
    if (${!!preview}) {
      await s.previewCtx.toggleLiveMode();let doc;
      for(let i=0;i<500;i++){doc=document.querySelector('[data-test-id="live-frame"]')?.contentDocument;if(doc?.querySelector('.ant-table-tbody')?.innerText.length>30)break;await new Promise(r=>setTimeout(r,20))}
      assert(doc?.querySelector('.ant-table-tbody')?.innerText.length>30,'Real Preview table did not render');
      const initial=doc.querySelector('.ant-table-tbody').innerText;
      const next=doc.querySelector('.ant-pagination-item-2 a, .ant-pagination-item-2 button');assert(next,'Preview second page missing');next.click();
      for(let i=0;i<200&&doc.querySelector('.ant-table-tbody').innerText===initial;i++)await new Promise(r=>setTimeout(r,20));
      assert(doc.querySelector('.ant-pagination-item-active')?.getAttribute('title')==='2'&&doc.querySelector('.ant-table-tbody').innerText!==initial,'Preview pagination did not update data');
      await s.previewCtx.stopLiveMode();await sync();cases.push({case:'preview-business-pagination-return',passed:true});
    }
    s.restoreStudioViewportSnapshot(camera,false);await sync();
    assert(serialize()===before,'Undo did not restore the original persisted model');
    window.__openBeforeSave=before;s.needsFullSave=true;await s.save();
    assert(s.saveStatus==='saved'&&!s._changeRecords.length,'Full client save failed');
    return {cases,bundle:before,revision:s.dbCtx().revisionNum};
  })()`);
  const loading = new Promise(resolve=>win.webContents.once('did-finish-load',resolve));
  win.webContents.reload();await loading;
  const reopened=await ready();await reopened.executeJavaScript('studioCtx.awaitStudioReady()');
  const after=await reopened.executeJavaScript('({bundle:JSON.stringify(studioCtx.bundler().bundle(studioCtx.site,studioCtx.siteInfo.id,studioCtx.appCtx.lastBundleVersion)),revision:studioCtx.dbCtx().revisionNum})');
  if(result.bundle!==after.bundle || result.revision!==after.revision)throw Error('Saved/reopened model changed');
  delete result.bundle;
  return {frame:reopened,result:{...result,reopen:true}};
};
