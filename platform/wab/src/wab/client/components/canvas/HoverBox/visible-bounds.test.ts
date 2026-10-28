import { recomputeBounds } from "@/wab/client/components/canvas/HoverBox/recomputeBounds";
import {
  canRevealEdge,
  computeElementVisibility,
  geometryLayerStyle,
  getVisibleFrameRect,
  revealEdge,
} from "@/wab/client/components/canvas/HoverBox/visible-bounds";
import { Box } from "@/wab/shared/geom";
import $ from "jquery";

// jsdom has no layout; give each element a fixed border box. Borders are 0,
// so the padding box equals the border box.
function box(
  elt: HTMLElement,
  rect: Box,
  style: Partial<CSSStyleDeclaration> = {},
) {
  Object.assign(elt.style, style);
  for (const [key, value] of Object.entries({
    offsetWidth: rect.width(),
    offsetHeight: rect.height(),
    clientWidth: rect.width(),
    clientHeight: rect.height(),
    clientLeft: 0,
    clientTop: 0,
  })) {
    Object.defineProperty(elt, key, { configurable: true, value });
  }
  vi.spyOn(elt, "getBoundingClientRect").mockReturnValue(
    new DOMRect(rect.left(), rect.top(), rect.width(), rect.height()),
  );
  return elt;
}

function div(
  rect: Box,
  style: Partial<CSSStyleDeclaration> = {},
  parent: HTMLElement = document.body,
) {
  const elt = document.createElement("div");
  parent.appendChild(elt);
  return box(elt, rect, style);
}

function visibilityOf(elt: HTMLElement) {
  const $elt = $(elt);
  return computeElementVisibility($elt, recomputeBounds($elt));
}

afterEach(() => {
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("data-plasmic-content-editor");
});

it("excludes hidden ancestors and siblings from content-editing overlays even when they still have layout boxes", () => {
  const ancestor = div(new Box(0, 0, 800, 600));
  const root = div(new Box(50, 60, 300, 200), {}, ancestor);
  const child = div(new Box(70, 80, 50, 30), {}, root);
  const sibling = div(new Box(50, 400, 100, 100), {}, ancestor);
  root.setAttribute("data-plasmic-content-target", "");
  document.documentElement.setAttribute("data-plasmic-content-editor", "");
  expect(visibilityOf(ancestor).visible).toBeUndefined();
  expect(visibilityOf(sibling).visible).toBeUndefined();
  expect(visibilityOf(root).visible).toBeDefined();
  expect(visibilityOf(child).visible).toBeDefined();
});

// jsdom's viewport is window.innerWidth × innerHeight (1024 × 768).

it("keeps the outline of a visibility: hidden element, which still has its box", () => {
  const elt = div(new Box(10, 20, 300, 200), { visibility: "hidden" });
  const { geometry, visible } = visibilityOf(elt);
  expect(visible?.rect()).toEqual(geometry.rect());
});

it("keeps the real box for an element that is fully visible", () => {
  const elt = div(new Box(10, 20, 300, 200));
  const { geometry, visible, clippedSides } = visibilityOf(elt);
  expect(visible?.rect()).toEqual(geometry.rect());
  expect(clippedSides).toEqual({
    top: false,
    right: false,
    bottom: false,
    left: false,
  });
});

it("clips each axis by its own overflow", () => {
  // A table column scrolled partly out to the left of a container that clips
  // only horizontally (`clip` keeps the other axis `visible`).
  const scroller = div(new Box(100, 100, 400, 300), {
    overflowX: "clip",
    overflowY: "visible",
  });
  const column = div(new Box(80, 40, 200, 600), {}, scroller);
  const { geometry, visible, clippedSides } = visibilityOf(column);
  expect(geometry.rect()).toEqual(new Box(80, 40, 200, 600).rect());
  // Only the left side is cut; the column still overflows vertically.
  expect(visible?.rect()).toEqual(
    Box.fromRectSides({ top: 80, left: 100, right: 240, bottom: 680 }).rect(),
  );
  expect(clippedSides).toEqual({
    top: false,
    right: false,
    bottom: false,
    left: true,
  });
});

it("clips to the artboard viewport", () => {
  const table = div(new Box(600, 50, 900, 500));
  const { geometry, visible, clippedSides } = visibilityOf(table);
  expect(geometry.height()).toBe(500);
  expect(visible?.rect()).toEqual(new Box(600, 50, 900, 168).rect());
  expect(clippedSides.bottom).toBe(true);
  expect(clippedSides.top || clippedSides.left || clippedSides.right).toBe(
    false,
  );
});

it("intersects every clipping ancestor", () => {
  const outer = div(new Box(0, 0, 500, 300), { overflow: "hidden" });
  const inner = div(new Box(50, 100, 600, 600), { overflow: "hidden" }, outer);
  const elt = div(new Box(20, 80, 700, 700), {}, inner);
  expect(visibilityOf(elt).visible?.rect()).toEqual(
    Box.fromRectSides({ top: 50, left: 100, right: 500, bottom: 300 }).rect(),
  );
});

it("ignores overflow ancestors outside an absolute element's containing block chain", () => {
  const positioned = div(new Box(0, 0, 800, 700), {
    position: "relative",
    overflow: "hidden",
  });
  const staticClipper = div(
    new Box(0, 0, 100, 100),
    { overflow: "hidden" },
    positioned,
  );
  const popup = div(
    new Box(50, 50, 300, 900),
    { position: "absolute" },
    staticClipper,
  );
  // Escapes the static clipper but not its positioned containing block.
  expect(visibilityOf(popup).visible?.rect()).toEqual(
    new Box(50, 50, 300, 650).rect(),
  );
});

