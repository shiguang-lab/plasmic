import { frameSizeGroups } from "@/wab/shared/responsiveness";

type DeviceKind = "phone" | "tablet" | "desktop";

/** Match the canvas Device menu's exact preset dimensions. */
function matchDevicePreset(width: number, height: number): DeviceKind | undefined {
  const preset = frameSizeGroups.find((group) => group.sizes.some((size) =>
    size.width === width && size.height === height,
  ));
  if (preset) {
    return preset.groupName === "Phone" ? "phone" : preset.groupName === "Tablet" ? "tablet" : "desktop";
  }
  return undefined;
}

/** Presentation only: these insets never become part of the page viewport. */
export function getDeviceFrame(width: number, height: number, device?: DeviceKind | "custom") {
  if (!Number.isFinite(width) || !Number.isFinite(height) || Math.min(width, height) < 240) {
    return undefined;
  }
  const kind = device ?? matchDevicePreset(width, height);
  if (!kind || kind === "custom" || kind === "desktop") { return undefined; }
  const landscape = width > height;
  return {
    kind,
    landscape,
    insetX: kind === "tablet" ? 16 : 8,
    insetY: kind === "tablet" ? 16 : 8,
    screenRadius: kind === "tablet" ? 12 : 36,
  };
}

export type DeviceFrameGeometry = NonNullable<ReturnType<typeof getDeviceFrame>>;
