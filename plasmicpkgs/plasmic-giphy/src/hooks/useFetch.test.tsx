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

it("preserves spaces, ampersands, plus signs, and CJK characters in search query", async () => {
  const urls: string[] = [];
  const fetch = vi.fn(async (url: string) => {
    urls.push(url);
    return { json: async () => ({ data: [{ id: "gif-1" }] }) };
  });
  vi.stubGlobal("fetch", fetch);

  for (const keyword of ["rock & roll", "a+b", "猫咪 跳舞"]) {
    const view = renderHook(() => useFetch({ keyword, apiKey: "test-key" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(view.result.current).toBe("gif-1");
    view.unmount();
  }

  expect(urls.map((u) => new URL(u).searchParams.get("q"))).toEqual([
    "rock & roll",
    "a+b",
    "猫咪 跳舞",
  ]);
  expect(new URL(urls[0]).searchParams.get("api_key")).toBe("test-key");
});
