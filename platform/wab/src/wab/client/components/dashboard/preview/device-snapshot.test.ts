import { deviceFrameSnapshot } from "@/wab/client/components/dashboard/preview/device-snapshot";
import { getDeviceFrame } from "@/wab/client/components/device-frame/device-frame";
import { ensure } from "@/wab/shared/common";

it.each([[390, 844, "phone"], [834, 1194, "tablet"]] as const)(
  "serializes the shared %s×%s shell with CSS and space outside the screen",
  (width, height, kind) => {
    const frame = ensure(getDeviceFrame(width, height), "Device preset");
    const css = '.frame > span::after { content: "&"; }';
    const svg = deviceFrameSnapshot(document, width, height, frame, css);
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    expect(doc.querySelector("parsererror")).toBeNull();
    expect(doc.querySelector("style")?.textContent).toBe(css);
    const shell = ensure(doc.querySelector('[data-test-id="device-frame"]'), "Shared shell");
    expect(shell.getAttribute("data-device")).toBe(kind);
    expect(shell.querySelector('[data-test-id="device-status-bar"]')).toBeNull();
    expect(shell.textContent).toBe("");
    expect(shell.parentElement?.getAttribute("style")).toContain(`width:${width}px;height:${height}px`);
    expect(Number(doc.documentElement.getAttribute("width"))).toBeGreaterThan(width + 2 * frame.insetX);
    expect(Number(doc.documentElement.getAttribute("height"))).toBeGreaterThan(height + frame.insetTop + frame.insetBottom);
  },
);
