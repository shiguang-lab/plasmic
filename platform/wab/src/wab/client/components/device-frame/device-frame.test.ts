import { getDeviceFrame } from "@/wab/client/components/device-frame/device-frame";
import { getViewportScale } from "@/wab/client/components/live/preview-viewport";
import { frameSizeGroups } from "@/wab/shared/responsiveness";

test("all native Device presets select their corresponding shell", () => {
  for (const group of frameSizeGroups) {
    for (const { width, height } of group.sizes) {
      const expected = group.groupName === "Phone" ? "phone" : group.groupName === "Tablet" ? "tablet" : undefined;
      expect(getDeviceFrame(width, height)?.kind).toBe(expected);
    }
  }
});

test("custom dimensions, including rotated presets, have no shell", () => {
  for (const [width, height] of [[800, 600], [600, 800], [375, 812], [393, 2400], [852, 393], [1194, 834], [600, 900], [900, 600], [100, 100], [1440, 900], [1440, 390], [NaN, 852]]) {
    expect(getDeviceFrame(width, height)).toBeUndefined();
  }
});

test.each([[393, 852], [852, 393], [834, 1194], [1194, 834]])("the complete device fits a small preview stage without resizing its viewport (%i × %i)", (width, height) => {
  const frame = getDeviceFrame(width, height, Math.min(width, height) === 393 ? "phone" : "tablet");
  expect(frame).toBeDefined();
  if (!frame) { throw new Error("Expected phone frame"); }
  const outer = { width: width + 2 * frame.insetX, height: height + 2 * frame.insetY };
  const available = { width: 500, height: 600 };
  const scale = getViewportScale(available, outer);
  // Multiplying a fractional scale can round a few ulps above the bound.
  expect(outer.width * scale).toBeLessThanOrEqual(available.width - 40 + 1e-9);
  expect(outer.height * scale).toBeLessThanOrEqual(available.height - 40 + 1e-9);
});

test("explicit preview devices retain their shell type at custom resolutions", () => {
  expect(getDeviceFrame(1024, 768, "phone")?.kind).toBe("phone");
  expect(getDeviceFrame(393, 852, "tablet")?.kind).toBe("tablet");
  expect(getDeviceFrame(1920, 1080, "tablet")?.kind).toBe("tablet");
  expect(getDeviceFrame(393, 852, "desktop")).toBeUndefined();
});

test("explicit Custom preview has no shell even at preset dimensions", () => {
  for (const [width, height] of [[800, 600], [393, 852], [834, 1194]]) {
    expect(getDeviceFrame(width, height, "custom")).toBeUndefined();
  }
});
