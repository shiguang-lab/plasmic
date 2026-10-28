const { app, BrowserWindow } = require("electron");
const { snapshotDocument, readyDocument, paintWindow } = require("./canvas.cjs");
const { inspectTargets, clipRegion, feedbackOperation } = require("./island-feedback.cjs");
const { abortable } = require("./abortable.cjs");
const { IslandFraming } = require("./island-framing.cjs");
const { inspectVisualState } = require("./island-visual-state.cjs");

/** Read complete artboard bounds, independently of editor pan, zoom and chrome. */
function inspectScene(mode, expectedComponent) {
  if (mode === "preview") {
    const preview = document.querySelector(".live-root-container");
    if (!preview || expectedComponent && preview.getAttribute("data-plasmic-preview-component") !== expectedComponent ||
      document.querySelector("[data-plasmic-preview-error]")) return null;
    return { width: innerWidth, height: innerHeight };
  }
  const canvas = document.querySelector(".canvas-editor__canvas-clipper");
  if (!canvas?.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true })) return null;
  const boards = [...canvas.querySelectorAll("iframe.canvas-editor__viewport")]
    .filter(el => el.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true }) && el.clientWidth && el.clientHeight)
    .map(el => {
      const r = el.getBoundingClientRect();
      return { index: Array.from(window.frames).indexOf(el.contentWindow), x: r.x, y: r.y,
        frameUuid: el.getAttribute("data-plasmic-frame-uuid"), componentUuid: el.getAttribute("data-plasmic-component-uuid"),
        width: el.clientWidth, height: el.clientHeight, scale: r.width / el.offsetWidth };
    });
  let background = "#202126";
  for (let el = canvas; el; el = el.parentElement) {
    const color = getComputedStyle(el).backgroundColor;
    if (color && color !== "transparent" && !color.endsWith(", 0)")) { background = color; break; }
  }
  if (!boards.length) return { width: 640, height: 360, background, boards };
  const scale = boards[0].scale, left = Math.min(...boards.map(b => b.x)), top = Math.min(...boards.map(b => b.y));
  for (const board of boards) {
    board.x = (board.x - left) / scale + 16;
    board.y = (board.y - top) / scale + 16;
    delete board.scale;
  }
  return { width: Math.max(...boards.map(b => b.x + b.width)) + 16,
    height: Math.max(...boards.map(b => b.y + b.height)) + 16, background, boards };
}

async function presentationRect(frame, source) {
  let rect = { ...source };
  for (let child = frame; child.parent; child = child.parent) {
    const index = child.parent.frames.indexOf(child);
    const box = await child.parent.executeJavaScript(`((index) => {
      const el = [...document.querySelectorAll('iframe')].find(el => el.contentWindow === window.frames[index]);
      if (!el || !el.offsetWidth || !el.offsetHeight || !el.checkVisibility({checkVisibilityCSS:true,checkOpacity:true})) return null;
      const r = el.getBoundingClientRect();
      return {x:r.x+el.clientLeft*r.width/el.offsetWidth,y:r.y+el.clientTop*r.height/el.offsetHeight,
        sx:r.width/el.offsetWidth,sy:r.height/el.offsetHeight};
    })(${JSON.stringify(index)})`);
    if (!box) return null;
    rect = { x: box.x + rect.x * box.sx, y: box.y + rect.y * box.sy,
      width: rect.width * box.sx, height: rect.height * box.sy };
  }
  return rect;
}

function sceneDocument(scene, boards) {
  const scale = Math.min(1, 720 / scene.width, 400 / scene.height);
  const width = Math.max(1, Math.round(scene.width * scale)), height = Math.max(1, Math.round(scene.height * scale));
  const escape = value => String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
  return { width, height, html: `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;overflow:hidden;background:${escape(scene.background)}">
    ${boards.map(board => `<iframe sandbox="allow-scripts allow-same-origin" style="position:absolute;border:0;transform-origin:0 0;transform:scale(${scale});left:${board.x * scale}px;top:${board.y * scale}px;width:${board.width}px;height:${board.height}px" srcdoc="${escape(board.html)}"></iframe>`).join("")}
    </body></html>` };
}

