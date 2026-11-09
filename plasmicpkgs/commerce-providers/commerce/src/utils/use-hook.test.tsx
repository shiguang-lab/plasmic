// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useMutationHook } from "./use-hook";

const state = vi.hoisted(() => ({ providerRef: { current: undefined as any }, fetcherRef: { current: vi.fn() } }));
vi.mock("../commerce", () => ({ useCommerce: () => state }));
afterEach(cleanup);
it("updates provider and handler while keeping the same fetcher and fetch options", async () => {
  const fetcher = vi.fn(), options = {};
  state.providerRef.current = { id: "first", fetcher };
  const initial = { fetchOptions: options, fetcher: vi.fn(async ({ provider }) => provider.id), useHook: ({ fetch }: any) => fetch };
  const view = renderHook(({ handler }) => useMutationHook(handler as any), { initialProps: { handler: initial } });
  expect(await view.result.current()).toBe("first");
  state.providerRef.current = { id: "second", fetcher };
  view.rerender({ handler: initial });
  expect(await view.result.current()).toBe("second");
  const next = { ...initial, fetcher: vi.fn(async () => "new handler") };
  view.rerender({ handler: next });
  expect(await view.result.current()).toBe("new handler");
});


it("keeps the fetch callback stable when only its handler wrapper is recreated", () => {
  const fetcher = vi.fn();
  state.providerRef.current = { id: "stable", fetcher };
  const handler = { fetchOptions: {}, fetcher: vi.fn(async () => undefined), useHook: ({ fetch }: any) => fetch };
  const view = renderHook(({ current }) => useMutationHook(current as any), { initialProps: { current: handler } });
  const initialFetch = view.result.current;
  view.rerender({ current: { ...handler } });
  expect(view.result.current).toBe(initialFetch);
});
