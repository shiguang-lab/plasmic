import {
  handleCanvasContentWheel,
  revealCanvasElement,
} from "@/wab/client/components/canvas/canvas-scroll";

function box(parent: HTMLElement = document.body, overflow = "auto") {
  const element = document.createElement("div");
  element.style.overflowX = overflow;
  element.style.overflowY = overflow;
  parent.append(element);
  for (const [key, value] of Object.entries({
    clientWidth: 200,
    clientHeight: 100,
    scrollWidth: 600,
    scrollHeight: 600,
    offsetWidth: 200,
    offsetHeight: 100,
    clientLeft: 0,
    clientTop: 0,
  })) {
    Object.defineProperty(element, key, { value, configurable: true });
  }
  element.scrollTo = vi.fn((options: ScrollToOptions) => {
    if (options.top !== undefined) {
      element.scrollTop = Math.max(0, Math.min(500, options.top));
    }
    if (options.left !== undefined) {
      element.scrollLeft = Math.max(0, Math.min(400, options.left));
    }
  }) as typeof element.scrollTo;
  vi.spyOn(element, "getBoundingClientRect").mockImplementation(
    () => new DOMRect(0, 0, 200, 100),
  );
  return element;
}

function target(parent: HTMLElement, rect: () => DOMRect) {
  const element = document.createElement("div");
  parent.append(element);
  vi.spyOn(element, "getBoundingClientRect").mockImplementation(rect);
  vi.spyOn(element, "getClientRects").mockReturnValue([
    rect(),
  ] as unknown as DOMRectList);
  return element;
}

function wheel(options: WheelEventInit = {}) {
  return new WheelEvent("wheel", {
    altKey: true,
    deltaY: 50,
    cancelable: true,
    ...options,
  });
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("canvas content wheel", () => {
  it.each([{ altKey: false }, { ctrlKey: true }, { metaKey: true }])(
    "leaves pan and zoom gestures to Studio: %j",
    (options) => {
      const container = box();
      const event = wheel(options);
      expect(handleCanvasContentWheel(event, container)).toBe(false);
      expect(event.defaultPrevented).toBe(false);
      expect(container.scrollTo).not.toHaveBeenCalled();
    },
  );

  it("scrolls the nearest container from its content without changing its size", () => {
    const outer = box();
    const inner = box(outer);
    const child = document.createElement("span");
    inner.append(child);
    const event = wheel();
    expect(handleCanvasContentWheel(event, child)).toBe(true);
    expect(inner.scrollTop).toBe(50);
    expect(outer.scrollTop).toBe(0);
    expect(event.defaultPrevented).toBe(true);
    expect(inner.clientHeight).toBe(100);
  });

  it("chains to the outer container when the inner reaches its boundary", () => {
    const outer = box();
    const inner = box(outer);
    inner.scrollTop = 500;
    handleCanvasContentWheel(wheel(), inner);
    expect(inner.scrollTop).toBe(500);
    expect(outer.scrollTop).toBe(50);
  });

  it("respects overscroll containment and consumes at the boundary", () => {
    const outer = box();
    const inner = box(outer);
    inner.style.overscrollBehaviorY = "contain";
    // jsdom does not expose this browser CSS property on computed styles.
    const getComputedStyle = window.getComputedStyle.bind(window);
    const style = getComputedStyle(inner);
    Object.defineProperty(style, "overscrollBehaviorY", { value: "contain" });
    vi.spyOn(window, "getComputedStyle").mockImplementation((element) =>
      element === inner ? style : getComputedStyle(element),
    );
    inner.scrollTop = 500;
    const event = wheel();
    expect(handleCanvasContentWheel(event, inner)).toBe(true);
    expect(outer.scrollTop).toBe(0);
    expect(event.defaultPrevented).toBe(true);
  });

  it("skips hidden overflow and supports overflow scroll", () => {
    const outer = box(document.body, "scroll");
    const hidden = box(outer, "hidden");
    handleCanvasContentWheel(wheel(), hidden);
    expect(hidden.scrollTop).toBe(0);
    expect(outer.scrollTop).toBe(50);
  });

  it("normalizes horizontal line units and vertical page units", () => {
    const container = box();
    handleCanvasContentWheel(
      wheel({ deltaMode: 1, deltaX: 2, deltaY: 0 }),
      container,
    );
    expect(container.scrollLeft).toBe(32);
    handleCanvasContentWheel(wheel({ deltaMode: 2, deltaY: 1 }), container);
    expect(container.scrollTop).toBe(100);
  });

  it("does not pan when the gesture hits empty or non-scrollable content", () => {
    const event = wheel();
    expect(handleCanvasContentWheel(event, undefined)).toBe(true);
    expect(event.defaultPrevented).toBe(true);
  });
});

describe("reveal a layer in the artboard", () => {
  it("reveals an offscreen element with the smallest scroll and leaves visible elements still", () => {
    const container = box();
    const child = target(
      container,
      () => new DOMRect(20, 250 - container.scrollTop, 30, 20),
    );
    revealCanvasElement(child);
    expect(container.scrollTop).toBe(170);
    revealCanvasElement(child);
    expect(container.scrollTo).toHaveBeenCalledTimes(1);
  });

  it("reveals through nested containers using the updated bounds", () => {
    const outer = box();
    const inner = box(outer);
    vi.mocked(inner.getBoundingClientRect).mockImplementation(
      () => new DOMRect(0, 300 - outer.scrollTop, 200, 100),
    );
    const child = target(
      inner,
      () => new DOMRect(0, 550 - inner.scrollTop - outer.scrollTop, 20, 20),
    );
    revealCanvasElement(child);
    expect(inner.scrollTop).toBe(170);
    expect(outer.scrollTop).toBe(300);
    expect(child.getBoundingClientRect().bottom).toBe(100);
    expect(document.documentElement.scrollTop).toBe(0);
  });

  it("accounts for borders and CSS scale on both axes", () => {
    const container = box();
    Object.defineProperty(container, "clientLeft", { value: 2 });
    Object.defineProperty(container, "clientTop", { value: 2 });
    vi.mocked(container.getBoundingClientRect).mockReturnValue(
      new DOMRect(10, 20, 400, 200),
    );
    const child = target(container, () => new DOMRect(450, 250, 20, 20));
    revealCanvasElement(child);
    expect(container.scrollLeft).toBe(28);
    expect(container.scrollTop).toBe(23);
  });

  it("does not scroll a large selected section that already spans the viewport", () => {
    const container = box();
    revealCanvasElement(
      target(container, () => new DOMRect(-20, -20, 500, 400)),
    );
    expect(container.scrollTo).not.toHaveBeenCalled();
  });

  it("does not reveal hidden, disconnected or unrendered layers", () => {
    const container = box(document.body, "hidden");
    const child = target(container, () => new DOMRect(0, 300, 20, 20));
    revealCanvasElement(child);
    expect(container.scrollTo).not.toHaveBeenCalled();
    child.remove();
    revealCanvasElement(child);
    expect(container.scrollTo).not.toHaveBeenCalled();
    container.append(child);
    vi.mocked(child.getClientRects).mockReturnValue(
      [] as unknown as DOMRectList,
    );
    revealCanvasElement(child);
    expect(container.scrollTo).not.toHaveBeenCalled();
  });
});
