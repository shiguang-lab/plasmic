// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useFetch } from "./useFetch";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("ignores an earlier search response and retains the last GIF when the search is emptied", async () => {
  const requests: ((value: unknown) => void)[] = [];
  const fetch = vi.fn(() => new Promise((resolve) => requests.push(resolve)));
  vi.stubGlobal("fetch", fetch);
  const view = renderHook(({ keyword }) => useFetch({ keyword }), { initialProps: { keyword: "cat" } });
  view.rerender({ keyword: "dog" });
  await act(async () => requests[1]({ json: async () => ({ data: [{ id: "dog" }] }) }));
  expect(view.result.current).toBe("dog");
  await act(async () => requests[0]({ json: async () => ({ data: [{ id: "cat" }] }) }));
  expect(view.result.current).toBe("dog");
  view.rerender({ keyword: "" });
  expect(view.result.current).toBe("dog");
  expect(fetch).toHaveBeenCalledTimes(2);
});
