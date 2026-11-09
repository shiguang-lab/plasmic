import { useVirtualCombobox } from "@/wab/client/hooks/useVirtualCombobox";
import { act, renderHook } from "@testing-library/react";

vi.mock("downshift", () => ({ useCombobox: () => ({ highlightedIndex: -1 }) }));
afterEach(() => vi.useRealTimers());

it("debounces across rerenders and cancels work when its delay or owner changes", () => {
  vi.useFakeTimers();
  const buildItems = () => ({ items: [], virtualItems: [] });
  const listRef = { current: null };
  const onSelect = vi.fn();
  const view = renderHook(({ debounceMs }) => useVirtualCombobox({ buildItems, listRef, onSelect, debounceMs }), {
    initialProps: { debounceMs: 100 },
  });
  act(() => view.result.current.setQuery("first"));
  act(() => vi.advanceTimersByTime(50));
  view.rerender({ debounceMs: 100 });
  act(() => view.result.current.setQuery("latest"));
  act(() => vi.advanceTimersByTime(50));
  expect(view.result.current.query).toBe("");
  act(() => vi.advanceTimersByTime(50));
  expect(view.result.current.query).toBe("latest");
  act(() => view.result.current.setQuery("retired"));
  view.rerender({ debounceMs: 200 });
  act(() => vi.advanceTimersByTime(100));
  expect(view.result.current.query).toBe("latest");
  act(() => view.result.current.setQuery("unmounted"));
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
