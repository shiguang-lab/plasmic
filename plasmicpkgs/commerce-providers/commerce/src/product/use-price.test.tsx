// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import usePrice, { formatVariantPrice } from "./use-price";

const state = vi.hoisted(() => ({ locale: "en-US" }));
vi.mock("../commerce", () => ({ useCommerce: () => state }));
afterEach(cleanup);
it("reformats price and discount when only the locale changes", () => {
  const amount = { amount: 1234, baseAmount: 1500, currencyCode: "EUR" };
  const view = renderHook(() => usePrice(amount));
  expect(view.result.current).toEqual(formatVariantPrice({ ...amount, locale: "en-US" }));
  state.locale = "de-DE";
  view.rerender();
  expect(view.result.current).toEqual(formatVariantPrice({ ...amount, locale: "de-DE" }));
});
