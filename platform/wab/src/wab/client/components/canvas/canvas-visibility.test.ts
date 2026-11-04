import { CanvasCtx } from "@/wab/client/components/canvas/canvas-ctx";

it("reveals native and code-component roots through their class contract without rewriting styles", () => {
  const style = document.createElement("style");
  style.textContent = ".original-hidden { display: none; }";
  document.head.appendChild(style);
  const canvas = Object.assign(Object.create(CanvasCtx.prototype), {
    _controlStyleNode: style,
    visibleDisplayClasses: new Map(),
  }) as CanvasCtx;
  const root = document.createElement("div");
  root.className = "original-hidden";
  document.body.appendChild(root);
  try {
    expect(getComputedStyle(root).display).toBe("none");
    const visible = canvas.getVisibleDisplayClass("grid");
    root.classList.add(visible);
    expect(getComputedStyle(root).display).toBe("grid");
    expect(canvas.getVisibleDisplayClass("grid")).toBe(visible);
    expect(style.sheet?.cssRules).toHaveLength(2);
    root.classList.remove(visible);
    expect(getComputedStyle(root).display).toBe("none");
    expect(root.style.display).toBe("");
  } finally {
    root.remove();
    style.remove();
  }
});
