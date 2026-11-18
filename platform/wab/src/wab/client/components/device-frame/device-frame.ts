import { DEVICE_VIEWPORTS } from "@/wab/client/components/live/preview-viewport";
import { frameSizeGroups } from "@/wab/shared/responsiveness";

type DeviceKind = "phone" | "tablet" | "desktop";

/** Orientation does not change the identity of a device preset. */
function matches(width: number, height: number, size: { width: number; height: number }) {
  return (size.width === width && size.height === height) ||
    (size.height === width && size.width === height);
}

/** The authored viewport fills the display. Only hardware extends outside it. */
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
  const hardwareEnd = hardware === "home-button" ? 54 : 0;
  return {
    kind,
    landscape,
    hardware,
    bezel,
    insetX: bezel + (landscape ? hardwareEnd : 0),
    insetTop: bezel + (landscape ? 0 : hardwareEnd),
    insetBottom: bezel + (landscape ? 0 : hardwareEnd),
    screenRadius: hardware === "home-button" ? 3 : kind === "tablet" ? 18 : 44,
    viewportRadius: hardware === "home-button" ? 3 : kind === "tablet" ? 18 : 44,
  };
}

export type DeviceFrameGeometry = NonNullable<ReturnType<typeof getDeviceFrame>>;
