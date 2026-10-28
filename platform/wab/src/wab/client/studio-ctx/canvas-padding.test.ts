import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { Box } from "@/wab/shared/geom";

test("canvas padding includes the visible tool rail after it moves beside an open panel", () => {
  const container = document.createElement("div");
  container.className = "canvas-editor__left-pane-container";
  const rail = container.appendChild(document.createElement("div"));
  rail.className = "editor-tool-rail-group";
  const panel = document.createElement("div");
  panel.className = "canvas-editor__left-pane";
  document.body.append(container, panel);
  vi.spyOn(container, "getBoundingClientRect").mockReturnValue(new DOMRect(100, 50, 36, 600));
  vi.spyOn(panel, "getBoundingClientRect").mockReturnValue(new DOMRect(100, 50, 300, 600));
  vi.spyOn(rail, "getBoundingClientRect").mockReturnValue(new DOMRect(420, 50, 36, 600));
  try {
    const padding = StudioCtx.prototype.canvasZoomPadding.call({
      viewportCtx: { clipperBox: () => Box.fromRect({ left: 100, top: 50, width: 1000, height: 800 }) },
    } as StudioCtx);
    expect(padding.left).toBe(376);
  } finally {
    container.remove();
    panel.remove();
    vi.restoreAllMocks();
  }
});
