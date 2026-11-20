import { screenClipStyle } from "@/wab/client/components/device-frame/screen-clip";
import { getDeviceFrame } from "@/wab/client/components/device-frame/device-frame";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { isPageComponent } from "@/wab/shared/core/components";

/** Scaler overlays invert zoom to keep their strokes and controls one pixel wide. */
export function canvasScreenClipStyle(
  viewCtx: ViewCtx,
  target: { left: number; top: number; width: number; height: number },
  zoom: number,
) {
  const frame = viewCtx.arenaFrame();
  const device = isPageComponent(frame.container.component) && !viewCtx.studioCtx.canvasContentEditor && !viewCtx.isFullContentView()
    ? getDeviceFrame(frame.width, frame.height) : undefined;
  if (!device) { return undefined; }
  const origin = viewCtx.canvasCtx.viewportContainerOffset();
  return screenClipStyle(
    { left: origin.left - device.safeSide, top: origin.top - device.safeTop,
      width: frame.width, height: frame.height, radius: device.screenRadius },
    target,
    zoom,
  );
}
