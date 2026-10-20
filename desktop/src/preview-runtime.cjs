const { randomUUID } = require("node:crypto");
const { canvasFrames } = require("./canvas.cjs");
const { encodeImagePreview } = require("./image-preview.cjs");
const { sendCdp } = require("./cdp.cjs");

// Executed only in the existing live Preview iframe. Inputs are data, never code.
async function runtimeCommand(input, documentId) {
  const key = "__plasmicRuntimeInspection";
  if (!globalThis[key] || globalThis[key].page !== input.pageIdentity) {
    globalThis[key] = { page: input.pageIdentity, id: documentId, next: 0, ids: new WeakMap(), nodes: new Map() };
  }
  const store = globalThis[key];
  for (const [ref, element] of store.nodes) if (!element.isConnected) store.nodes.delete(ref);
  const visible = (el) => {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || el.closest('[hidden],[aria-hidden="true"],[inert]')) return false;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none" || style.opacity === "0" && !el.matches('input:not([type="hidden"])')) return false;
    for (let parent = el.parentElement; parent; parent = parent.parentElement) if (getComputedStyle(parent).opacity === "0") return false;
    return true;
  };
  const inViewport = (el) => {
    let r = el.getBoundingClientRect();
    let left = Math.max(0, r.left), right = Math.min(innerWidth, r.right), top = Math.max(0, r.top), bottom = Math.min(innerHeight, r.bottom);
    for (let parent = el.parentElement; parent; parent = parent.parentElement) {
      const s = getComputedStyle(parent), b = parent.getBoundingClientRect();
      if (["hidden", "clip", "auto", "scroll"].includes(s.overflowX)) { left = Math.max(left, b.left); right = Math.min(right, b.right); }
      if (["hidden", "clip", "auto", "scroll"].includes(s.overflowY)) { top = Math.max(top, b.top); bottom = Math.min(bottom, b.bottom); }
    }
    return right > left && bottom > top;
  };
  const role = (el) => el.getAttribute("role") || ({ BUTTON: "button", A: el.hasAttribute("href") ? "link" : "", TEXTAREA: "textbox", SELECT: "combobox", TABLE: "table", TR: "row", TD: "cell", TH: "columnheader", H1: "heading", H2: "heading", H3: "heading", DIALOG: "dialog", OPTION: "option" }[el.tagName]) || (el.tagName === "INPUT" ? ({ checkbox: "checkbox", radio: "radio", number: "spinbutton", button: "button", submit: "button", range: "slider" }[el.type] || "textbox") : "");
  const name = (el) => {
    const labelled = (el.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean).map((id) => document.getElementById(id)?.textContent || "").join(" ");
    return (el.getAttribute("aria-label") || labelled || (el.labels ? [...el.labels].map((n) => n.textContent).join(" ") : "") || el.getAttribute("alt") || el.getAttribute("placeholder") || el.getAttribute("title") || (el.matches("input,textarea,select") ? "" : el.innerText || el.textContent) || "").replace(/\s+/g, " ").trim();
  };
  const disabled = (el) => !!el.disabled || el.matches(":disabled") || el.getAttribute("aria-disabled") === "true" || !!el.closest("[inert]");
  const nodes = () => [...document.body.querySelectorAll("*")].filter(visible);
  const find = (locator) => nodes().filter((el) => (!locator.role || role(el) === locator.role) && (locator.name === undefined || name(el) === locator.name));
  const target = () => {
    const el = store.nodes.get(input.ref);
    if (!el?.isConnected || !input.ref?.startsWith(store.id + ":")) throw new Error("Stale Preview ref; take a new snapshot after navigation or element replacement");
    if (!visible(el)) throw new Error("Preview target is hidden");
    return el;
  };
  const settle = () => Promise.race([new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))), new Promise((resolve) => setTimeout(resolve, 100))]);
  if (input.action === "snapshot") {
    const all = nodes().filter((el) => role(el) || el.tabIndex >= 0 || ["auto", "scroll"].includes(getComputedStyle(el).overflowY));
    const items = all.slice(input.offset || 0, (input.offset || 0) + (input.limit || 40)).map((el) => {
      let ref = store.ids.get(el);
      if (!ref) { ref = store.id + ":" + (++store.next); store.ids.set(el, ref); }
      store.nodes.set(ref, el);
      const r = el.getBoundingClientRect();
      return { ref, role: role(el), name: name(el).slice(0, 180), tag: el.tagName.toLowerCase(), disabled: disabled(el), inViewport: inViewport(el),
        ...(el.matches("input,textarea,select") ? { value: el.type === "password" ? "[redacted]" : String(el.value).slice(0, 512), readOnly: !!el.readOnly, checked: !!el.checked } : {}),
        ...(el.hasAttribute("aria-expanded") ? { expanded: el.getAttribute("aria-expanded") === "true" } : {}),
        bounds: { x: r.x, y: r.y, width: r.width, height: r.height },
        ...(el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth ? { scroll: { top: el.scrollTop, left: el.scrollLeft, height: el.scrollHeight, width: el.scrollWidth, clientHeight: el.clientHeight, clientWidth: el.clientWidth } } : {}) };
    });
    const text = document.body.innerText || "";
    const start = input.textOffset || 0, end = Math.min(text.length, start + (input.textLimit || 3000));
    return { documentId: store.id, viewport: { width: innerWidth, height: innerHeight }, elements: items, total: all.length,
      ...( (input.offset || 0) + items.length < all.length ? { nextOffset: (input.offset || 0) + items.length } : {}),
      text: { offset: start, value: text.slice(start, end), total: text.length, ...(end < text.length ? { nextOffset: end } : {}) } };
  }
  if (input.action === "assert") {
    const evaluate = () => input.checks.map((check) => {
      const matches = check.role || check.name !== undefined ? find(check) : [];
      let actual, passed;
      if (check.kind === "text") { actual = (document.body.innerText || "").includes(check.text); passed = actual === check.present; }
      else if (check.kind === "count") { actual = matches.length; passed = actual === check.count; }
      else if (check.kind === "visible") { actual = matches.some(inViewport); passed = actual === check.present; }
      else if (check.kind === "value") { actual = matches.length === 1 && matches[0].type !== "password" ? String(matches[0].value) : null; passed = actual === check.value; }
      else throw new Error("Unsupported Preview assertion");
      return { check, passed, actual };
    });
    const deadline = Date.now() + (input.timeoutMs ?? 2000);
    let checks;
    do { checks = evaluate(); if (checks.every((c) => c.passed) || Date.now() >= deadline) break; await new Promise((r) => setTimeout(r, 100)); } while (true);
    return { passed: checks.every((c) => c.passed), checks };
  }
  const el = input.ref ? target() : document.scrollingElement;
  if (!el) throw new Error("Preview scroll root is unavailable");
  if (["click", "fill", "select", "press"].includes(input.action) && disabled(el)) throw new Error("Preview target is disabled");
  const targetInfo = { role: role(el), name: name(el) };
  if (["click", "hover"].includes(input.action)) {
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
    await settle();
    const rect = el.getBoundingClientRect(), point = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    const hit = document.elementFromPoint(point.x, point.y);
    if (!hit || !(el === hit || el.contains(hit) || hit.contains(el))) throw new Error("Preview target is covered or outside the visible viewport");
    return { point, target: targetInfo };
  }
  else if (input.action === "fill") {
    if (!el.matches("input,textarea") || ["file", "checkbox", "radio", "button", "submit", "hidden"].includes(el.type) || el.readOnly) throw new Error("fill requires an editable text/number input or textarea");
    el.focus();
    const prototype = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value").set.call(el, input.value);
    el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: input.value }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  } else if (input.action === "select") {
    if (!(el instanceof HTMLSelectElement)) throw new Error("select requires a native select; for Antd popup selectors click the combobox and then its option from a new snapshot");
    if (![...el.options].some((o) => o.value === input.value && !o.disabled)) throw new Error("Enabled option not found");
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(el, input.value);
    el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
  } else if (input.action === "press") { el.focus(); return { focused: true, target: targetInfo }; }
  else if (input.action === "scroll") el.scrollBy({ left: input.x || 0, top: input.y || 0, behavior: "instant" });
  else throw new Error("Unsupported Preview action");
  await settle();
  return { performed: input.action, target: targetInfo };
}

