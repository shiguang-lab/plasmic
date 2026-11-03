// Imported only by the private, frozen diagnostic build.
import type { Box } from "@/wab/shared/geom";
export type Mode = "baseline" | "cached-js" | "cached-wasm";
export const geometry = {
  mode: "baseline" as Mode, profile: false, samples: [] as any[],
  wasm: undefined as any, initMs: 0,
  async init(bytes: number[]) {
    const at = performance.now();
    this.wasm = (await WebAssembly.instantiate(new Uint8Array(bytes))).instance.exports;
    this.initMs = performance.now() - at;
  },
};
let active: any;
export function readRect(element: Element): DOMRect {
  const q = active;
  if (!q) return element.getBoundingClientRect();
  q.rectRequests++;
  if (q.rects?.has(element)) return q.rects.get(element);
  const at = geometry.profile ? performance.now() : 0;
  const rect = element.getBoundingClientRect();
  if (geometry.profile) q.rectMs += performance.now() - at;
  q.rectReads++;
  q.rects?.set(element, rect);
  return rect;
}
export function readStyle(win: Window, element: Element): CSSStyleDeclaration {
  const q = active;
  if (!q) return win.getComputedStyle(element);
  q.styleRequests++;
  if (q.styles?.has(element)) return q.styles.get(element);
  const at = geometry.profile ? performance.now() : 0;
  const live = win.getComputedStyle(element);
  // Cache the properties the read-only selection/clipping path actually uses.
  // Reusing only CSSStyleDeclaration would still invoke native property getters
  // on every ancestor visit.
  const style = q.styles ? Object.fromEntries([
    "position","display","contain","transform","perspective","filter",
    "backdropFilter","willChange","overflowX","overflowY","overflow","visibility",
  ].map(key=>[key,(live as any)[key]])) as unknown as CSSStyleDeclaration : live;
  if (geometry.profile) q.styleMs += performance.now() - at;
  q.styleReads++;
  q.styles?.set(element, style);
  return style;
}
export function clipQuery<T>(fn: () => T): T {
  const at = geometry.profile && active ? performance.now() : 0;
  try { return fn(); } finally { if (at) active.clipMs += performance.now() - at; }
}
export function geometryQuery<T>(vc: any, box: Box | undefined, fn: () => T): T {
  if (active) throw Error("Nested geometry diagnostic query");
  const cached = geometry.mode !== "baseline", at = performance.now();
  const q = active = {
    mode: geometry.mode, rects: cached ? new Map() : undefined,
    styles: cached ? new Map() : undefined, pending: [] as any[],
    rectReads: 0, rectRequests: 0, styleReads: 0, styleRequests: 0,
    rectMs: 0, styleMs: 0, clipMs: 0, predicateMs: 0, packMs: 0, kernelMs: 0,
    collectMs: 0, pruneMs: 0, numericRects: 0, selected: 0,
  };
  try {
    const result: any = fn(); q.selected = result.length;
    return result;
  } finally {
    q.totalMs = performance.now() - at;
    q.uniqueRects = q.rects?.size ?? q.rectReads;
    q.uniqueStyles = q.styles?.size ?? q.styleReads;
    // No DOM, ValNode, Map or Box is retained between calls.
    q.rects = q.styles = q.pending = undefined;
    active = undefined;
    if (geometry.samples.length < 2000) geometry.samples.push(q);
  }
}
export function geometryMatches(val: any, bounds: Box[], frame: Box, box: Box) {
  const q = active;
  q.numericRects += bounds.length;
  if (q.mode === "cached-wasm") {
    if (bounds.length) q.pending.push({ val, bounds, frame, box });
    return bounds.length > 0;
  }
  const at = geometry.profile ? performance.now() : 0;
  const result = bounds.length > 0 && bounds.every(b => frame.intersects(b) && box.containsBox(b));
  if (geometry.profile) q.predicateMs += performance.now() - at;
  return result;
}
export function finishGeometryCandidates<T>(values: T[]): T[] {
  const q = active;
  q.collectMs = performance.now() - q.startedAt;
  if (q.mode !== "cached-wasm" || !q.pending.length) {
    q.pruneAt = performance.now(); return values;
  }
  const w = geometry.wasm;
  if (!w) throw Error("WASM kernel not initialized");
  const at = performance.now(), n = q.numericRects, ptr = w.scratch_ptr(), out = ptr + n * 32;
  if (n * 33 > w.capacity()) throw Error("Diagnostic WASM scratch capacity exceeded");
  const packed = new Float64Array(w.memory.buffer, ptr, n * 4);
  let k = 0;
  for (const item of q.pending) for (const b of item.bounds) {
    packed[k++] = b.left(); packed[k++] = b.top(); packed[k++] = b.right(); packed[k++] = b.bottom();
  }
  q.packMs = performance.now() - at;
  const { frame: f, box: b } = q.pending[0], start = performance.now();
  w.contains(ptr, n, out, f.left(), f.top(), f.right(), f.bottom(), b.left(), b.top(), b.right(), b.bottom());
  q.kernelMs = performance.now() - start;
  const flags = new Uint8Array(w.memory.buffer, out, n), pass = new Set();
  k = 0;
  for (const item of q.pending) {
    let ok = true;
    for (const _ of item.bounds) if (!flags[k++]) ok = false;
    if (ok) pass.add(item.val);
  }
  const result = values.filter(v => pass.has(v));
  q.pruneAt = performance.now();
  return result;
}
export function startGeometryCollect() { active.startedAt = performance.now(); }
export function finishGeometryPrune() { active.pruneMs = performance.now() - active.pruneAt; }
