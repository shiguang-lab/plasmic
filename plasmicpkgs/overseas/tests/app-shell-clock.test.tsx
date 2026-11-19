import { PlasmicCanvasContext } from "@plasmicapp/host";
import { act, render } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { AppShell } from "../src/registerAppShell";

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

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

test("the edit canvas has no clock interval and interaction resumes at the current time", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-03T13:30:00Z"));
  const intervals = vi.spyOn(globalThis, "setInterval");
  const clearInterval = vi.spyOn(globalThis, "clearInterval");
  const shell = (interactive: boolean) => (
    <PlasmicCanvasContext.Provider value={{ componentName: "Page", globalVariants: {}, interactive }}>
      <AppShell timeZone="UTC" />
    </PlasmicCanvasContext.Provider>
  );
  const view = render(shell(false));
  const clock = () => view.container.querySelector("time")?.textContent;
  act(() => vi.advanceTimersByTime(60000));
  expect(clock()).toBe("当地时间：2026-10-03 13:30:00");
  expect(intervals).not.toHaveBeenCalledWith(expect.any(Function), 1000);

  view.rerender(shell(true));
  expect(clock()).toBe("当地时间：2026-10-03 13:31:00");
  const index = intervals.mock.calls.findIndex(([, delay]) => delay === 1000);
  expect(index).toBeGreaterThanOrEqual(0);
  const timer = intervals.mock.results[index].value;
  act(() => vi.advanceTimersByTime(1000));
  expect(clock()).toBe("当地时间：2026-10-03 13:31:01");

  view.rerender(shell(false));
  expect(clearInterval).toHaveBeenCalledWith(timer);
  act(() => vi.advanceTimersByTime(60000));
  expect(clock()).toBe("当地时间：2026-10-03 13:31:01");
});