function loadScene(html) {
  return new Promise(resolve => {
    document.open();
    window.addEventListener("load", () => resolve(), {once:true});
    document.write(html);
    document.close();
  });
}

/** Static, sanitized copies keep complete live artboards without changing Studio. */
function createIslandCapture() {
  let surface, activeFrame, activeTarget, cached, epoch = 0;
  let captureAbort = new AbortController();
  const framing = new IslandFraming();
  function releaseFrame() {
    if (activeFrame && !activeFrame.isDestroyed?.()) void activeFrame.executeJavaScript('document.documentElement.removeAttribute("data-plasmic-canvas-mirror")').catch(() => {});
    activeFrame = activeTarget = undefined;
  }
  function closeSurface() {
    epoch++; captureAbort.abort(); captureAbort = new AbortController();
    surface?.destroy(); surface = undefined; releaseFrame();
  }
  async function capture(win, context, operation, operations) {
    if (context.mode === "preview" && activeFrame) closeSurface();
    const version = epoch, url = win.webContents.getURL(), frames = win.webContents.mainFrame.framesInSubtree;
    const active = feedbackOperation(operation, context, url);
    const signal = AbortSignal.any([captureAbort.signal, AbortSignal.timeout(10_000)]);
    for (const frame of frames) {
      if (frame.isDestroyed?.()) continue;
      let scene = await abortable(signal, () => frame.executeJavaScript(`(${inspectScene.toString()})(${JSON.stringify(context.mode)},${JSON.stringify(context.previewContext?.componentUuid)})`));
      if (!scene) continue;
      if (!await presentationRect(frame, {x:0,y:0,width:scene.width,height:scene.height})) continue;
      if (version !== epoch || win.isDestroyed() || url !== win.webContents.getURL()) return null;
      if (scene.boards) scene = framing.select(scene, context, operation, operations);
      const sources = scene.boards ? scene.boards.map(board => frame.frames[board.index]) : [frame];
      const stamps = [];
      for (const source of sources) {
        if (!source || source.isDestroyed?.()) return null;
        stamps.push(await abortable(signal, () => source.executeJavaScript(`(${inspectVisualState.toString()})()`)));
      }
      const scope = JSON.stringify([url, context.projectId, context.branchId, context.sessionId, context.arenaId, context.mode, scene]);
      const key = JSON.stringify([scope, context.changeCounter, stamps.map(stamp => [stamp.id, stamp.revision])]);
      const dynamic = stamps.some(stamp => stamp.dynamic);
      const deferred = cached?.scope === scope && !dynamic && stamps.some(stamp => Date.now() - stamp.changedAt < 150);
      let pixels = cached?.scope === scope && (deferred || cached.key === key && !dynamic) ? cached.image : null;
      let image;
      if (!pixels && scene.boards) {
        const target = scene.view === "page" ? scene.boards[0].frameUuid : "all";
        if (activeFrame !== frame || activeTarget !== target) {
          if (activeFrame !== frame) releaseFrame();
          activeFrame = frame; activeTarget = target;
          await abortable(signal, () => frame.executeJavaScript(`document.documentElement.setAttribute("data-plasmic-canvas-mirror", ${JSON.stringify(target)})`));
        }
        for (const source of sources) {
          if (!source || source.isDestroyed?.() || !await abortable(signal, () => source.executeJavaScript('document.documentElement.hasAttribute("data-plasmic-render-ready")'))) return null;
        }
        const boards = [];
        for (const board of scene.boards) {
          const source = frame.frames[board.index];
          if (!source || source.isDestroyed?.()) return null;
          const html = await abortable(signal, () => source.executeJavaScript(`(${snapshotDocument.toString()})({preserveContentEditor:true})`));
          boards.push({ ...board, html });
        }
        if (version !== epoch || win.isDestroyed() || url !== win.webContents.getURL()) return null;
        const document = sceneDocument(scene, boards);
        const fresh = !surface;
        if (!surface) {
          surface = new BrowserWindow({show:false,width:document.width,height:document.height,useContentSize:true,
            webPreferences:{session:win.webContents.session,nodeIntegration:false,contextIsolation:true,sandbox:true,
              offscreen:true,backgroundThrottling:false,devTools:!app.isPackaged}});
          surface.webContents.setWindowOpenHandler(() => ({action:"deny"}));
          surface.webContents.on("will-navigate", event => event.preventDefault());
        }
        const renderer = surface;
        try {
          renderer.setContentSize(document.width, document.height);
          if (fresh) await abortable(signal, () => renderer.loadURL("about:blank"));
          await abortable(signal, () => renderer.webContents.executeJavaScript(`(${loadScene.toString()})(${JSON.stringify(document.html)})`));
          for (const child of renderer.webContents.mainFrame.frames) await abortable(signal, () => child.executeJavaScript(`(${readyDocument.toString()})()`));
          await abortable(signal, () => renderer.webContents.executeJavaScript(`(${readyDocument.toString()})()`));
          image = await abortable(signal, () => paintWindow(renderer, document.width, document.height));
        } catch (error) {
          if (surface === renderer) closeSurface();
          throw error;
        }
      } else if (!pixels) {
        const css = await presentationRect(frame, {x:0,y:0,width:scene.width,height:scene.height}), zoom = win.webContents.getZoomFactor();
        if (!css) continue;
        const rect = {x:Math.round(css.x*zoom),y:Math.round(css.y*zoom),width:Math.round(css.width*zoom),height:Math.round(css.height*zoom)};
        image = await abortable(signal, () => win.webContents.capturePage(rect, {stayHidden:true,stayAwake:true}));
      }
      if (version !== epoch || win.isDestroyed() || url !== win.webContents.getURL()) return null;
      if (!pixels) {
        if (image.isEmpty()) return null;
        const size = image.getSize(), scale = Math.min(1, 720 / size.width, 400 / size.height);
        if (scale < 1) image = image.resize({width:Math.max(1,Math.round(size.width*scale)),height:Math.max(1,Math.round(size.height*scale))});
        pixels = {src:`data:image/jpeg;base64,${image.toJPEG(78).toString("base64")}`,width:scene.width,height:scene.height,capturedAt:Date.now(),framing:scene.view || "page"};
        cached = {scope,key,image:pixels};
      }
      const regions = [];
      if (active && !deferred) {
        if (active.targets.some(t => t.viewport)) regions.push({x:0,y:0,width:1,height:1});
        else if (scene.boards) {
          for (const board of scene.boards) {
            const targets = await abortable(signal, () => frame.frames[board.index].executeJavaScript(`(${inspectTargets.toString()})(${JSON.stringify(active.targets)},"edit")`));
            for (const target of targets) {
              const region = clipRegion({x:board.x+target.x,y:board.y+target.y,width:target.width,height:target.height}, {x:0,y:0,width:scene.width,height:scene.height});
              if (region) regions.push(region);
            }
          }
        } else {
          const targets = await abortable(signal, () => frame.executeJavaScript(`(${inspectTargets.toString()})(${JSON.stringify(active.targets)},"preview",${JSON.stringify(context.previewContext?.componentUuid)})`));
          for (const target of targets) {
            const region = clipRegion(target, {x:0,y:0,width:scene.width,height:scene.height});
            if (region) regions.push(region);
          }
        }
      }
      if (version !== epoch || win.isDestroyed() || url !== win.webContents.getURL()) return null;
      return {...pixels,
        feedback:regions.length ? {id:active.id,kind:active.kind,phase:active.phase,regions} : null};
    }
    return null;
  }
  return { capture, close: closeSurface };
}
module.exports = { createIslandCapture, inspectScene, sceneDocument, presentationRect };
