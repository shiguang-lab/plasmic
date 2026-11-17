import { Rect } from "@/wab/shared/geom";

export interface RoutePoint { x: number; y: number; }
export interface NavigationRoute { points: RoutePoint[]; path: string; label: RoutePoint; }
const bendPenalty = 24;
const distance = (a: RoutePoint, b: RoutePoint) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const inside = (p: RoutePoint, r: Rect) => p.x > r.left && p.x < r.left + r.width && p.y > r.top && p.y < r.top + r.height;
const expand = (r: Rect, clearance: number): Rect => ({ left: r.left - clearance, top: r.top - clearance, width: r.width + 2 * clearance, height: r.height + 2 * clearance });

/** Touching an obstacle boundary is allowed; crossing its interior is not. */
export function routeSegmentBlocked(a: RoutePoint, b: RoutePoint, r: Rect) {
  return a.x === b.x
    ? a.x > r.left && a.x < r.left + r.width && Math.max(a.y, b.y) > r.top && Math.min(a.y, b.y) < r.top + r.height
    : a.y > r.top && a.y < r.top + r.height && Math.max(a.x, b.x) > r.left && Math.min(a.x, b.x) < r.left + r.width;
}

function compact(points: RoutePoint[]) {
  const result: RoutePoint[] = [];
  for (const point of points) {
    if (result.length && distance(result[result.length - 1], point) < 0.01) { continue; }
    while (result.length >= 2) {
      const a = result[result.length - 2], b = result[result.length - 1];
      if (((a.x === b.x && b.x === point.x) || (a.y === b.y && b.y === point.y)) &&
        (b.x - a.x) * (point.x - b.x) + (b.y - a.y) * (point.y - b.y) >= 0) { result.pop(); }
      else { break; }
    }
    result.push(point);
  }
  return result;
}

/** Rounded orthogonal corners stay inside the reserved clearance around artboards. */
function roundedPath(points: RoutePoint[]) {
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1], b = points[i], c = points[i + 1];
    const radius = Math.min(10, distance(a, b) / 2, distance(b, c) / 2);
    const before = { x: b.x + Math.sign(a.x - b.x) * radius, y: b.y + Math.sign(a.y - b.y) * radius };
    const after = { x: b.x + Math.sign(c.x - b.x) * radius, y: b.y + Math.sign(c.y - b.y) * radius };
    path += ` L ${before.x} ${before.y} Q ${b.x} ${b.y} ${after.x} ${after.y}`;
  }
  const end = points[points.length - 1];
  return `${path} L ${end.x} ${end.y}`;
}

/** Right-side exits and left-side entries keep the direction legible. Opposite
 * directions reserve different corridors so their detours do not share a rail.
 * Headers are measured separately because their size is independent of zoom. */