async function previewFrame(win, componentUuid) {
  if (!/\/preview(?:\/|$|-full(?:\/|$))/.test(new URL(win.webContents.getURL()).pathname)) throw new Error("Open native Preview first; the reference browser is not a runtime Preview");
  const frames = await canvasFrames(win, undefined, async function inspectPreview(expected) {
    await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 5000))]);
    await Promise.race([new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))), new Promise((r) => setTimeout(r, 100))]);
    const failure = document.querySelector("[data-plasmic-preview-error]");
    if (failure) throw new Error("Native Preview render failed: " + failure.textContent.slice(0, 1200));
    const root = document.querySelector(".live-root-container");
    const identity = root?.getAttribute("data-plasmic-preview-component");
    return { ready: !!root && root.getBoundingClientRect().width > 0 && (!expected || identity === expected), componentUuid: identity, width: innerWidth, height: innerHeight };
  }, componentUuid);
  if (frames.length !== 1) throw new Error("Expected one active native Preview iframe");
  return frames[0];
}

async function viewportRect(frame, viewport) {
  let rect = { x: 0, y: 0, width: viewport.width, height: viewport.height };
  for (let child = frame; child.parent; child = child.parent) {
    const index = child.parent.frames.indexOf(child);
    const box = await child.parent.executeJavaScript(`((index) => {
      const el = [...document.querySelectorAll('iframe')].find(el => el.contentWindow === window.frames[index]);
      if (!el || !el.clientWidth || !el.clientHeight) throw new Error('Preview iframe is not visible');
      const r = el.getBoundingClientRect(), sx = r.width / el.offsetWidth, sy = r.height / el.offsetHeight;
      return {x:r.x+el.clientLeft*sx,y:r.y+el.clientTop*sy,sx,sy};
    })(${index})`);
    rect = { x: box.x + rect.x * box.sx, y: box.y + rect.y * box.sy, width: rect.width * box.sx, height: rect.height * box.sy };
  }
  return Object.fromEntries(Object.entries(rect).map(([key, value]) => [key, Math.round(value)]));
}

