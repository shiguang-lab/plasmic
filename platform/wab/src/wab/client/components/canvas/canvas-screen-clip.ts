import { screenClipStyle } from "@/wab/client/components/device-frame/screen-clip";
import { getDeviceFrame } from "@/wab/client/components/device-frame/device-frame";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { getFrameHeight } from "@/wab/shared/Arenas";
import { isPageComponent } from "@/wab/shared/core/components";

/** Scaler overlays invert zoom to keep their strokes and controls one pixel wide. */
export function canvasScreenClipStyle(
  viewCtx: ViewCtx,
  target: { left: number; top: number; width: number; height: number },
  zoom: number,
) {
  const frame = viewCtx.arenaFrame();
  const device = !viewCtx.studioCtx.canvasContentEditor && isPageComponent(frame.container.component)
    ? getDeviceFrame(frame.width, frame.height) : undefined;
  if (!device) { return undefined; }
  return screenClipStyle(
    { width: frame.width, height: getFrameHeight(frame), radius: device.screenRadius, ...viewCtx.canvasCtx.viewportContainerOffset() },
    target,
    zoom,
  );
}
