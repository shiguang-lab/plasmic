const FULL_EXPAND_ATTR = "data-wab-full-expand";
const FULL_HEIGHT_CLASS = "__wab_root--full-height";
const OVERLAY_SELECTOR =
  ".ant-modal, .ant-drawer, .ant-popover, .ant-tooltip, .ant-dropdown, .ant-select-dropdown, .__wab_canvas_overlay";
const IGNORED_TAGS = new Set([
  "TEXTAREA",
  "SELECT",
  "INPUT",
  "OPTION",
  "OPTGROUP",
  "SVG",
  "VIDEO",
  "CANVAS",
  "IFRAME",
  "IMG",
]);
const SCROLLABLE_OVERFLOW = /^(auto|scroll|overlay)$/;
const OVERFLOW_TOLERANCE_PX = 2;

function getWabRoot(userBody: HTMLElement): HTMLElement | null {
  if (userBody.classList.contains("__wab_root")) {
    return userBody;
  }
  return userBody.querySelector<HTMLElement>(".__wab_root");
}

function isFixedOrOverlay(element: HTMLElement, win: Window): boolean {
  if (element.closest(OVERLAY_SELECTOR)) {
    return true;
  }
  return win.getComputedStyle(element).position === "fixed";
}

function hasFixedAncestor(
  element: HTMLElement,
  root: HTMLElement,
  win: Window,
): boolean {
  for (
    let curr: HTMLElement | null = element;
    curr && curr !== root;
    curr = curr.parentElement
  ) {
    if (isFixedOrOverlay(curr, win)) {
      return true;
    }
  }
  return false;
}

function getOverflowY(style: CSSStyleDeclaration): string {
  if (style.overflowY) {
    return style.overflowY;
  }
  const parts = style.overflow.trim().split(/\s+/);
  return parts[1] ?? parts[0] ?? "";
}

function getLayoutParent(
  element: HTMLElement,
  win: Window,
): HTMLElement | null {
  let parent = element.parentElement;
  while (parent && win.getComputedStyle(parent).display === "contents") {
    parent = parent.parentElement;
  }
  return parent;
}

function getExpandAttributeValue(
  element: HTMLElement,
  win: Window,
): "column-item" | "1" {
  const parent = getLayoutParent(element, win);
  const parentStyle = parent ? win.getComputedStyle(parent) : undefined;
  const isColumnFlexChild =
    !!parentStyle &&
    (parentStyle.display === "flex" || parentStyle.display === "inline-flex") &&
    (parentStyle.flexDirection === "column" ||
      parentStyle.flexDirection === "column-reverse");
  return isColumnFlexChild ? "column-item" : "1";
}

/**
 * Clears any full-height expansion markers inside `userBody`.
 */
export function clearFullHeightExpansion(userBody: HTMLElement): boolean {
  let changed = false;
  for (const el of Array.from(
    userBody.querySelectorAll<HTMLElement>(`[${FULL_EXPAND_ATTR}]`),
  )) {
    el.removeAttribute(FULL_EXPAND_ATTR);
    changed = true;
  }
  return changed;
}

/**
 * Expands vertically scrolling containers and viewport-locked page/shell wrappers
 * when `__wab_root--full-height` is active, without mutating authored styles.
 */
export function syncFullHeightExpansion(userBody: HTMLElement): boolean {
  const root = getWabRoot(userBody);
  if (!root || !root.classList.contains(FULL_HEIGHT_CLASS)) {
    return clearFullHeightExpansion(userBody);
  }
  const win = root.ownerDocument.defaultView;
  if (!win) {
    return false;
  }

  // Re-measure from un-expanded layout so containers whose overflow cleared,
  // whose parent flex direction changed, or that moved into overlays update cleanly.
  const previous = new Map<HTMLElement, string>();
  for (const el of Array.from(
    root.querySelectorAll<HTMLElement>(`[${FULL_EXPAND_ATTR}]`),
  )) {
    const value = el.getAttribute(FULL_EXPAND_ATTR);
    if (value !== null) {
      previous.set(el, value);
      el.removeAttribute(FULL_EXPAND_ATTR);
    }
  }

  const viewportHeight =
    parseFloat(root.style.getPropertyValue("--viewport-height")) || 0;
  const targets = new Set<HTMLElement>();

  for (const el of Array.from(root.querySelectorAll<HTMLElement>("*"))) {
    if (IGNORED_TAGS.has(el.tagName)) {
      continue;
    }
    const style = win.getComputedStyle(el);
    if (
      style.display === "none" ||
      style.display === "contents" ||
      el.getClientRects().length === 0
    ) {
      continue;
    }
    if (hasFixedAncestor(el, root, win)) {
      continue;
    }
    const overflowsVertically =
      el.scrollHeight > el.clientHeight + OVERFLOW_TOLERANCE_PX;
    if (!overflowsVertically) {
      continue;
    }

    const isScrollContainer = SCROLLABLE_OVERFLOW.test(getOverflowY(style));
    const isViewportConstrained =
      (viewportHeight > 0
        ? el.clientHeight >= viewportHeight - OVERFLOW_TOLERANCE_PX
        : el.parentElement === root) &&
      style.whiteSpace !== "nowrap" &&
      (!style.webkitLineClamp || style.webkitLineClamp === "none");

    if (!isScrollContainer && !isViewportConstrained) {
      continue;
    }

    for (
      let curr: HTMLElement | null = el;
      curr && curr !== root;
      curr = curr.parentElement
    ) {
      targets.add(curr);
    }
  }

  const next = new Map<HTMLElement, string>();
  for (const target of targets) {
    const value = getExpandAttributeValue(target, win);
    target.setAttribute(FULL_EXPAND_ATTR, value);
    next.set(target, value);
  }

  if (previous.size !== next.size) {
    return true;
  }
  for (const [el, value] of next) {
    if (previous.get(el) !== value) {
      return true;
    }
  }
  return false;
}

/**
 * Keeps full-height expansion synchronized across class, DOM, and head style updates.
 */
export function observeFullHeightExpansion(userBody: HTMLElement): {
  scheduleSync: () => void;
  dispose: () => void;
} {
  const win = userBody.ownerDocument.defaultView ?? window;
  let closed = false;
  let pendingFrame: number | undefined;

  const runSync = () => {
    pendingFrame = undefined;
    if (closed) {
      return;
    }
    syncFullHeightExpansion(userBody);
  };

  const scheduleSync = () => {
    if (closed || pendingFrame !== undefined) {
      return;
    }
    pendingFrame = win.requestAnimationFrame(runSync);
  };

  const bodyObserver = new MutationObserver(() => {
    scheduleSync();
  });
  bodyObserver.observe(userBody, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style", "hidden"],
  });

  let headObserver: MutationObserver | undefined;
  const head = userBody.ownerDocument.head;
  if (head) {
    headObserver = new MutationObserver(() => {
      scheduleSync();
    });
    headObserver.observe(head, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  const handleLoad = () => {
    scheduleSync();
  };
  userBody.addEventListener("load", handleLoad, true);
  void userBody.ownerDocument.fonts?.ready.then(() => {
    if (!closed) {
      scheduleSync();
    }
  });

  syncFullHeightExpansion(userBody);

  return {
    scheduleSync,
    dispose: () => {
      if (closed) {
        return;
      }
      closed = true;
      bodyObserver.disconnect();
      headObserver?.disconnect();
      userBody.removeEventListener("load", handleLoad, true);
      if (pendingFrame !== undefined) {
        win.cancelAnimationFrame(pendingFrame);
        pendingFrame = undefined;
      }
      clearFullHeightExpansion(userBody);
    },
  };
}
