import { useSignalListener } from "@/wab/commons/components/use-signal-listener";
import { act, renderHook } from "@testing-library/react";
import React from "react";
import * as Signals from "signals";

it("preserves caller-selected callback snapshots while transferring signal ownership", () => {
  const first: Signals.Signal<string> = new Signals.Signal(), second: Signals.Signal<string> = new Signals.Signal();
  const before = vi.fn(), after = vi.fn();
  const view = renderHook(({ signal, listener }) => useSignalListener(signal, listener), {
    initialProps: { signal: first, listener: before }, wrapper: React.StrictMode,
  });
  view.rerender({ signal: first, listener: after });
  act(() => first.dispatch("snapshot"));
  expect(before).toHaveBeenCalledWith("snapshot");
  expect(after).not.toHaveBeenCalled();
  view.rerender({ signal: second, listener: after });
  act(() => first.dispatch("retired"));
  expect(before).toHaveBeenCalledOnce();
  act(() => second.dispatch("current"));
  expect(after).toHaveBeenCalledWith("current");
  view.unmount();
  expect(first.getNumListeners()).toBe(0);
  expect(second.getNumListeners()).toBe(0);
});

it("refreshes the callback only when an explicit caller dependency changes", () => {
  const signal: Signals.Signal<string> = new Signals.Signal();
  const first = vi.fn(), second = vi.fn();
  const view = renderHook(({ version, listener }) => useSignalListener(signal, listener, [version]), {
    initialProps: { version: 0, listener: first },
  });
  view.rerender({ version: 0, listener: second });
  act(() => signal.dispatch("same"));
  expect(first).toHaveBeenCalledWith("same");
  view.rerender({ version: 1, listener: second });
  act(() => signal.dispatch("changed"));
  expect(second).toHaveBeenCalledWith("changed");
  expect(signal.getNumListeners()).toBe(1);
  view.unmount();
});
