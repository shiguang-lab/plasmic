// Optional component-library qualification for the isolated saved-project replay.
// The custom Host selects its icon by registration name, with no icon model ref.
exports.customHost = ({opening, canvasOrigin, html}) => {
  const pathname = "/static/host." + "b".repeat(64) + ".html";
  const url = canvasOrigin + pathname;
  opening.project.hostUrl = url;
  for (const project of opening.startup.projectData.projects) {
    if (project.id === opening.project.id) { project.hostUrl = url; }
  }
  opening.startup.hosts.trustedHosts.push({id:"hostless-qualification", hostUrl:url});
  const registration = `
    window.__PlasmicComponentRegistry ||= [];
    window.__PlasmicComponentRegistry.push({
      component: function HostDynamicIcon(props) {
        const entry = window.__PlasmicComponentRegistry.find(item => item.meta.name === props.iconName);
        const React = window.__Sub.React;
        return React.createElement('span', {'data-host-dynamic': props.iconName},
          entry ? React.createElement(entry.component) : 'MISSING LIBRARY');
      },
      meta: {name:'HostDynamicIcon', importPath:'./qualification-host', props:{iconName:'string'}}
    });`;
  return {pathname, html:html.replace("</body>", `<script>${registration}</script></body>`)};
};

exports.run = async ({frame, win, ready, progress}) => {
  const custom = process.env.PERF_OPEN_CUSTOM_HOST === "1";
  progress("hostless-qualification-start", {custom});
  const result = await frame.executeJavaScript(`(async () => {
    const s = studioCtx;
    clearInterval(s.asyncSaverTimer);
    const assert = (value, message) => { if (!value) throw Error(message); };
    const sync = async () => { await s.awaitEval(); await s.awaitStudioReady(); };
    const frame = ${custom} ? s.currentArena.children[0] : s.currentArena.children.find(frame => {
      const view = s.tryGetViewCtxForFrame(frame);
      return view && ![...view.canvasCtx.installedHostLessPkgs].some(id => id.startsWith('antd-icons@'));
    });
    assert(frame, 'Qualification needs an artboard whose icon library is initially unused');
    s.changeSelection(() => s.setStudioFocusOnFrame({frame, autoZoom:true}));
    await sync();
    const view = s.tryGetViewCtxForFrame(frame), root = frame.container.component.tplTree;
    const library = s.site.projectDependencies.find(d => d.site.hostLessPackageInfo?.name === 'antd-icons');
    assert(library, 'Qualification requires the exact icon-library dependency');
    const iconComponent = library.site.components[0];
    assert(s.getHostLessComponentsMap().has(iconComponent.name), 'Studio insertion registry omitted the unused icon library');
    const loaded = () => [...view.canvasCtx.installedHostLessPkgs].some(id => id.startsWith('antd-icons@'));
    assert(loaded() === ${custom}, 'Initial library scope is incorrect');
    assert((document.documentElement.dataset.plasmicHost === 'self') === ${!custom}, 'Wrong Host document topology');
    const parent = dbg.tpls.flattenTpls(root).find(t => ['div','section','main'].includes(t.tag) && Array.isArray(t.children));
    assert(parent, 'Qualification requires a native content container');
    const component = ${custom} ? s.site.components.find(c => c.name === 'HostDynamicIcon') : iconComponent;
    assert(component, 'Custom Host registration did not synchronize into Studio');
    const node = dbg.tpls.mkTplComponent(component, frame.container.component.variants[0],
      ${custom} ? {iconName:dbg.exprs.codeLit(iconComponent.name)} : undefined);
    node.name = 'HostlessDynamicProbe';
    const probe = dbg.tpls.mkTplTagX('span', {baseVariant:frame.container.component.variants[0], attrs:{'data-hostless-probe':'dynamic'}}, [node]);
    const condition = dbg.exprs.codeLit(false);
    if (!${custom}) node.vsettings[0].dataCond = condition;
    const rendered = () => {
      if (${custom}) return !!view.canvasCtx.doc().querySelector('[data-host-dynamic] svg');
      const value = view.renderState.tpl2bestVal(node);
      const dom = value && view.renderState.sel2dom(value, view.canvasCtx);
      return !!dom && [...dom].some(element => element.isConnected &&
        (element.tagName.toLowerCase() === 'svg' || element.querySelector('svg')));
    };
    const expectRendered = async (expected, message) => {
      for (let i = 0; i < 200 && rendered() !== expected; i++) await new Promise(resolve => setTimeout(resolve, 20));
      assert(rendered() === expected, message);
    };
    const previewCondition = async expected => {
      await s.previewCtx.toggleLiveMode();
      let doc, probe;
      for (let i = 0; i < 500; i++) {
        doc = document.querySelector('[data-test-id="live-frame"]')?.contentDocument;
        probe = doc?.querySelector('[data-hostless-probe="dynamic"]');
        if (probe && doc.querySelector('.ant-table-tbody')?.innerText.length > 30) break;
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      assert(probe, 'Dynamic reference Preview did not load');
      assert(!!probe.querySelector('svg') === expected, 'Preview condition differs from the persisted binding');
      await s.previewCtx.stopLiveMode(); await sync();
    };
    await s.changeUnsafe(() => dbg.$$$(parent).append(probe)); await sync();
    assert(loaded(), 'New reference did not load its component library');
    if (!${custom}) {
      await expectRendered(false, 'Inactive conditional branch unexpectedly rendered');
      await s.changeUnsafe(() => { condition.code = 'true'; }); await sync();
      await expectRendered(true, 'Activating a dynamic branch did not render its icon');
      await s.undo(); await sync(); assert(condition.code === 'false', 'Conditional model undo failed');
      // Undo restores the edit selection, which may reveal this inactive node
      // temporarily in design mode. The persisted condition must remain false.
      assert(node.vsettings[0].dataCond.code === 'false', 'Conditional binding undo failed');
      await previewCondition(false);
      await s.redo(); await sync(); await expectRendered(true, 'Conditional redo failed');
      await previewCondition(true);
      await s.undo(); await sync(); assert(node.vsettings[0].dataCond.code === 'false', 'Final conditional undo failed');
    } else { await expectRendered(true, 'Custom Host dynamic registry lookup missed its library'); }
    await s.undo(); await sync(); assert(!parent.children.includes(probe), 'Insert undo failed');
    await s.redo(); await sync(); assert(parent.children.includes(probe), 'Insert redo failed');
    if (!${custom}) { await s.changeUnsafe(() => { condition.code = 'true'; }); await sync(); }
    await expectRendered(true, 'Redone dynamic component has no DOM');
    const bundle = JSON.stringify(s.bundler().bundle(s.site,s.siteInfo.id,s.appCtx.lastBundleVersion));
    s.needsFullSave = true; await s.save();
    assert(s.saveStatus === 'saved' && !s._changeRecords.length, 'Dynamic component full save failed');
    return {bundle, revision:s.dbCtx().revisionNum, frameId:frame.uuid, nodeId:node.uuid,
      custom:${custom}, iconName:iconComponent.name, initialIconLibraryLoaded:${custom}};
  })()`);
  const previousTimeOrigin = await frame.executeJavaScript("performance.timeOrigin");
  const loaded = new Promise(resolve => win.webContents.once("did-finish-load", resolve));
  win.webContents.reload(); await loaded;
  frame = await ready({previousTimeOrigin});
  await frame.executeJavaScript(`(async () => {
    const s = studioCtx; await s.awaitStudioReady();
    const expected = ${JSON.stringify(result)};
    const assert = (value, message) => { if (!value) throw Error(message); };
    assert(JSON.stringify(s.bundler().bundle(s.site,s.siteInfo.id,s.appCtx.lastBundleVersion)) === expected.bundle,
      'Dynamic component saved/reopened model changed');
    assert(s.dbCtx().revisionNum === expected.revision, 'Saved revision changed');
    const frame = s.currentArena.children.find(f => f.uuid === expected.frameId);
    assert(frame, 'Reopened artboard is missing');
    const view = s.tryGetViewCtxForFrame(frame);
    const node = dbg.tpls.flattenTpls(frame.container.component.tplTree).find(t => t.uuid === expected.nodeId);
    assert(node, 'Saved dynamic node is missing');
    assert([...view.canvasCtx.installedHostLessPkgs].some(id => id.startsWith('antd-icons@')),
      'Reopened artboard missed its icon library');
    if (expected.custom) assert(view.canvasCtx.doc().querySelector('[data-host-dynamic] svg'), 'Reopened custom Host icon did not render');
    else {
      const value = view.renderState.tpl2bestVal(node);
      const dom = value && view.renderState.sel2dom(value, view.canvasCtx);
      assert(dom && [...dom].some(element => element.isConnected &&
        (element.tagName.toLowerCase() === 'svg' || element.querySelector('svg'))), 'Reopened conditional icon did not render');
    }
  })()`);
  delete result.bundle;
  progress("hostless-qualification-complete", result);
  return {frame, result:{...result, undoRedo:true, savedDynamicReference:true, previewCondition:!custom, reopen:true}};
};
