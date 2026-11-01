// Save/reopen acceptance against the offline server fixture only.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readback() {
  const s = studioCtx;
  const nodes = (root) => {
    const result = [],
      seen = new Set();
    const visit = (tpl) => {
      if (seen.has(tpl)) return;
      seen.add(tpl);
      result.push({
        uuid: tpl.uuid,
        name: tpl.name,
        tag: tpl.tag,
        parent: tpl.parent?.uuid,
        component: tpl.component?.uuid,
        param: tpl.param?.uuid,
        settings: tpl.vsettings?.map((vs) => ({
          uuid: vs.uuid,
          variants: vs.variants.map((v) => v.uuid),
          styles: Object.fromEntries(Object.entries(vs.rs.values).sort()),
          text: vs.text?.text,
          repeat: vs.dataRep?.collection?.code,
          args: vs.args.map((arg) => ({
            param: arg.param.uuid,
            children: arg.expr.tpl?.map((t) => t.uuid),
          })),
        })),
      });
      for (const child of tpl.children || tpl.defaultContents || [])
        visit(child);
      for (const vs of tpl.vsettings || [])
        for (const arg of vs.args)
          for (const child of arg.expr.tpl || []) visit(child);
    };
    visit(root);
    return result;
  };
  return {
    components: s.site.components
      .filter((c) => ["UndoInner", "UndoOuter", "UndoHost"].includes(c.name))
      .map((c) => ({
        uuid: c.uuid,
        name: c.name,
        params: c.params.map((p) => ({ uuid: p.uuid, name: p.variable.name })),
        variants: c.variants.map((v) => ({
          uuid: v.uuid,
          name: v.name,
          parent: v.parent?.uuid,
        })),
        groups: c.variantGroups.map((g) => ({
          uuid: g.uuid,
          param: g.param.uuid,
          variants: g.variants.map((v) => v.uuid),
        })),
        nodes: nodes(c.tplTree),
      })),
    arenas: s.site.arenas
      .filter((a) => a.name === "UndoCases" || /^UndoArena[01]$/.test(a.name))
      .map((a) => ({
        uuid: a.uuid,
        name: a.name,
        frames: a.children.map((f) => ({
          uuid: f.uuid,
          component: f.container.component.uuid,
          left: f.left,
          top: f.top,
          width: f.width,
          height: f.height,
        })),
      })),
  };
}

exports.run = async ({ frame, win }) => {
  const expression = `(${readback.toString()})()`;
  await frame.executeJavaScript("studioCtx.awaitEval()");
  const before = await frame.executeJavaScript(expression);
  if (before.components.length !== 3 || before.arenas.length !== 3)
    throw Error("Reopen fixture incomplete");
  const save = await frame.executeJavaScript(`(async()=>{
    const s=studioCtx,records=s.undoLog._log.length;
    s.needsFullSave=true;await s.save();
    if(s.saveStatus!=='saved'||s._changeRecords.length||records!==s.undoLog._log.length)throw Error('Reopen full save failed');
    return {revision:s.dbCtx().revisionNum,records};
  })()`);
  const loaded = new Promise((resolve) =>
    win.webContents.once("did-finish-load", resolve),
  );
  win.webContents.reload();
  await Promise.race([
    loaded,
    sleep(60000).then(() => {
      throw Error("Saved page load timed out");
    }),
  ]);
  let next;
  for (let i = 0; i < 600 && !next; i++) {
    for (const candidate of win.webContents.mainFrame.framesInSubtree) {
      try {
        if (
          await candidate.executeJavaScript(
            "!!window.studioCtx?.activeCanvasReady && !!window.studioCtx?.initialViewportReady",
          )
        )
          next = candidate;
      } catch {}
    }
    if (!next) await sleep(100);
  }
  if (!next) throw Error("Saved Studio did not reopen");
  await next.executeJavaScript(
    "(async()=>{await studioCtx.awaitEval();await studioCtx.awaitStudioReady()})()",
  );
  const after = await next.executeJavaScript(expression);
  if (JSON.stringify(before) !== JSON.stringify(after))
    throw Error("Saved model changed after reopening");
  const state = await next.executeJavaScript(
    "({revision:studioCtx.dbCtx().revisionNum,errors:__perf.errors})",
  );
  if (state.errors.length || state.revision !== save.revision)
    throw Error("Reopened Studio state failed");
  return {
    frame: next,
    result: {
      passed: true,
      save,
      components: after.components.length,
      arenas: after.arenas.length,
      errors: state.errors,
    },
  };
};
