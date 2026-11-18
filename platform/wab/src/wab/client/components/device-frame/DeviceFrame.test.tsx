import { DeviceFrame } from "@/wab/client/components/device-frame/DeviceFrame";
import { getDeviceFrame } from "@/wab/client/components/device-frame/device-frame";
import { ensure } from "@/wab/shared/common";
import { cleanup, render } from "@testing-library/react";
import React from "react";

afterEach(cleanup);

it.each([[393, 852, "phone"], [834, 1194, "tablet"], [1194, 834, "tablet"], [375, 667, "phone"]] as const)(
  "draws system chrome outside the page document at %s × %s",
  (width, height, kind) => {
    const frame = ensure(getDeviceFrame(width, height), "Device geometry");
    const { container } = render(<div style={{ position: "relative", width, height }}><DeviceFrame frame={frame} /><iframe title="Business page" /></div>);
    const shell = ensure(container.querySelector<HTMLElement>('[data-test-id="device-frame"]'), "Shell");
    expect(shell.querySelector('[data-test-id="device-status-bar"]')?.textContent).toContain("9:41");
    expect(shell.querySelectorAll("svg")).toHaveLength(kind === "phone" ? 3 : 2);
    expect(!!shell.querySelector('[data-test-id="device-home-indicator"]')).toBe(frame.hardware !== "home-button");
    expect(shell.dataset.device).toBe(kind);
    expect(shell.getAttribute("aria-hidden")).toBe("true");
    expect(shell.style.inset).toBe(`${-frame.insetTop}px ${-frame.insetX}px ${-frame.insetBottom}px`);
    expect(shell.contains(container.querySelector("iframe"))).toBe(false);
  },
);

it("keeps the landscape display edge to edge", () => {
  const frame = ensure(getDeviceFrame(852, 393), "Landscape phone");
  expect(frame.insetX).toBe(frame.bezel);
  expect(frame.insetTop).toBe(frame.bezel);
  expect(frame.insetBottom).toBe(frame.bezel);
  expect(frame.viewportRadius).toBe(frame.screenRadius);
  const { container } = render(<DeviceFrame frame={frame} />);
  expect(container.querySelector('[data-test-id="device-status-bar"]')).toBeNull();
  expect(container.querySelector('[data-test-id="device-home-indicator"]')).not.toBeNull();
});
