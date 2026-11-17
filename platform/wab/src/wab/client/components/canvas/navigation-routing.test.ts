import { routeNavigation, routeSegmentBlocked } from "@/wab/client/components/canvas/navigation-routing";
import { ensure } from "@/wab/shared/common";
import { Rect } from "@/wab/shared/geom";

const frame = (left: number, top = 0, width = 400, height = 700): Rect => ({ left, top, width, height });
const source = { left: 300, top: 120, width: 80, height: 40 };

it("anchors to the trigger and destination and follows either one moving", () => {
  const a = frame(0), b = frame(640);
  const route = ensure(routeNavigation(source, a, b, [a, b]), "Expected a navigable route");
  expect(route.points[0]).toEqual({ x: 380, y: 140 });
  expect(route.points.at(-1)).toEqual({ x: 640, y: 140 });
  const moved = ensure(routeNavigation({ ...source, top: 240 }, a, b, [a, b]), "Expected a navigable route");
  expect(moved.points[0].y).toBe(260);
  const movedFrame = frame(-640, 120);
  const reversed = ensure(routeNavigation(source, a, movedFrame, [a, movedFrame]), "Expected a navigable route");
  expect(reversed.points[0].x).toBe(380);
  expect(reversed.points.at(-1)?.x).toBe(-640);
});

it("routes around intervening artboards and reroutes when an obstacle moves", () => {
  const a = frame(0), b = frame(1280), obstacle = frame(640);
  const route = ensure(routeNavigation(source, a, b, [a, obstacle, b]), "Expected a navigable route");
  expect(route.path).toContain("Q");
  for (let i = 1; i < route.points.length; i++) {
    expect(routeSegmentBlocked(route.points[i - 1], route.points[i], obstacle)).toBe(false);
  }
  expect(route.points.some((p) => p.y < 0 || p.y > 700)).toBe(true);
  const movedObstacle = frame(640, 900);
  const direct = ensure(routeNavigation(source, a, b, [a, movedObstacle, b]), "Expected a navigable route");
  expect(direct.points).toHaveLength(2);
});

it("enters the left side even for vertically stacked pages", () => {
  const a = frame(0), b = frame(0, 940);
  const route = ensure(routeNavigation({ left: 120, top: 600, width: 120, height: 40 }, a, b, [a, b]), "Expected a navigable route");
  expect(route.points[0]).toEqual({ x: 240, y: 620 });
  expect(route.points.at(-1)).toEqual({ x: 0, y: 964 });
});

it("does not invent a line through completely overlapping frames", () => {
  const a = frame(0), b = frame(0);
  expect(routeNavigation(source, a, b, [a, b])).toBeUndefined();
});

it("keeps routes deterministic and finite for negative coordinates and mixed viewport sizes", () => {
  const a = frame(-1800, -900, 1440, 1024), b = frame(0, -400, 390, 844);
  const origin = { left: -600, top: -700, width: 150, height: 36 };
  const route = ensure(routeNavigation(origin, a, b, [a, b]), "Expected a navigable route");
  expect(route).toEqual(routeNavigation(origin, a, b, [a, b]));
  expect(route.path).not.toMatch(/NaN|Infinity/);
});

function sharedRail(a: { x: number; y: number }[], b: { x: number; y: number }[]) {
  return a.slice(1).some((end, i) => b.slice(1).some((otherEnd, j) => {
    const start = a[i], otherStart = b[j];
    if (start.x === end.x && otherStart.x === otherEnd.x && start.x === otherStart.x) {
      return Math.min(Math.max(start.y, end.y), Math.max(otherStart.y, otherEnd.y)) > Math.max(Math.min(start.y, end.y), Math.min(otherStart.y, otherEnd.y));
    }
    if (start.y === end.y && otherStart.y === otherEnd.y && start.y === otherStart.y) {
      return Math.min(Math.max(start.x, end.x), Math.max(otherStart.x, otherEnd.x)) > Math.max(Math.min(start.x, end.x), Math.min(otherStart.x, otherEnd.x));
    }
    return false;
  }));
}

it.each([
  [640, 0], [0, 940], [640, 940], [-640, 940], [1280, 0],
])("separates both directions for destination (%i, %i), including detours", (left, top) => {
  const a = frame(0), b = frame(left, top);
  const obstacle = frame(640, 0);
  const frames = left === 1280 ? [a, obstacle, b] : [a, b];
  const first = ensure(routeNavigation(source, a, b, frames), "Forward route");
  const second = ensure(routeNavigation({ ...source, left: left + source.left, top: top + source.top }, b, a, frames), "Reverse route");
  expect(sharedRail(first.points, second.points)).toBe(false);
  for (const [route, target] of [[first, b], [second, a]] as const) {
    expect(route.points.at(-1)?.x).toBe(target.left);
    expect(ensure(route.points.at(-2), "Entry stem").x).toBeLessThan(target.left);
  }
});

it.each([1, 0.25, 2])("avoids measured title bounds at zoom %s", (zoom) => {
  const a = frame(0), b = frame(1280), obstacle = frame(640);
  const headers = [a, obstacle, b].map((r) => ({ left: r.left, top: -64 / zoom, width: 360, height: 48 / zoom }));
  for (const [origin, from, to] of [[source, a, b], [{ ...source, left: 1580 }, b, a]] as const) {
    const route = ensure(routeNavigation(origin, from, to, [a, obstacle, b], headers), "Title-aware route");
    for (let i = 1; i < route.points.length; i++) {
      for (const header of headers) {
        expect(routeSegmentBlocked(route.points[i - 1], route.points[i], header)).toBe(false);
      }
    }
  }
});
