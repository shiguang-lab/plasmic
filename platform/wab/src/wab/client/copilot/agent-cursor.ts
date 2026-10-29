import { ensure } from "@/wab/shared/common";

export interface AgentCursorPoint {
  x: number;
  y: number;
}

export const AGENT_CURSOR_IDLE_MS = 6500;

/** Transient UI only. Coordinates belong to the container; size belongs to the screen. */
export function createAgentCursor(
  container: HTMLElement,
  options: { label: string; color: string; scale: () => number },
) {
  const doc = container.ownerDocument;
  const win = ensure(doc.defaultView, "Cursor document has no window");
  const reduced = win.matchMedia("(prefers-reduced-motion: reduce)");
  const root = doc.createElement("div");
  root.setAttribute("data-plasmic-agent-cursor", "");
  root.setAttribute("aria-hidden", "true");
  root.style.cssText = "position:absolute;left:0;top:0;pointer-events:none;transform-origin:0 0;z-index:2147483647;display:none;";
  // Isolate the label and glyph from business CSS, snapshots and text inspection.
  const shadow = root.attachShadow({ mode: "open" });
  const style = doc.createElement("style");
  style.textContent = `
    :host { pointer-events:none; }
    svg { position:absolute;left:-5px;top:-5px;width:24px;height:24px;overflow:visible;filter:drop-shadow(0 2px 3px #0006); }
    span { position:absolute;left:15px;top:19px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:3px 7px;border-radius:5px;font:500 11px/15px -apple-system,BlinkMacSystemFont,sans-serif;color:white;box-shadow:0 2px 6px #0003; }
  `;
  const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  const path = doc.createElementNS(svg.namespaceURI, "path");
  path.setAttribute("d", "M5.75 5.75L11 18.25 13 13l5.25-2-12.5-5.25z");
  path.setAttribute("fill", options.color);
  path.setAttribute("stroke", "white");
  path.setAttribute("stroke-width", "1.5");
  path.setAttribute("stroke-linejoin", "round");
  svg.append(path);
  const label = doc.createElement("span");
  label.style.background = options.color;
  label.textContent = options.label;
  shadow.append(style, svg, label);
  container.append(root);

  let current: AgentCursorPoint | undefined;
  let target: AgentCursorPoint | undefined;
  let key: unknown;
  let appeared = 0;
  let touched = 0;
  let previous = 0;
  let frame = 0;
  let hidden = false;
  let disposed = false;
  const phase = Math.random() * Math.PI * 2;

  const clear = () => {
    win.cancelAnimationFrame(frame);
    frame = 0;
    current = target = undefined;
    key = undefined;
    root.style.display = "none";
  };
  const tick = (now: number) => {
    frame = 0;
    if (!current || !target || disposed) {
      return;
    }
    if (now - touched >= AGENT_CURSOR_IDLE_MS) {
      const expiredKey = key;
      clear();
      // Layout tracking must not revive an expired operation.
      key = expiredKey;
      return;
    }
    const dt = Math.min(0.1, Math.max(0, (now - previous) / 1000));
    previous = now;
    const blend = reduced.matches ? 1 : 1 - Math.exp(-7 * dt);
    current.x += (target.x - current.x) * blend;
    current.y += (target.y - current.y) * blend;
    const scale = Math.max(0.01, options.scale());
    const idle = now - touched;
    const wobble = reduced.matches ? 0 : Math.min(1, Math.max(0, (idle - 250) / 600)) * 3 / scale;
    const x = current.x + Math.cos(now * 0.003 + phase) * wobble;
    const y = current.y + Math.sin(now * 0.0023 + phase) * wobble;
    const fadeIn = reduced.matches ? 1 : Math.min(1, Math.max(0, (now - appeared) / 200));
    const fadeOut = Math.min(1, Math.max(0, (AGENT_CURSOR_IDLE_MS - idle) / 1500));
    root.style.transform = `translate3d(${x}px,${y}px,0) scale(${1 / scale})`;
    root.style.opacity = String(fadeIn * fadeOut);
    root.style.display = hidden ? "none" : "block";
    frame = win.requestAnimationFrame(tick);
  };
  const update = (id: unknown, point: AgentCursorPoint, name = options.label) => {
    if (disposed || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      return;
    }
    const now = win.performance.now();
    if (id === key && !current) {
      return;
    }
    label.textContent = name;
    if (!current) {
      current = { ...point };
      appeared = previous = now;
    }
    if (id !== key) {
      touched = now;
    }
    key = id;
    target = { ...point };
    if (!frame) {
      frame = win.requestAnimationFrame(tick);
    }
  };
  const hide = (value: boolean) => {
    hidden = value;
    root.style.display = value || !current ? "none" : "block";
  };
  const dispose = () => {
    clear();
    disposed = true;
    win.removeEventListener("pagehide", clear);
    root.remove();
  };
  win.addEventListener("pagehide", clear);
  return { update, clear, hide, dispose };
}

/** The desktop sends only transient feedback; actual input continues through CDP. */
export function installPreviewAgentCursor(
  win: Window,
  options: { label: string; color: string; scale: () => number },
) {
  const host = win.document.createElement("div");
  host.style.cssText = "position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:2147483647;";
  host.setAttribute("data-plasmic-agent-cursor", "");
  host.setAttribute("aria-hidden", "true");
  win.document.documentElement.append(host);
  const cursor = createAgentCursor(host, options);
  let target: Element | undefined;
  let point: AgentCursorPoint | undefined;
  let name = options.label;
  let id = 0;
  let frame = 0;
  let expires = 0;
  const track = () => {
    if (!target?.isConnected || win.performance.now() >= expires) {
      cursor.clear();
      frame = 0;
      return;
    }
    const rect = target.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      cursor.clear();
      frame = 0;
      return;
    }
    // Keep the real hit point's offset as its element moves or scrolls.
    cursor.update(id, { x: rect.left + (point?.x ?? rect.width / 2), y: rect.top + (point?.y ?? rect.height / 2) }, name);
    frame = win.requestAnimationFrame(track);
  };
  const clear = () => {
    win.cancelAnimationFrame(frame);
    frame = 0;
    target = undefined;
    cursor.clear();
  };
  const receive = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (detail?.action === "hide" || detail?.action === "show") {
      cursor.hide(detail.action === "hide");
    } else if (detail?.action === "clear") {
      clear();
    } else if (detail?.action === "move" && detail.element?.ownerDocument === win.document) {
      win.cancelAnimationFrame(frame);
      target = detail.element;
      point = detail.point;
      name = detail.caller?.name ?? options.label;
      id++;
      expires = win.performance.now() + AGENT_CURSOR_IDLE_MS;
      track();
    }
  };
  win.addEventListener("plasmic-agent-cursor", receive);
  return () => {
    clear();
    win.removeEventListener("plasmic-agent-cursor", receive);
    host.remove();
    cursor.dispose();
  };
}
