export type PreviewViewportMode = "desktop" | "phone" | "tablet" | "custom";

export interface PreviewViewport {
  viewport: PreviewViewportMode;
  width: number;
  height: number;
}

export const DEVICE_VIEWPORTS = {
  phone: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
};

export function parseViewportMode(value: string | null): PreviewViewportMode {
  return value === "phone" || value === "tablet" || value === "custom"
    ? value
    : "desktop";
}

export function isViewportDimension(value: number) {
  return Number.isInteger(value) && value >= 240 && value <= 7680;
}

/** Keep the iframe's CSS viewport intact; only scale its presentation. */
export function getViewportScale(
  available: { width: number; height: number },
  viewport: { width: number; height: number },
) {
  return Math.min(
    1,
    Math.max(1, available.width - 40) / viewport.width,
    Math.max(1, available.height - 40) / viewport.height,
  );
}
