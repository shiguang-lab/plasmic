// Scroll only inside the artboard document, never the surrounding Studio canvas.
function canScroll(element: HTMLElement, axis: "X" | "Y") {
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  const overflow = style?.[`overflow${axis}`];
  const isDocumentScroller = element === element.ownerDocument.scrollingElement;
  const allowed = isDocumentScroller
    ? overflow !== "hidden" && overflow !== "clip"
    : /^(auto|scroll|overlay)$/.test(overflow ?? "");
  const viewport = axis === "Y" ? element.clientHeight : element.clientWidth;
  const content = axis === "Y" ? element.scrollHeight : element.scrollWidth;
  return allowed && viewport > 0 && content > viewport;
}

export function handleCanvasContentWheel(
  event: WheelEvent,
  target: Element | undefined,
) {
  if (!event.altKey || event.ctrlKey || event.metaKey) {
    return false;
  }

  // Consume at the boundary too, so this gesture never unexpectedly pans Studio.
  event.preventDefault();
  event.stopPropagation();
  for (const axis of ["X", "Y"] as const) {
    for (
      let element = target;
      element;
      element = element.parentElement ?? undefined
    ) {
      const container = element as HTMLElement;
      if (!canScroll(container, axis)) {
        continue;
      }
      const viewport =
        axis === "Y" ? container.clientHeight : container.clientWidth;
      const units =
        event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport : 1;
      const delta = (axis === "Y" ? event.deltaY : event.deltaX) * units;
      const start = axis === "Y" ? container.scrollTop : container.scrollLeft;
      const max =
        (axis === "Y" ? container.scrollHeight : container.scrollWidth) -
        viewport;
      const next = Math.max(0, Math.min(max, start + delta));
      if (next !== start) {
        container.scrollTo({
          [axis === "Y" ? "top" : "left"]: next,
          behavior: "instant",
        });
        break;
      }
      const overscroll =
        container.ownerDocument.defaultView?.getComputedStyle(container)[
          `overscrollBehavior${axis}`
        ];
      if (overscroll === "contain" || overscroll === "none") {
        break;
      }
    }
  }
  return true;
}

function nearestScroll(start: number, end: number, min: number, max: number) {
  if (start < min && end > max) {
    return 0;
  }
  if (start < min) {
    return end - start > max - min ? end - max : start - min;
  }
  if (end > max) {
    return end - start > max - min ? start - min : end - max;
  }
  return 0;
}

// Measure visibility through every clipping ancestor in the artboard document.
export function isCanvasElementVisible(target: HTMLElement) {
  const win = target.ownerDocument.defaultView;
  if (!win || !target.isConnected || !target.getClientRects().length) {
    return false;
  }
  const bounds = target.getBoundingClientRect();
  let left = Math.max(bounds.left, 0);
  let top = Math.max(bounds.top, 0);
  let right = Math.min(bounds.right, win.innerWidth);
  let bottom = Math.min(bounds.bottom, win.innerHeight);
  for (
    let parent = target.parentElement;
    parent;
    parent = parent.parentElement
  ) {
    const style = win.getComputedStyle(parent);
    const rect = parent.getBoundingClientRect();
    const scaleX = parent.offsetWidth ? rect.width / parent.offsetWidth : 1;
    const scaleY = parent.offsetHeight ? rect.height / parent.offsetHeight : 1;
    if (/^(auto|scroll|hidden|clip|overlay)$/.test(style.overflowX)) {
      const edge = rect.left + parent.clientLeft * scaleX;
      left = Math.max(left, edge);
      right = Math.min(right, edge + parent.clientWidth * scaleX);
    }
    if (/^(auto|scroll|hidden|clip|overlay)$/.test(style.overflowY)) {
      const edge = rect.top + parent.clientTop * scaleY;
      top = Math.max(top, edge);
      bottom = Math.min(bottom, edge + parent.clientHeight * scaleY);
    }
  }
  return right > left && bottom > top;
}

export function revealCanvasElement(target: HTMLElement) {
  if (!target.isConnected || !target.getClientRects().length) {
    return;
  }
  for (
    let container = target.parentElement;
    container;
    container = container.parentElement
  ) {
    if (!canScroll(container, "X") && !canScroll(container, "Y")) {
      continue;
    }
    // Re-read after each inner scroll, then reveal through the outer containers.
    const bounds = target.getBoundingClientRect();
    const rect = container.getBoundingClientRect();
    const scaleX = container.offsetWidth
      ? rect.width / container.offsetWidth
      : 1;
    const scaleY = container.offsetHeight
      ? rect.height / container.offsetHeight
      : 1;
    const left = rect.left + container.clientLeft * scaleX;
    const top = rect.top + container.clientTop * scaleY;
    const dx =
      canScroll(container, "X") && scaleX
        ? nearestScroll(
            bounds.left,
            bounds.right,
            left,
            left + container.clientWidth * scaleX,
          ) / scaleX
        : 0;
    const dy =
      canScroll(container, "Y") && scaleY
        ? nearestScroll(
            bounds.top,
            bounds.bottom,
            top,
            top + container.clientHeight * scaleY,
          ) / scaleY
        : 0;
    if (dx || dy) {
      container.scrollTo({
        left: container.scrollLeft + dx,
        top: container.scrollTop + dy,
        behavior: "instant",
      });
    }
  }
}
