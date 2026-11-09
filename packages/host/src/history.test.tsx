// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useBrowserQueryParams } from "./history";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("keeps subscriptions and parsed params stable across unrelated renders", () => {
  window.history.replaceState({}, "", "/?tag=a&tag=b");
  const add = vi.spyOn(window, "addEventListener");
  const remove = vi.spyOn(window, "removeEventListener");
  const view = renderHook(() => useBrowserQueryParams(true));
  const params = view.result.current;
  expect(params).toEqual({ tag: ["a", "b"] });
  add.mockClear(); remove.mockClear();
  view.rerender();
  expect(view.result.current).toBe(params);
  expect(add).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
  view.unmount();
  expect(remove.mock.calls.map(([name]) => name).sort()).toEqual(["plasmic:locationchange", "popstate"]);
});

it("tracks pushState, replaceState and popstate, and can disable and resume", () => {
  const view = renderHook(({ enabled }) => useBrowserQueryParams(enabled), { initialProps: { enabled: true } });
  act(() => window.history.pushState({}, "", "/?page=2"));
  expect(view.result.current).toEqual({ page: "2" });
  act(() => window.history.replaceState({}, "", "/?page=3"));
  expect(view.result.current).toEqual({ page: "3" });
  act(() => window.dispatchEvent(new PopStateEvent("popstate")));
  expect(view.result.current).toEqual({ page: "3" });
  view.rerender({ enabled: false });
  act(() => window.history.pushState({}, "", "/?page=4"));
  expect(view.result.current).toBeUndefined();
  view.rerender({ enabled: true });
  expect(view.result.current).toEqual({ page: "4" });
});
