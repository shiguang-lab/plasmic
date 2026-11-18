import { DeviceFrame } from "@/wab/client/components/device-frame/DeviceFrame";
import { getDeviceFrame } from "@/wab/client/components/device-frame/device-frame";
import { ensure } from "@/wab/shared/common";
import { cleanup, render } from "@testing-library/react";
import React from "react";

afterEach(cleanup);

it.each([[393, 852, "phone"], [834, 1194, "tablet"], [1194, 834, "tablet"], [375, 667, "phone"]] as const)(
  "surrounds the full %s × %s authored display with hardware",
  (width, height, kind) => {
    const frame = ensure(getDeviceFrame(width, height), "Device geometry");
    const { container } = render(<div style={{ position: "relative", width, height }}><DeviceFrame frame={frame} /><iframe title="Business page" /></div>);
    const shell = ensure(container.querySelector<HTMLElement>('[data-test-id="device-frame"]'), "Shell");
    expect(shell.querySelector('[data-test-id="device-status-bar"]')).toBeNull();
    expect(shell.textContent).toBe("");
    expect(shell.querySelectorAll("svg")).toHaveLength(0);
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
});