export function routeNavigation(source: Rect, sourceFrame: Rect, targetFrame: Rect, frames: Rect[], headers: Rect[] = []): NavigationRoute | undefined {
  const forward = sourceFrame.left < targetFrame.left || (sourceFrame.left === targetFrame.left && sourceFrame.top < targetFrame.top);
  const clearance = forward ? 32 : 56;
  const obstacles = [...frames, ...headers].map((r) => expand(r, clearance));
  const y = Math.max(sourceFrame.top, Math.min(sourceFrame.top + sourceFrame.height, source.top + source.height / 2));
  const targetY = Math.max(targetFrame.top + 24, Math.min(targetFrame.top + targetFrame.height - 24, y));
  const starts = [{ anchor: { x: source.left + source.width, y }, outside: { x: sourceFrame.left + sourceFrame.width + clearance, y }, axis: 0 }];
  const ends = [{ anchor: { x: targetFrame.left, y: targetY }, outside: { x: targetFrame.left - clearance, y: targetY }, axis: 0 }];
  const xs = [...new Set([...obstacles.flatMap((r) => [r.left, r.left + r.width]), ...starts.map((p) => p.outside.x), ...ends.map((p) => p.outside.x)])].sort((a, b) => a - b);
  const ys = [...new Set([...obstacles.flatMap((r) => [r.top, r.top + r.height]), ...starts.map((p) => p.outside.y), ...ends.map((p) => p.outside.y)])].sort((a, b) => a - b);
  const pointAt = (index: number) => ({ x: xs[index % xs.length], y: ys[Math.floor(index / xs.length)] });
  const indexOf = (p: RoutePoint) => ys.indexOf(p.y) * xs.length + xs.indexOf(p.x);
  const count = xs.length * ys.length;
  const blocked = Array.from({ length: count }, (_, index) => obstacles.some((r) => inside(pointAt(index), r)));
  const costs = new Map<number, number>();
  const previous = new Map<number, number>();
  const origins = new Map<number, number>();
  const queue: { state: number; cost: number }[] = [];
  starts.forEach((port, index) => {
    const vertex = indexOf(port.outside);
    if (blocked[vertex] || [...frames, ...headers].some((r) => r !== sourceFrame && routeSegmentBlocked(port.anchor, port.outside, r))) { return; }
    const state = vertex * 2 + port.axis, cost = distance(port.anchor, port.outside);
    costs.set(state, cost); origins.set(state, index); queue.push({ state, cost });
  });
  let best: { state: number; end: number; cost: number } | undefined;
  while (queue.length) {
    queue.sort((a, b) => b.cost - a.cost);
    const current = queue.pop();
    if (!current || current.cost !== costs.get(current.state)) { continue; }
    if (best && current.cost >= best.cost) { break; }
    const vertex = Math.floor(current.state / 2), axis = current.state % 2, a = pointAt(vertex);
    ends.forEach((end, index) => {
      if (indexOf(end.outside) !== vertex || [...frames, ...headers].some((r) => r !== targetFrame && routeSegmentBlocked(end.outside, end.anchor, r))) { return; }
      const cost = current.cost + distance(end.outside, end.anchor) + (axis === end.axis ? 0 : bendPenalty);
      if (!best || cost < best.cost) { best = { state: current.state, end: index, cost }; }
    });
    const col = vertex % xs.length, row = Math.floor(vertex / xs.length);
    const neighbors = [col > 0 ? vertex - 1 : -1, col + 1 < xs.length ? vertex + 1 : -1, row > 0 ? vertex - xs.length : -1, row + 1 < ys.length ? vertex + xs.length : -1];
    for (const next of neighbors) {
      if (next < 0 || blocked[next]) { continue; }
      const b = pointAt(next), nextAxis = a.y === b.y ? 0 : 1;
      if (obstacles.some((r) => routeSegmentBlocked(a, b, r))) { continue; }
      const state = next * 2 + nextAxis;
      const cost = current.cost + distance(a, b) + (axis === nextAxis ? 0 : bendPenalty);
      if (cost >= (costs.get(state) ?? Infinity)) { continue; }
      costs.set(state, cost); previous.set(state, current.state);
      origins.set(state, origins.get(current.state) ?? 0); queue.push({ state, cost });
    }
  }
  if (!best) { return undefined; }
  const route: RoutePoint[] = [];
  for (let state: number | undefined = best.state; state !== undefined; state = previous.get(state)) { route.push(pointAt(Math.floor(state / 2))); }
  route.reverse();
  // Put controls on the longest outside segment, never in the source page.
  let label = route[0], longest = -1;
  for (let i = 1; i < route.length; i++) {
    const length = distance(route[i - 1], route[i]);
    if (length > longest) { longest = length; label = { x: (route[i - 1].x + route[i].x) / 2, y: (route[i - 1].y + route[i].y) / 2 }; }
  }
  const points = compact([starts[origins.get(best.state) ?? 0].anchor, ...route, ends[best.end].anchor]);
  return { points, path: roundedPath(points), label };
}
