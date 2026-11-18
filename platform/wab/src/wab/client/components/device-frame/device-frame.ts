import { DEVICE_VIEWPORTS } from "@/wab/client/components/live/preview-viewport";
import { frameSizeGroups } from "@/wab/shared/responsiveness";

type DeviceKind = "phone" | "tablet" | "desktop";

/** Orientation does not change the identity of a device preset. */
function matches(width: number, height: number, size: { width: number; height: number }) {
  return (size.width === width && size.height === height) ||
    (size.height === width && size.width === height);
}

/** System chrome is outside the authored viewport, never saved into page content. */
export function getDeviceFrame(width: number, height: number, device?: DeviceKind | "custom") {
  if (!Number.isFinite(width) || !Number.isFinite(height) || Math.min(width, height) < 240) {
    return undefined;
  }
  const preset = frameSizeGroups.find((group) => group.sizes.some((size) => matches(width, height, size)));
  const kind = device ?? (preset
    ? preset.groupName === "Phone" ? "phone" : preset.groupName === "Tablet" ? "tablet" : "desktop"
    : matches(width, height, DEVICE_VIEWPORTS.tablet) ? "tablet" : undefined);
  if (!kind || kind === "custom" || kind === "desktop") { return undefined; }
  const landscape = width > height;
  const shortSide = Math.min(width, height), longSide = Math.max(width, height);
  const hardware = kind === "tablet" ? "tablet" :
    [[320, 568], [375, 667], [414, 736]].some(([w, h]) => w === shortSide && h === longSide) ? "home-button" :
    [[390, 844], [428, 926]].some(([w, h]) => w === shortSide && h === longSide) ? "notch" : "island";
  const bezel = kind === "tablet" ? 16 : 8;
  const statusBarHeight = kind === "tablet" ? 24 : landscape ? 0 : hardware === "home-button" ? 20 : hardware === "notch" ? 47 : 59;
  const homeHeight = hardware === "home-button" ? 0 : kind === "tablet" ? 20 : landscape ? 21 : 34;
  const safeX = kind === "phone" && landscape && hardware !== "home-button" ? 59 : 0;
  const hardwareEnd = hardware === "home-button" ? 54 : 0;
  return {
    kind,
    landscape,
    hardware,
    bezel,
    statusBarHeight,
    homeHeight,
    safeX,
    insetX: bezel + safeX + (landscape ? hardwareEnd : 0),
    insetTop: bezel + statusBarHeight + (landscape ? 0 : hardwareEnd),
    insetBottom: bezel + homeHeight + (landscape ? 0 : hardwareEnd),
    screenRadius: hardware === "home-button" ? 3 : kind === "tablet" ? 18 : 44,
    // The viewport ends at the system bars, before the display's curved corners.
    viewportRadius: 0,
  };
}

export type DeviceFrameGeometry = NonNullable<ReturnType<typeof getDeviceFrame>>;
