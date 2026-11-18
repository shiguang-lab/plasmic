import { DeviceFrame } from "@/wab/client/components/device-frame/DeviceFrame";
import { getDeviceFrame } from "@/wab/client/components/device-frame/device-frame";
import { ensure } from "@/wab/shared/common";
import { cleanup, render } from "@testing-library/react";
import React from "react";

afterEach(cleanup);

it.each([[393, 852, "phone"], [834, 1194, "tablet"], [1194, 834, "tablet"], [375, 667, "phone"]] as const)(
  "provides system status chrome outside the %s × %s authored viewport",
  (width, height, kind) => {
    const frame = ensure(getDeviceFrame(width, height), "Device geometry");
    const { container } = render(<div style={{ position: "relative", width, height }}><DeviceFrame frame={frame} /><iframe title="Business page" /></div>);
    const shell = ensure(container.querySelector<HTMLElement>('[data-test-id="device-frame"]'), "Shell");
    const status = ensure(shell.querySelector('[data-test-id="device-status-bar"]'), "System bar");
    expect(status.textContent).toContain("9:41");
    expect(status.querySelectorAll("svg")).toHaveLength(kind === "phone" ? 3 : 2);
    expect(status.textContent?.includes("100%")).toBe(kind === "tablet");
    expect(shell.getAttribute("aria-hidden")).toBe("true");
    expect(shell.style.inset).toBe(`${-frame.insetTop}px ${-frame.insetX}px ${-frame.insetBottom}px`);
    expect(shell.contains(container.querySelector("iframe"))).toBe(false);
  },
);

it("hides the iPhone status bar in landscape while preserving the home safe area", () => {
  const frame = ensure(getDeviceFrame(852, 393), "Landscape phone");
  const { container } = render(<DeviceFrame frame={frame} />);
  expect(container.querySelector('[data-test-id="device-status-bar"]')).toBeNull();
  expect(frame.safeX).toBe(59);
  expect(frame.homeHeight).toBe(21);
});
