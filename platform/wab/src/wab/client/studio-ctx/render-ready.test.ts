import {
  isRenderReady,
  RENDER_READY_ATTR,
  setRenderReadyAttr,
} from "@/wab/client/studio-ctx/render-ready";

describe("render-ready signal", () => {
  it("is ready only after initial render with no eval or sync pending", () => {
    const base = { initialRenderReady: true, evalInProgress: false };
    expect(isRenderReady({ ...base, pendingSyncs: 0 })).toBe(true);
    expect(
      isRenderReady({ ...base, initialRenderReady: false, pendingSyncs: 0 })
    ).toBe(false);
    expect(
      isRenderReady({ ...base, evalInProgress: true, pendingSyncs: 0 })
    ).toBe(false);
    expect(isRenderReady({ ...base, pendingSyncs: 1 })).toBe(false);
  });

  it("sets and clears the attribute on the canvas documentElement", () => {
    const doc = document.implementation.createHTMLDocument("canvas");
    expect(doc.documentElement.hasAttribute(RENDER_READY_ATTR)).toBe(false);
    setRenderReadyAttr(doc, true);
    expect(doc.documentElement.getAttribute(RENDER_READY_ATTR)).toBe("");
    setRenderReadyAttr(doc, false);
    expect(doc.documentElement.hasAttribute(RENDER_READY_ATTR)).toBe(false);
    setRenderReadyAttr(doc, true);
    expect(doc.documentElement.hasAttribute(RENDER_READY_ATTR)).toBe(true);
  });

  it("is a no-op without a canvas document", () => {
    expect(() => setRenderReadyAttr(undefined, true)).not.toThrow();
  });
});
