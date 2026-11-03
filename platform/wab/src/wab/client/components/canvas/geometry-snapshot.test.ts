import { computeClipBounds } from "@/wab/client/components/canvas/HoverBox/visible-bounds";
import { GeometrySnapshot } from "@/wab/client/components/canvas/geometry-snapshot";

afterEach(() => { document.body.innerHTML = ""; });

it("shares ancestor measurements between siblings within one query", () => {
  const parent = document.createElement("div");
  parent.style.overflow = "hidden";
  document.body.append(parent);
  const children = [document.createElement("span"), document.createElement("span")];
  parent.append(...children);
  const reads = Object.entries({ offsetWidth: 100, offsetHeight: 80, clientWidth: 100, clientHeight: 80, clientLeft: 0, clientTop: 0 }).map(([key, value]) => {
    const get = vi.fn(() => value);
    Object.defineProperty(parent, key, { configurable: true, get });
    return get;
  });
  const rect = vi.spyOn(parent, "getBoundingClientRect").mockReturnValue(new DOMRect(10, 20, 100, 80));
  const styles = vi.spyOn(window, "getComputedStyle");
  const snapshot = new GeometrySnapshot();
  expect(computeClipBounds(children[0], snapshot)).toEqual({ left: 10, top: 20, right: 110, bottom: 100 });
  expect(computeClipBounds(children[1], snapshot)).toEqual({ left: 10, top: 20, right: 110, bottom: 100 });
  expect(rect).toHaveBeenCalledTimes(1);
  expect(styles.mock.calls.filter(([element]) => element === parent)).toHaveLength(1);
  for (const read of reads) {
    expect(read).toHaveBeenCalledTimes(1);
  }
});

it("refreshes transformed padding boxes and viewport sizes in the next query", () => {
  const parent = document.createElement("div");
  parent.style.overflow = "hidden";
  document.body.append(parent);
  const child = document.createElement("div");
  parent.append(child);
  let width = 100;
  for (const [key, get] of Object.entries({
    offsetWidth: () => width,
    offsetHeight: () => 80,
    clientWidth: () => width - 8,
    clientHeight: () => 74,
    clientLeft: () => 3,
    clientTop: () => 2,
  })) {
    Object.defineProperty(parent, key, { configurable: true, get });
  }
  vi.spyOn(parent, "getBoundingClientRect").mockImplementation(() => new DOMRect(10.5, 20.25, width * 2, 160));
  let viewportWidth = 500;
  const rootWidth = vi.spyOn(document.documentElement, "clientWidth", "get").mockImplementation(() => viewportWidth);
  const first = new GeometrySnapshot();
  expect(computeClipBounds(child, first)).toEqual({ left: 16.5, top: 24.25, right: 200.5, bottom: 172.25 });
  width = 150;
  viewportWidth = 250;
  expect(computeClipBounds(child, first).right).toBe(200.5);
  expect(rootWidth).toHaveBeenCalledTimes(1);
  expect(computeClipBounds(child, new GeometrySnapshot())).toEqual({ left: 16.5, top: 24.25, right: 250, bottom: 172.25 });
});

it("matches uncached clipping across nested containing blocks and overflow axes", () => {
  const outer = document.createElement("div");
  const inner = document.createElement("div");
  const normal = document.createElement("div");
  const absolute = document.createElement("div");
  const fixed = document.createElement("div");
  absolute.style.position = "absolute";
  fixed.style.position = "fixed";
  document.body.append(outer);
  outer.append(inner);
  inner.append(normal, absolute, fixed);
  for (const [element, left] of [[outer, 10], [inner, 30]] as const) {
    for (const [key, value] of Object.entries({ offsetWidth: 100, offsetHeight: 80, clientWidth: 96, clientHeight: 76, clientLeft: 2, clientTop: 2 })) {
      Object.defineProperty(element, key, { configurable: true, value });
    }
    vi.spyOn(element, "getBoundingClientRect").mockReturnValue(new DOMRect(left, 20, 150, 120));
  }
  for (const position of ["static", "relative", "fixed"]) {
    for (const overflowX of ["visible", "hidden"]) {
      for (const contain of ["none", "paint"]) {
        Object.assign(outer.style, { position, overflowX, overflowY: "visible", contain });
        for (const transform of ["none", "scale(1.5)"]) {
          Object.assign(inner.style, { overflowX: "visible", overflowY: "hidden", transform });
          const query = new GeometrySnapshot();
          for (const child of [normal, absolute, fixed]) {
            expect(computeClipBounds(child, query)).toEqual(computeClipBounds(child));
          }
        }
      }
    }
  }
});

it("copies live style values and refreshes styles and geometry in the next query", () => {
  const element = document.createElement("div");
  document.body.append(element);
  element.style.visibility = "visible";
  let left = 10;
  const rect = vi.spyOn(element, "getBoundingClientRect").mockImplementation(() => new DOMRect(left, 0, 20, 10));
  const first = new GeometrySnapshot();
  expect(first.getStyle(element)?.visibility).toBe("visible");
  expect(first.getRect(element).left).toBe(10);
  element.style.visibility = "hidden";
  left = 40;
  expect(first.getStyle(element)?.visibility).toBe("visible");
  expect(first.getRect(element).left).toBe(10);
  const next = new GeometrySnapshot();
  expect(next.getStyle(element)?.visibility).toBe("hidden");
  expect(next.getRect(element).left).toBe(40);
  expect(rect).toHaveBeenCalledTimes(2);
});

it("preserves fixed and absolute containing-block rules with shared measurements", () => {
  const clipper = document.createElement("div"), child = document.createElement("div");
  clipper.style.overflow = "hidden";
  document.body.append(clipper);
  clipper.append(child);
  for (const [key, value] of Object.entries({ offsetWidth: 100, offsetHeight: 80, clientWidth: 100, clientHeight: 80, clientLeft: 0, clientTop: 0 })) {
    Object.defineProperty(clipper, key, { configurable: true, value });
  }
  vi.spyOn(clipper, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 100, 80));
  for (const position of ["fixed", "absolute"]) {
    child.style.position = position;
    clipper.style.transform = "none";
    const escaped = computeClipBounds(child, new GeometrySnapshot());
    expect(escaped).toEqual(computeClipBounds(child));
    clipper.style.transform = "translateX(0px)";
    const constrained = computeClipBounds(child, new GeometrySnapshot());
    expect(constrained).toEqual(computeClipBounds(child));
    expect(constrained.right).toBe(100);
    expect(constrained.bottom).toBe(80);
    expect(escaped.right).toBeGreaterThan(constrained.right);
  }
});

it("does not require a window for detached documents", () => {
  const element = document.implementation.createHTMLDocument().createElement("div");
  expect(new GeometrySnapshot().getStyle(element)).toBeUndefined();
});
