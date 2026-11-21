import { screenClipStyle } from "@/wab/client/components/device-frame/screen-clip";
import { getDeviceFrame } from "@/wab/client/components/device-frame/device-frame";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { isPageComponent } from "@/wab/shared/core/components";

export function getCanvasScreen(viewCtx: ViewCtx) {
  const frame = viewCtx.arenaFrame();
  const device = isPageComponent(frame.container.component) && !viewCtx.studioCtx.canvasContentEditor && !viewCtx.isFullContentView()
    ? getDeviceFrame(frame.width, frame.height) : undefined;
  if (!device) { return undefined; }
  const origin = viewCtx.canvasCtx.viewportContainerOffset();
  return { ...origin, width: frame.width, height: frame.height, radius: device.screenRadius };
}

/** Border boxes that fit inside the rounded screen can paint directly. */
export function screenBorderClipStyle(
  screen: ReturnType<typeof getCanvasScreen>,
  target: { left: number; top: number; width: number; height: number },
  zoom: number,
) {
  if (!screen) { return undefined; }
  const left = target.left - screen.left;
  const top = target.top - screen.top;
  const right = screen.width - left - target.width;
  const bottom = screen.height - top - target.height;
  // Test the target corner nearest the rounded edge against its quarter-circle.
  const dx = Math.max(0, screen.radius - Math.min(left, right));
  const dy = Math.max(0, screen.radius - Math.min(top, bottom));
  if (Math.min(left, top, right, bottom) >= 0 && dx * dx + dy * dy <= screen.radius ** 2) {
    return undefined;
  }
  return screenClipStyle(screen, target, zoom);
}
