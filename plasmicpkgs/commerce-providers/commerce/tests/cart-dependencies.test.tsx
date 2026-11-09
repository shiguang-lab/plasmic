// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { handler as shopify } from "../../shopify/src/cart/use-update-item";
import { handler as swell } from "../../swell/src/cart/use-update-item";
import { handler as saleor } from "../../saleor/src/cart/use-update-item";
import { handler as commercetools } from "../../commercetools/src/cart/use-update-item";
import { handler as removeShopify } from "../../shopify/src/cart/use-remove-item";
import { handler as removeCommercetools } from "../../commercetools/src/cart/use-remove-item";

const cart = vi.hoisted(() => ({ mutate: vi.fn(async () => {}) }));
vi.mock("../../shopify/src/cart/use-cart", () => ({ default: () => cart }));
vi.mock("../../swell/src/cart/use-cart", () => ({ default: () => cart }));
vi.mock("../../saleor/src/cart/use-cart", () => ({ default: () => cart }));
vi.mock("../../commercetools/src/cart/use-cart", () => ({ default: () => cart }));
beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); });

it.each([["shopify", shopify], ["swell", swell], ["saleor", saleor], ["commercetools", commercetools]] as const)(
  "%s targets the current item and preserves already queued mutations after replacement or unmount", async (_name, handler) => {
    const fetch = vi.fn(async () => ({}));
    const useUpdate = handler.useHook({ fetch } as any);
    const view = renderHook(({ id, wait }) => useUpdate({ item: { id } as any, wait }), { initialProps: { id: "old", wait: 500 } });
    act(() => { view.result.current({ quantity: 2 } as any); });
    view.rerender({ id: "old", wait: 20 });
    await act(async () => { await vi.advanceTimersByTimeAsync(20); });
    expect(fetch).not.toHaveBeenCalled();
    view.rerender({ id: "current", wait: 20 });
    act(() => { view.result.current({ quantity: 3 } as any); });
    await act(async () => { await vi.advanceTimersByTimeAsync(20); });
    expect(fetch).toHaveBeenCalledExactlyOnceWith({ input: { item: { quantity: 3 }, itemId: "current" } });
    act(() => { view.result.current({ quantity: 4 } as any); });
    view.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch).toHaveBeenCalledWith({ input: { item: { quantity: 4 }, itemId: "current" } });
    expect(fetch).toHaveBeenCalledWith({ input: { item: { quantity: 2 }, itemId: "old" } });
  },
);

it.each([["shopify", removeShopify], ["commercetools", removeCommercetools]] as const)(
  "%s removes the new item after a same-instance rerender", async (_name, handler) => {
    const fetch = vi.fn(async () => ({}));
    const useRemove = handler.useHook({ fetch } as any);
    const view = renderHook(({ id }) => useRemove({ item: { id } as any }), { initialProps: { id: "old" } });
    view.rerender({ id: "current" });
    await act(async () => { await view.result.current({} as any); });
    expect(fetch).toHaveBeenCalledWith({ input: { itemId: "current" } });
  },
);
