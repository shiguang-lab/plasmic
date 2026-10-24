const { inspectTargets, clipRegion, feedbackOperation } = require("./island-feedback.cjs");
/** Read only the current visible canvas/Preview. This never invokes an MCP tool. */
function inspectViewport(mode, expectedComponent) {
  const preview = document.querySelector(".live-root-container");
  let rect;
  if (mode === "preview") {
    if (!preview || expectedComponent && preview.getAttribute("data-plasmic-preview-component") !== expectedComponent) return null;
    if (document.querySelector("[data-plasmic-preview-error]")) return null;
    rect = { x: 0, y: 0, width: innerWidth, height: innerHeight };
  } else {
    const canvas = document.querySelector(".canvas-editor__canvas-clipper");
    if (!canvas || !canvas.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true })) return null;
    const r = canvas.getBoundingClientRect();
    let left = Math.max(0, r.left), top = Math.max(0, r.top);
    let right = Math.min(innerWidth, r.right), bottom = Math.min(innerHeight, r.bottom);
    // Studio's floating chrome overlays its full-size scrollport. Capture the
    // unobscured canvas, including its feedback, without hiding any live UI.
    for (const [selector, side] of [
      [".canvas-editor__left-pane-container, .canvas-editor__left-pane", "left"],
      [".canvas-editor__right-pane", "right"],
      [".canvas-editor__top-bar", "top"],
      ['[data-test-id="canvas-view-controls"]', "bottom"],
    ]) {
      for (const el of document.querySelectorAll(selector)) {
        if (!el.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true })) continue;
        const box = el.getBoundingClientRect();
        if (!box.width || !box.height || box.right <= r.left || box.left >= r.right || box.bottom <= r.top || box.top >= r.bottom) continue;
        if (side === "left") left = Math.max(left, box.right);
        if (side === "right") right = Math.min(right, box.left);
        if (side === "top") top = Math.max(top, box.bottom);
        if (side === "bottom") bottom = Math.min(bottom, box.top);
      }
    }
    rect = { x: left, y: top, width: right - left, height: bottom - top };
    // Frame the union of visible artboards, not the focused page. Keep their
    // real backgrounds and relative positions; only trim surrounding workspace.
    const artboards = [...canvas.querySelectorAll('iframe.canvas-editor__viewport')]
      .filter(el => el.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true }))
      .map(el => el.getBoundingClientRect())
      .filter(r => r.width > 0 && r.height > 0 && r.right > left && r.left < right && r.bottom > top && r.top < bottom);
    if (artboards.length) {
      const padding = 16;
      const x = Math.max(left, Math.min(...artboards.map(r => r.left)) - padding);
      const y = Math.max(top, Math.min(...artboards.map(r => r.top)) - padding);
      const endX = Math.min(right, Math.max(...artboards.map(r => r.right)) + padding);
      const endY = Math.min(bottom, Math.max(...artboards.map(r => r.bottom)) + padding);
      rect = { x, y, width: endX - x, height: endY - y };
    }
  }
  return rect.width > 0 && rect.height > 0 ? rect : null;
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

async function captureIslandView(win, context, operation) {
  const url = win.webContents.getURL();
  const frames = win.webContents.mainFrame.framesInSubtree;
  for (const frame of frames) {
    if (frame.isDestroyed?.()) continue;
    const local = await frame.executeJavaScript(`(${inspectViewport.toString()})(${JSON.stringify(context.mode)},${JSON.stringify(context.previewContext?.componentUuid)})`);
    if (!local) continue;
    const css = await presentationRect(frame, local), zoom = win.webContents.getZoomFactor();
    if (!css) continue;
    const bounds = win.getContentBounds();
    const x = Math.max(0, Math.round(css.x * zoom)), y = Math.max(0, Math.round(css.y * zoom));
    const rect = { x, y, width: Math.min(bounds.width - x, Math.round(css.width * zoom)), height: Math.min(bounds.height - y, Math.round(css.height * zoom)) };
    if (rect.width <= 0 || rect.height <= 0) continue;
    // Preserve the real compositor, including its existing read/write feedback.
    // The normal MCP screenshot path intentionally hides that feedback.
    const image = await win.webContents.capturePage(rect, { stayHidden: true, stayAwake: true });
    if (win.isDestroyed() || url !== win.webContents.getURL() || image.isEmpty()) return null;
    const size = image.getSize();
    const scale = Math.min(1, 720 / size.width, 400 / size.height);
    const thumbnail = scale < 1 ? image.resize({ width: Math.max(1, Math.round(size.width * scale)), height: Math.max(1, Math.round(size.height * scale)) }) : image;
    let feedback = null;
    const active = feedbackOperation(operation, context, url);
    if (active) {
      const regions = [];
      if (active.targets.some((target) => target.viewport)) regions.push({ x:0, y:0, width:1, height:1 });
      else for (const targetFrame of frames) {
        if (targetFrame.isDestroyed?.()) continue;
        const targets = await targetFrame.executeJavaScript(`(${inspectTargets.toString()})(${JSON.stringify(active.targets)},${JSON.stringify(context.mode)},${JSON.stringify(context.previewContext?.componentUuid)})`);
        for (const target of targets) {
          const bounds = await presentationRect(targetFrame, target);
          if (!bounds) continue;
          const region = clipRegion({ x:bounds.x*zoom, y:bounds.y*zoom, width:bounds.width*zoom, height:bounds.height*zoom }, rect);
          if (region && !regions.some((r) => JSON.stringify(r) === JSON.stringify(region))) regions.push(region);
        }
      }
      if (regions.length) feedback = { id:active.id, kind:active.kind, phase:active.phase, regions };
    }
    if (win.isDestroyed() || url !== win.webContents.getURL()) return null;
    return { src: `data:image/jpeg;base64,${thumbnail.toJPEG(78).toString("base64")}`,
      width: rect.width, height: rect.height, capturedAt: Date.now(), feedback };
  }
  return null;
}
module.exports = { captureIslandView, inspectViewport, presentationRect };
