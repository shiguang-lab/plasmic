// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PlasmicQueryDataProvider, useMutablePlasmicQueryData, usePlasmicQueryData } from "./query-data";

afterEach(cleanup);
function Wrapper({ children, cache = {} }: React.PropsWithChildren<{ cache?: Record<string, unknown> }>) {
  const storage = React.useMemo(() => new Map(), []);
  return <PlasmicQueryDataProvider provider={() => storage} prefetchedCache={cache}>{children}</PlasmicQueryDataProvider>;
}

it("keeps tuple-key fetchers' positional arguments with SWR 2", async () => {
  const fetcher = vi.fn(async (path, count) => `${path}:${count}`);
  function Query() {
    const result = usePlasmicQueryData(["/items", 2], fetcher);
    return <span>{result.data ?? "loading"}</span>;
  }
  render(<Wrapper><Query /></Wrapper>);
  await screen.findByText("/items:2");
  expect(fetcher).toHaveBeenCalledExactlyOnceWith("/items", 2);
});

it("uses prefetched query data without re-fetching immutable data on mount", async () => {
  const fetcher = vi.fn(async () => "unexpected");
  function Query() {
    const result = usePlasmicQueryData("prefetched", fetcher);
    return <span>{result.data ?? "loading"}</span>;
  }
  render(<Wrapper cache={{ prefetched: "saved" }}><Query /></Wrapper>);
  expect(screen.getByText("saved")).toBeTruthy();
  await act(async () => { await Promise.resolve(); });
  expect(fetcher).not.toHaveBeenCalled();
});

it("keeps mutable loading, previous data and failures through a key change", async () => {
  let finish: ((data: string) => void) | undefined;
  const fetcher = vi.fn((key: string) => key === "first" ? Promise.resolve("first result") : new Promise<string>(resolve => { finish = resolve; }));
  function Query({ queryKey }: { queryKey: string }) {
    const result = useMutablePlasmicQueryData(queryKey, fetcher, { shouldRetryOnError: false });
    return <span data-loading={result.isLoading} data-lagging={!!result.isLagging}>{result.data ?? "empty"}</span>;
  }
  const view = render(<Wrapper><Query queryKey="first" /></Wrapper>);
  await screen.findByText("first result");
  view.rerender(<Wrapper><Query queryKey="second" /></Wrapper>);
  await waitFor(() => expect(finish).toBeTypeOf("function"));
  expect(screen.getByText("first result").getAttribute("data-loading")).toBe("true");
  expect(screen.getByText("first result").getAttribute("data-lagging")).toBe("true");
  await act(async () => finish?.("second result"));
  expect(screen.getByText("second result").getAttribute("data-loading")).toBe("false");
  expect(fetcher.mock.calls).toEqual([["first"], ["second"]]);
});

it("reports a rejected mutable fetch and clears loading without retrying", async () => {
  const fetcher = vi.fn(async () => { throw new Error("query failed"); });
  function Query() {
    const result = useMutablePlasmicQueryData("error-result", fetcher, { shouldRetryOnError: false });
    return <span data-loading={result.isLoading}>{result.error?.message ?? "loading"}</span>;
  }
  render(<Wrapper><Query /></Wrapper>);
  const result = await screen.findByText("query failed");
  expect(result.getAttribute("data-loading")).toBe("false");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
