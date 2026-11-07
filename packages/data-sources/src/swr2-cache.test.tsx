// @vitest-environment jsdom
import { DataProvider } from "@plasmicapp/host";
import { PlasmicQueryDataProvider, usePlasmicDataConfig } from "@plasmicapp/query";
import { act, cleanup, render, screen } from "@testing-library/react";
import React, { Suspense } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { usePlasmicFetch } from "./common";

afterEach(cleanup);

it.each([0, false, null, "", { rows: [1, 2] }])("reads business data from a newly published SWR 2 cache entry (%j)", async (value) => {
  const cache = new Map();
  const fetcher = vi.fn(async () => "unexpected fetch");
  let published = false;
  function Read() {
    const { cache: activeCache } = usePlasmicDataConfig();
    const result = usePlasmicFetch("cache-race", {}, fetcher,
      ({ data, error, isLoading }) => ({ data, error, isLoading }), ["data"], {});
    // Another query can finish after this render's SWR snapshot was read.
    if (!published) {
      published = true;
      activeCache.set("cache-race", { data: value });
    }
    return <output>{JSON.stringify(result.data)}</output>;
  }
  await act(async () => {
    render(<PlasmicQueryDataProvider provider={() => cache}>
      <DataProvider name="plasmicInternalEnableLoadingBoundary" data={true}>
        <Suspense fallback="Loading"><Read /></Suspense>
      </DataProvider>
    </PlasmicQueryDataProvider>);
  });
  expect(screen.getByRole("status").textContent).toBe(JSON.stringify(value));
  expect(fetcher).not.toHaveBeenCalled();
});

it("caches a suspended data-op failure at the native SWR 2 key without a request loop", async () => {
  const cache = new Map();
  const fetcher = vi.fn<() => Promise<unknown>>()
    .mockRejectedValueOnce(new Error("data source offline"))
    .mockResolvedValue("recovered");
  let retry: (() => Promise<unknown>) | undefined;
  function Read() {
    const { mutate } = usePlasmicDataConfig();
    retry = () => mutate("failed-operation");
    const result = usePlasmicFetch("failed-operation", {}, fetcher,
      ({ data, error, isLoading }) => ({ data, error, isLoading }), ["data"], {});
    if (result.error) return <output>{result.error.message}</output>;
    return <output>{JSON.stringify(result.data)}</output>;
  }
  render(<PlasmicQueryDataProvider provider={() => cache}>
    <DataProvider name="plasmicInternalEnableLoadingBoundary" data={true}>
      <Suspense fallback="Loading"><Read /></Suspense>
    </DataProvider>
  </PlasmicQueryDataProvider>);
  expect(await screen.findByRole("status")).toHaveProperty("textContent", "data source offline");
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(cache.get("failed-operation")).toMatchObject({ error: expect.objectContaining({ message: "data source offline" }) });
  expect([...cache.keys()].some((key) => key.startsWith("$swr$"))).toBe(false);
  await act(async () => { await retry?.(); });
  expect(screen.getByRole("status").textContent).toBe('"recovered"');
  expect(fetcher).toHaveBeenCalledTimes(2);
});
