// Offline Studio fixture only. Exercise real canvas documents and frame disposal.
exports.run = ({ frame }) =>
  frame.executeJavaScript(`(async () => {
  const s = studioCtx;
  const check = (ok, message) => { if (!ok) throw Error(message); };
  const arena = s.currentArena;
  const first = arena.children[0];
  let second;
  await s.changeUnsafe(() => {
    second = s.tplMgr().addNewMixedArenaFrame(arena, 'ProtectedFrame', first.container.component,
      { width: 640, height: 480, insertPt: s.viewportCtx.visibleScalerBox().topLeft() });
  });
  await s.awaitViewCtxForFrame(second);
  await s.awaitEval(); await s.awaitStudioReady();
  const old = s.tryGetViewCtxForFrame(first);
  const protectedView = s.tryGetViewCtxForFrame(second);
  check(old && protectedView && s.viewCtxs.length === 2, 'Expected two active canvas documents');
  const oldDoc = old.canvasCtx.doc();
  const oldWindow = oldDoc.defaultView;
  let forwarded = 0;
  const listener = event => {
    if (event.clientX === 37 && event.clientY === 42 && event.target === document.body) forwarded++;
  };
  const click = (doc, win = doc.defaultView) => doc.body.dispatchEvent(new win.MouseEvent('click',
    { bubbles: true, clientX: 37, clientY: 42 }));
  document.body.addEventListener('click', listener);
  try {
    click(oldDoc); click(protectedView.canvasCtx.doc());
    check(forwarded === 2, 'Both live canvases must forward exactly once');
    s.changeSelection(() => protectedView.setStudioFocusByTpl(protectedView.tplRoot()));
    await s.siteOps().removeArenaFrame(first);
    await s.awaitEval(); await s.awaitStudioReady();
    check(old.isDisposed && !protectedView.isDisposed, 'Wrong canvas disposal ownership');
    click(oldDoc, oldWindow);
    check(forwarded === 2, 'Disposed canvas still forwards interactions');
    click(protectedView.canvasCtx.doc());
    check(forwarded === 3, 'Active canvas stopped forwarding interactions');
    check(s.focusedViewCtx() === protectedView, 'Protected canvas lost focus');
    await s.undo(); await s.awaitEval(); await s.awaitStudioReady();
    const restored = await s.awaitViewCtxForFrame(first);
    await restored.awaitSync();
    check(restored && !restored.isDisposed && restored !== old, 'Undo did not recreate the canvas');
    click(restored.canvasCtx.doc());
    check(forwarded === 4, 'Restored canvas must forward exactly once');
    check(!__perf.errors.length, 'Studio errors during canvas lifecycle validation');
    return { liveDocuments: true, disposedDocumentSilent: true, protectedDocument: true,
      undoRecreatedDocument: true, forwarded, errors: __perf.errors };
  } finally {
    document.body.removeEventListener('click', listener);
  }
})()`);