async function runPreview(win, input, context) {
  const { frame, layout } = await previewFrame(win, context.previewContext?.componentUuid);
  const originalUrl = win.webContents.getURL();
  const settle = async () => {
    try { await frame.executeJavaScript("Promise.race([new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))),new Promise(r=>setTimeout(r,100))])"); }
    catch (error) { if (!frame.isDestroyed?.() && win.webContents.getURL() === originalUrl && win.webContents.mainFrame.framesInSubtree.includes(frame)) throw error; }
  };
  if (input.action === "screenshot") {
    const cssRect = await viewportRect(frame, { width: layout.width, height: layout.height });
    const zoom = win.webContents.getZoomFactor();
    const rect = Object.fromEntries(Object.entries(cssRect).map(([k, v]) => [k, Math.round(v * zoom)]));
    const bounds = win.getContentBounds();
    if (rect.x < 0 || rect.y < 0 || rect.x + rect.width > bounds.width + 1 || rect.y + rect.height > bounds.height + 1) throw new Error("Native Preview is clipped by the App window; reveal the full viewport before recording a screenshot");
    const image = await win.webContents.capturePage(rect);
    return { ...await encodeImagePreview(image.toPNG(), { lossless: input.fullResolution === true }), viewport: { width: layout.width, height: layout.height }, presentationRect: rect };
  }
  const result = await frame.executeJavaScript(`(${runtimeCommand.toString()})(${JSON.stringify({ ...input, pageIdentity: [context.sessionId, context.previewContext?.componentUuid, context.previewContext?.path].join(":") })},${JSON.stringify(randomUUID())})`, true);
  if (["click", "hover"].includes(input.action)) {
    const box = await viewportRect(frame, { width: layout.width, height: layout.height });
    const point = { x: box.x + result.point.x * box.width / layout.width, y: box.y + result.point.y * box.height / layout.height };
    await sendCdp(win.webContents, "Input.dispatchMouseEvent", { type: "mouseMoved", ...point });
    if (input.action === "click") {
      await sendCdp(win.webContents, "Input.dispatchMouseEvent", { type: "mousePressed", button: "left", clickCount: 1, ...point });
      await sendCdp(win.webContents, "Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", clickCount: 1, ...point });
    }
    await settle();
    return { performed: input.action, target: result.target };
  }
  if (input.action === "press") {
    const codes = { Enter: 13, Escape: 27, Tab: 9, ArrowDown: 40, ArrowUp: 38, ArrowLeft: 37, ArrowRight: 39, Space: 32, Backspace: 8, Delete: 46, Home: 36, End: 35 };
    const key = input.key === "Space" ? " " : input.key;
    await sendCdp(win.webContents, "Input.dispatchKeyEvent", { type: "keyDown", key, code: input.key, windowsVirtualKeyCode: codes[input.key], ...(input.key === "Enter" ? { text: "\r" } : input.key === "Space" ? { text: " " } : {}) });
    await sendCdp(win.webContents, "Input.dispatchKeyEvent", { type: "keyUp", key, code: input.key, windowsVirtualKeyCode: codes[input.key] });
    await settle();
    return { ...result, performed: "press", key: input.key };
  }
  return result;
}
module.exports = { runPreview, runtimeCommand, previewFrame, viewportRect };
