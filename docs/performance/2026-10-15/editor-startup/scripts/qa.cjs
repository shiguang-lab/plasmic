const assert = require("node:assert/strict");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function verify(call, evaluate, screenshot) {
  const original = await call("getEditorContext");
  const selected = await evaluate(
    `(()=>{const s=window.studioCtx,f=s.activeCanvasFrame,c=f.container.component,t=window.dbg.tpls.flattenTpls(c.tplTree).find(t=>t.component&&s.tryGetViewCtxForFrame(s.activeCanvasFrame).getCodeComponentMeta(t.component)?.props?.productName!==undefined);return t?{componentUuid:c.uuid,elementUuid:t.uuid,frameUuid:f.uuid}:null})()`,
  );
  if (!selected) {
    const details = await evaluate(
      `(()=>{const s=window.studioCtx,c=s.activeCanvasFrame.container.component;return window.dbg.tpls.flattenTpls(c.tplTree).filter(t=>t.component).map(t=>({name:t.component.name,props:Object.entries(s.tryGetViewCtxForFrame(s.activeCanvasFrame).getCodeComponentMeta(t.component)?.props||{}).map(([key,p])=>[key,typeof p==='string'?p:p?.type])})).slice(0,8)})()`,
    );
    throw Error("No registered productName prop: " + JSON.stringify(details));
  }
  const bundle =
    "JSON.stringify(window.studioCtx.bundler().bundle(window.studioCtx.site,window.studioCtx.siteInfo.id,window.studioCtx.appCtx.lastBundleVersion))";
  const before = await evaluate(bundle),
    marker = "StartupProbe-" + Date.now().toString(36);
  let changed = false;
  try {
    await call("selectElement", {
      componentUuid: selected.componentUuid,
      elementUuid: selected.elementUuid,
    });
    const focus = await call("getEditorContext");
    assert(focus.selectedElementUuids.includes(selected.elementUuid));
    await call("changeElement", {
      componentUuid: selected.componentUuid,
      elementUuid: selected.elementUuid,
      props: { productName: marker },
    });
    changed = true;
    await evaluate("window.studioCtx.awaitEval()");
    assert(
      await evaluate(
        `window.studioCtx.tryGetViewCtxForFrame(window.studioCtx.activeCanvasFrame).canvasCtx.doc().body.innerText.includes(${JSON.stringify(marker)})`,
      ),
      "Edit was not rendered",
    );
    await call("undo");
    changed = false;
    await evaluate("window.studioCtx.awaitEval()");
    assert.equal(await evaluate(bundle), before, "Undo changed saved model");
    assert(
      await evaluate(
        `!window.studioCtx.tryGetViewCtxForFrame(window.studioCtx.activeCanvasFrame).canvasCtx.doc().body.innerText.includes(${JSON.stringify(marker)})`,
      ),
      "Undo did not render",
    );
    await evaluate("window.studioCtx.previewCtx.toggleLiveMode()");
    let chars = 0;
    for (let i = 0; i < 240; i++) {
      chars = await evaluate(
        `(()=>{const f=document.querySelector('iframe[src*="live=true"]');try{return f?.contentDocument?.body?.innerText?.trim().length||0}catch{return 0}})()`,
      );
      if (chars > 80) break;
      await sleep(100);
    }
    if (chars <= 80) {
      const diagnostic = await evaluate(
        `({live:window.studioCtx.previewCtx.isLive,iframes:[...document.querySelectorAll('iframe')].map(f=>{try{return {title:f.title,src:f.src,body:f.contentDocument?.body?.innerText?.slice(0,400)}}catch(e){return {title:f.title,error:e.message}}})})`,
      );
      await screenshot("preview-failed");
      throw Error("Preview did not render: " + JSON.stringify(diagnostic));
    }
    await screenshot("preview");
    await evaluate("window.studioCtx.previewCtx.stopLiveMode()");
    await sleep(250);
    await call("restoreEditorView", original.editorView);
    assert.equal(await evaluate(bundle), before, "Preview changed saved model");
    return {
      selection: true,
      registeredPropEdit: true,
      editedCanvasRendered: true,
      undoExactModel: true,
      undoCanvasRendered: true,
      previewRendered: true,
      previewTextCharacters: chars,
      previewModelUnchanged: true,
    };
  } finally {
    if (changed) await call("undo").catch(() => {});
    await evaluate("window.studioCtx.previewCtx.stopLiveMode()").catch(
      () => {},
    );
    await call("restoreEditorView", original.editorView).catch(() => {});
  }
}
module.exports = { verify };