it("lets fixed elements escape overflow ancestors unless one is transformed", () => {
  const clipper = div(new Box(0, 0, 100, 100), { overflow: "hidden" });
  const fixed = div(new Box(10, 10, 300, 300), { position: "fixed" }, clipper);
  expect(visibilityOf(fixed).visible?.rect()).toEqual(
    new Box(10, 10, 300, 300).rect(),
  );
  clipper.style.transform = "translateX(0px)";
  expect(visibilityOf(fixed).visible?.rect()).toEqual(
    new Box(10, 10, 90, 90).rect(),
  );
});

it("reports nothing visible for an element scrolled out of view", () => {
  const scroller = div(new Box(0, 0, 400, 300), { overflowY: "scroll" });
  const row = div(new Box(400, 0, 400, 40), {}, scroller);
  const { visible, clippedSides } = visibilityOf(row);
  expect(visible).toBeUndefined();
  expect(Object.values(clippedSides).every(Boolean)).toBe(true);
});

it("unions the visible parts of multi-root selections", () => {
  const scroller = div(new Box(0, 0, 200, 200), { overflow: "auto" });
  const a = div(new Box(150, 20, 50, 100), {}, scroller);
  const b = div(new Box(10, 300, 50, 50));
  const $node = $([a, b]);
  const { geometry, visible, clippedSides } = computeElementVisibility(
    $node,
    recomputeBounds($node),
  );
  expect(geometry.rect()).toEqual(
    Box.fromRectSides({ top: 10, left: 20, right: 350, bottom: 250 }).rect(),
  );
  expect(visible?.rect()).toEqual(
    Box.fromRectSides({ top: 10, left: 20, right: 350, bottom: 200 }).rect(),
  );
  expect(clippedSides.bottom).toBe(true);
});

it("lays out a geometry layer on the real box and cuts only clipped sides", () => {
  const geometry = { top: 0, left: 40, width: 200, height: 600 };
  const visible = { top: 0, left: 100, width: 140, height: 400 };
  const style = geometryLayerStyle(
    geometry,
    visible,
    { top: false, right: false, bottom: true, left: true },
    2,
  );
  expect(style).toMatchObject({
    position: "absolute",
    top: 0,
    left: -120,
    width: 400,
    height: 1200,
    clipPath: "inset(-100000px -100000px 400px 120px)",
  });
  expect(
    geometryLayerStyle(
      geometry,
      geometry,
      { top: false, right: false, bottom: false, left: false },
      1,
    ).clipPath,
  ).toBeUndefined();
});

it("anchors element UI on the visible part, falling back to the real box", () => {
  const scroller = div(new Box(0, 0, 400, 300), { overflow: "hidden" });
  const clipped = div(new Box(100, 20, 200, 500), {}, scroller);
  expect(getVisibleFrameRect(clipped).rect()).toEqual(
    new Box(100, 20, 200, 200).rect(),
  );
  // Entirely clipped: keep the real box so callers still have an anchor.
  const hidden = div(new Box(400, 20, 200, 50), {}, scroller);
  expect(getVisibleFrameRect(hidden).rect()).toEqual(
    new Box(400, 20, 200, 50).rect(),
  );
});

describe("clipped edges", () => {
  // A 400×300 scroll container with 900px of content, and a 200×500 child
  // starting 100px down its content.
  function scrolled(overflowY: string, scrollTop = 0) {
    const scroller = div(new Box(0, 0, 400, 300), { overflowY });
    let position = scrollTop;
    Object.defineProperty(scroller, "scrollHeight", {
      configurable: true,
      value: 900,
    });
    Object.defineProperty(scroller, "scrollTop", {
      configurable: true,
      get: () => position,
      set: (value: number) => {
        position = value;
      },
    });
    scroller.scrollTo = vi.fn((options: ScrollToOptions) => {
      position = Math.max(0, Math.min(600, options.top ?? position));
    }) as typeof scroller.scrollTo;
    const child = div(new Box(100, 20, 200, 500), {}, scroller);
    vi.spyOn(child, "getBoundingClientRect").mockImplementation(
      () => new DOMRect(20, 100 - position, 200, 500),
    );
    return { scroller, child, scrollTop: () => position };
  }

  it("scrolls a hidden bottom edge into view with a margin", () => {
    const { child, scrollTop } = scrolled("auto");
    expect(canRevealEdge([child], "bottom")).toBe(true);
    revealEdge([child], "bottom");
    // The bottom edge was 300px past the container; 16px margin.
    expect(scrollTop()).toBe(316);
    expect(child.getBoundingClientRect().bottom).toBe(284);
    expect(visibilityOf(child).clippedSides.bottom).toBe(false);
    // Now the top edge is the hidden one, and it scrolls back.
    expect(canRevealEdge([child], "top")).toBe(true);
    revealEdge([child], "top");
    expect(scrollTop()).toBe(84);
    expect(child.getBoundingClientRect().top).toBe(16);
  });

  it("can't reveal edges cut off by a container that doesn't scroll", () => {
    const { scroller, child } = scrolled("hidden");
    expect(canRevealEdge([child], "bottom")).toBe(false);
    revealEdge([child], "bottom");
    expect(scroller.scrollTo).not.toHaveBeenCalled();
  });

  it("has nothing to reveal on an edge that isn't hidden", () => {
    const { child } = scrolled("auto");
    expect(canRevealEdge([child], "top")).toBe(false);
  });
});
