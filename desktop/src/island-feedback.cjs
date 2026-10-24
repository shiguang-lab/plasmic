// Read-only geometry from the exact rendered document. No model reads, input,
// selection, scrolling or synthetic pointer events are used for island feedback.
function inspectTargets(targets, mode, expectedComponent) {
  const preview = document.querySelector('.live-root-container');
  const component = mode === 'preview' ? preview?.getAttribute('data-plasmic-preview-component')
    : document.documentElement.getAttribute('data-plasmic-component-uuid');
  const frame = document.documentElement.getAttribute('data-plasmic-frame-uuid');
  if (!component || mode === 'preview' && expectedComponent && component !== expectedComponent) return [];
  const rects = [];
  const bounds = (el) => {
    if (!el?.isConnected || !el.checkVisibility({checkVisibilityCSS:true,checkOpacity:true}) || el.closest('[data-plasmic-editor-only]')) return;
    const r = el.getBoundingClientRect();
    let left = Math.max(0, r.left), top = Math.max(0, r.top), right = Math.min(innerWidth, r.right), bottom = Math.min(innerHeight, r.bottom);
    for (let parent = el.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent), b = parent.getBoundingClientRect();
      if (/^(auto|scroll|hidden|clip)$/.test(style.overflowX)) { left = Math.max(left, b.left + parent.clientLeft); right = Math.min(right, b.left + parent.clientLeft + parent.clientWidth); }
      if (/^(auto|scroll|hidden|clip)$/.test(style.overflowY)) { top = Math.max(top, b.top + parent.clientTop); bottom = Math.min(bottom, b.top + parent.clientTop + parent.clientHeight); }
    }
    if (right > left && bottom > top) rects.push({ x:left, y:top, width:right-left, height:bottom-top });
  };
  for (const target of targets) {
    if (target.viewport || target.componentUuid && target.componentUuid !== component || target.frameUuid && target.frameUuid !== frame) continue;
    if (target.ref) {
      const store = globalThis.__plasmicRuntimeInspection;
      if (mode === 'preview' && store && target.ref.startsWith(store.id + ':')) bounds(store.nodes.get(target.ref));
    } else if (target.elementUuid) {
      for (const el of document.querySelectorAll('[data-plasmic-valkey]')) {
        if (el.getAttribute('data-plasmic-valkey').split('.').at(-1) === target.elementUuid) bounds(el);
      }
    } else {
      rects.push({x:0,y:0,width:innerWidth,height:innerHeight});
    }
  }
  return rects;
}

function clipRegion(rect, viewport) {
  const x = Math.max(rect.x, viewport.x), y = Math.max(rect.y, viewport.y);
  const right = Math.min(rect.x + rect.width, viewport.x + viewport.width), bottom = Math.min(rect.y + rect.height, viewport.y + viewport.height);
  if (right <= x || bottom <= y) return null;
  return { x:(x-viewport.x)/viewport.width, y:(y-viewport.y)/viewport.height, width:(right-x)/viewport.width, height:(bottom-y)/viewport.height };
}

function feedbackOperation(operation, context, url, now = Date.now()) {
  if (!operation || !['read','write','preview'].includes(operation.kind) || !['running','completed'].includes(operation.phase)
    || operation.projectId !== context.projectId || operation.sessionId !== context.sessionId || operation.mode !== context.mode
    || operation.url !== url || operation.arenaId !== context.arenaId
    || operation.phase === 'completed' && now - operation.finishedAt >= 1600) return null;
  return operation;
}
module.exports = { inspectTargets, clipRegion, feedbackOperation };
