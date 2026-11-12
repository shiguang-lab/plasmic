import { act, render } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { AppShell } from "../src/registerAppShell";

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

test("AppShell owns its live local clock and clears the interval on unmount", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-03T13:30:59Z"));
  const setInterval = vi.spyOn(globalThis, "setInterval");
  const clearInterval = vi.spyOn(globalThis, "clearInterval");
  const menuLabel = vi.fn(() => "Projects");
  const menuItems = [{ key: "projects", get label() { return menuLabel(); } }];
  const view = render(<AppShell menuItems={menuItems} />);
  const clock = () => view.container.querySelector("time")?.textContent;
  expect(clock()).toBe("当地时间：2026-10-03 21:30:59");
  menuLabel.mockClear();
  act(() => vi.advanceTimersByTime(1000));
  expect(clock()).toBe("当地时间：2026-10-03 21:31:00");
  expect(menuLabel).not.toHaveBeenCalled();
  view.rerender(<AppShell menuItems={menuItems} timeZone="UTC" />);
  expect(clock()).toBe("当地时间：2026-10-03 13:31:00");
  const intervalIndex = setInterval.mock.calls.findIndex(([, delay]) => delay === 1000);
  expect(intervalIndex).toBeGreaterThanOrEqual(0);
  const interval = setInterval.mock.results[intervalIndex].value;
  view.unmount();
  expect(clearInterval).toHaveBeenCalledWith(interval);
});
