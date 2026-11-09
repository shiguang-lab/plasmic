import { shallow } from "zustand/shallow";
import {
  createResettableStudioStore,
  createStudioStore,
  registerStoreReset,
  resetAllStores,
  subscribeToSelector,
  waitForStore,
} from "@/wab/client/stores/store-kit";

afterEach(() => {
  resetAllStores();
  vi.restoreAllMocks();
});

it("creates a vanilla store with its initial state and actions", () => {
  const store = createStudioStore<{ count: number; increment: () => void }>(
    (set) => ({
      count: 1,
      increment: () => set((state) => ({ count: state.count + 1 })),
    }),
    { name: "counter" },
  );

  expect(store.getState().count).toBe(1);
  store.getState().increment();
  expect(store.getState().count).toBe(2);
  expect(store.getInitialState().count).toBe(1);
});

it("resets a resettable store back to its initial state", () => {
  const store = createResettableStudioStore<{ count: number; set: (n: number) => void }>(
    (set) => ({ count: 0, set: (count) => set({ count }) }),
  );

  store.getState().set(7);
  expect(store.getState().count).toBe(7);

  resetAllStores();
  expect(store.getState().count).toBe(0);
});

it("stops resetting after the resetter is unregistered", () => {
  const store = createStudioStore<{ count: number; set: (n: number) => void }>(
    (set) => ({ count: 0, set: (count) => set({ count }) }),
  );
  const unregister = registerStoreReset(() => {
    store.setState(store.getInitialState(), true);
  });

  store.getState().set(3);
  resetAllStores();
  expect(store.getState().count).toBe(0);

  unregister();
  store.getState().set(5);
  resetAllStores();
  expect(store.getState().count).toBe(5);
});

it("resolves waitForStore when the predicate becomes true", async () => {
  const store = createStudioStore<{ ready: boolean }>(() => ({ ready: false }));

  const pending = waitForStore(store, (state) => state.ready, {
    timeoutMs: 1000,
  });
  expect(store.getState().ready).toBe(false);

  store.setState({ ready: true });
  await expect(pending).resolves.toBeUndefined();
});

it("resolves waitForStore immediately when the predicate already holds", async () => {
  const store = createStudioStore<{ ready: boolean }>(() => ({ ready: true }));
  await expect(
    waitForStore(store, (state) => state.ready),
  ).resolves.toBeUndefined();
});

it("rejects waitForStore with the caller's message on timeout", async () => {
  const store = createStudioStore<{ ready: boolean }>(() => ({ ready: false }));
  await expect(
    waitForStore(store, (state) => state.ready, {
      timeoutMs: 5,
      message: "selection never settled",
    }),
  ).rejects.toThrow("selection never settled");
});

it("warns when store state holds a service-like value", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

  createStudioStore(() => ({ element: document.createElement("div") }), {
    name: "bad",
  });

  expect(warn).toHaveBeenCalledWith(expect.stringContaining("DOM element"));
});

it("does not warn for plain immutable state", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

  createStudioStore(() => ({ count: 1, nested: { ok: true }, list: [1, 2, 3] }));

  expect(warn).not.toHaveBeenCalled();
});


it("subscribeToSelector fires only when the selected value changes", () => {
  const store = createStudioStore<{ a: number; b: number }>(() => ({
    a: 0,
    b: 0,
  }));
  const listener = vi.fn();

  const unsubscribe = subscribeToSelector(store, (state) => state.a, listener);

  store.setState({ a: 1 });
  store.setState({ a: 1 });
  store.setState({ b: 2 });
  store.setState({ a: 3 });

  expect(listener.mock.calls).toEqual([
    [1, 0],
    [3, 1],
  ]);
  unsubscribe();
});

it("subscribeToSelector supports a custom equality and fireImmediately", () => {
  const store = createStudioStore<{ left: number; top: number }>(() => ({
    left: 0,
    top: 0,
  }));
  const listener = vi.fn();

  subscribeToSelector(
    store,
    (state) => [state.left, state.top],
    listener,
    { equals: shallow, fireImmediately: true },
  );

  // Same values, new array: `shallow` suppresses the notification.
  store.setState({ left: 0, top: 0 });
  store.setState({ top: 5 });

  expect(listener).toHaveBeenCalledTimes(2);
  expect(listener.mock.calls[0]).toEqual([
    [0, 0],
    [0, 0],
  ]);
  expect(listener.mock.calls[1]).toEqual([
    [0, 5],
    [0, 0],
  ]);
});

it("subscribeToSelector stops delivering after unsubscribe", () => {
  const store = createStudioStore<{ value: number }>(() => ({ value: 0 }));
  const listener = vi.fn();
  const unsubscribe = subscribeToSelector(
    store,
    (state) => state.value,
    listener,
  );
  unsubscribe();

  store.setState({ value: 1 });

  expect(listener).not.toHaveBeenCalled();
});

it("observes writes made by the immediate selector listener", () => {
  const store = createStudioStore(() => ({ value: 0 }));
  const values: number[] = [];
  const stop = subscribeToSelector(store, (state) => state.value, (value) => {
    values.push(value);
    if (value === 0) { store.setState({ value: 1 }); }
  }, { fireImmediately: true });
  expect(values).toEqual([0, 1]);
  stop();
});
