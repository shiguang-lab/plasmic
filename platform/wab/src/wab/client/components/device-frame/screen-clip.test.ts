import { screenClipStyle, viewportScreen } from "@/wab/client/components/device-frame/screen-clip";
import { getCanvasScreen, screenBorderClipStyle } from "@/wab/client/components/canvas/canvas-screen-clip";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, updateAutoDerivedFrameHeight } from "@/wab/shared/Arenas";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplTagX } from "@/wab/shared/core/tpls";

it.each([0.5, 1, 2])("keeps the same screen boundary for offset child outlines at zoom %s", (zoom) => {
  const screen = { left: 100, top: 200, width: 393, height: 852, radius: 36 };
  const child = { left: 110, top: 220, width: 100, height: 80 };
  expect(screenClipStyle(screen, child, zoom).clipPath).toBe(
    `inset(${-20 * zoom}px ${-283 * zoom}px ${-752 * zoom}px ${-10 * zoom}px round ${36 * zoom}px)`,
  );
});

it("shares phone/tablet geometry and removes clipping in content editing and desktop views", () => {
  const site = createSite();
  const component = mkComponent({ name: "Screen", type: ComponentType.Page, tplTree: mkTplTagX("div") });
  const frame = mkArenaFrame({ site, component, width: 393, height: 852, name: "Screen" });
  const studio = { canvasContentEditor: undefined as unknown };
  const view = {
    arenaFrame: () => frame,
    studioCtx: studio,
    isFullContentView: () => false,
    canvasCtx: { viewportContainerOffset: () => ({ left: 100, top: 200 }) },
  } as unknown as ViewCtx;
  const box = { left: 100, top: 200, width: 393, height: 852 };
  expect(screenBorderClipStyle(getCanvasScreen(view), box, 1)?.clipPath).toBe("inset(0px 0px 0px 0px round 44px)");
  // A full-width selection below the status bar fits the straight screen edges.
  const hero = { ...box, top: box.top + 158, height: 328 };
  for (const zoom of [0.5, 0.71152, 1, 2]) {
    expect(screenBorderClipStyle(getCanvasScreen(view), hero, zoom)).toBeUndefined();
    expect(screenClipStyle({ ...box, radius: 44 }, hero, zoom).clipPath).toBeDefined();
    const atCorner = { ...hero, left: box.left + 3, top: box.top + 3, width: 20, height: 20 };
    expect(screenBorderClipStyle(getCanvasScreen(view), atCorner, zoom)).toEqual(screenClipStyle({ ...box, radius: 44 }, atCorner, zoom));
    expect(screenBorderClipStyle(getCanvasScreen(view), { ...hero, left: box.left - 2 }, zoom)?.clipPath).toBeDefined();
  }
  frame.width = 834; frame.height = 1194;
  updateAutoDerivedFrameHeight(frame, 1194);
  expect(screenBorderClipStyle(getCanvasScreen(view), { ...box, width: 834, height: 1194 }, 1)?.clipPath).toBe("inset(0px 0px 0px 0px round 18px)");
  studio.canvasContentEditor = {};
  expect(screenBorderClipStyle(getCanvasScreen(view), box, 1)).toBeUndefined();
  studio.canvasContentEditor = undefined;
  component.type = ComponentType.Plain;
  expect(screenBorderClipStyle(getCanvasScreen(view), box, 1)).toBeUndefined();
  component.type = ComponentType.Page;
  frame.width = 1440; frame.height = 900;
  expect(screenBorderClipStyle(getCanvasScreen(view), box, 1)).toBeUndefined();
});

it("reads Preview's actual viewport instead of its outside shell dimensions", () => {
  const iframe = document.createElement("iframe");
  document.body.append(iframe);
  try {
    Object.defineProperties(iframe, { clientWidth: { value: 393 }, clientHeight: { value: 852 } });
    iframe.style.borderTopLeftRadius = "36px";
    expect(viewportScreen(iframe)).toEqual({ left: 0, top: 0, width: 393, height: 852, radius: 36 });
    iframe.style.borderTopLeftRadius = "0px";
    expect(viewportScreen(iframe)).toBeUndefined();
  } finally { iframe.remove(); }
});
