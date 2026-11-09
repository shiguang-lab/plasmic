import type { StateCreator, StoreApi } from "zustand/vanilla";
import { createStore } from "zustand/vanilla";

/**
 * Studio store kit — thin conveniences over vanilla zustand.
 *
 * Conventions (see docs/design/mobx-to-zustand-migration.md):
 * - stores are created with `createStore` / `useStore`, never bound `create`;
 * - store state holds immutable display inputs only, never services or DOM
 *   handles (`CanvasCtx`, jQuery objects, observers, sockets);
 * - imperative subscriptions use `subscribeToSelector` with an explicit comparison.
 */

type StoreResetter = () => void;

const resetters = new Set<StoreResetter>();

/**
 * Register a reset callback for `resetAllStores()`.
 *
 * Returns an unregister function so disposed owners (or hot reloads) do not
 * keep resetting a dead store.
 */
export function registerStoreReset(reset: StoreResetter): () => void {
  resetters.add(reset);
  return () => {
    resetters.delete(reset);
  };
}

/**
 * Reset every registered store to its initial state.
 *
 * Intended for tests (`afterEach(() => resetAllStores())`). Production code
 * should never call this: resetting a live store would desynchronize its
 * owning command objects.
 */
export function resetAllStores(): void {
  // Copy first: a resetter may unregister itself while we iterate.
  for (const reset of [...resetters]) {
    reset();
  }
}

interface CreateStudioStoreOptions {
  /** Used only to make development warnings point at the right store. */
  name?: string;
}

/**
 * Use `store` when it really is a zustand store, else a shared fallback.
 *
 * Test fixtures often build a partial `StudioCtx` with `mock<StudioCtx>()`, so a
 * migrated field can be a mock function instead of a store. Hooks must not crash
 * in that case — they just stop reacting.
 */
export function resolveStore<T extends { getState: unknown }>(
  store: T | undefined,
  fallback: T,
): T {
  return store && typeof store.getState === "function" ? store : fallback;
}

/**
 * Create a vanilla zustand store following Studio conventions.
 *
 * Prefer this over `createStore` in new code: in development it warns when the
 * initial state contains a service-like value, which is the failure mode this
 * migration keeps running into.
 */
export function createStudioStore<T>(
  initializer: StateCreator<T, [], []>,
  options: CreateStudioStoreOptions = {},
): StoreApi<T> {
  const store = createStore<T>()(initializer);
  if (process.env.NODE_ENV !== "production") {
    warnAboutNonStateValues(
      store.getInitialState(),
      options.name ?? "studio store",
    );
  }
  return store;
}

/**
 * `createStudioStore` plus automatic registration with `resetAllStores()`.
 *
 * Use for module-level singletons. Per-instance stores (one per `ViewCtx`,
 * `ViewportCtx`, ...) should NOT auto-register: the registry would grow with
 * every arena and never shrink. Register those explicitly when the owner is
 * constructed, and unregister when it is disposed.
 */
export function createResettableStudioStore<T>(
  initializer: StateCreator<T, [], []>,
  options: CreateStudioStoreOptions = {},
): StoreApi<T> {
  const store = createStudioStore<T>(initializer, options);
  registerStoreReset(() => {
    store.setState(store.getInitialState(), true);
  });
  return store;
}

export interface SubscribeToSelectorOptions<T> {
  /** Decides whether a notification is worth delivering. Defaults to `Object.is`. */
  equals?: (previous: T, next: T) => boolean;
  /** Call the listener once with the current value, like MobX `fireImmediately`. */
  fireImmediately?: boolean;
}

/**
 * Subscribe imperatively to one derived value of a store.
 *
 * This is the zustand-native replacement for MobX `reaction`: the listener runs
 * only when the selected value changes. It is intentionally not the
 * `subscribeWithSelector` middleware — this codebase keeps stores free of
 * middleware so they stay trivially introspectable in tests.
 */
export function subscribeToSelector<T, S>(
  store: Pick<StoreApi<S>, "getState" | "subscribe">,
  selector: (state: S) => T,
  listener: (next: T, previous: T) => void,
  options: SubscribeToSelectorOptions<T> = {},
): () => void {
  const equals = options.equals ?? Object.is;
  let previous = selector(store.getState());
  const unsubscribe = store.subscribe((state) => {
    const next = selector(state);
    if (equals(previous, next)) {
      return;
    }
    const before = previous;
    previous = next;
    listener(next, before);
  });
  if (options.fireImmediately) {
    try { listener(previous, previous); }
    catch (error) { unsubscribe(); throw error; }
  }
  return unsubscribe;
}

export interface WaitForStoreOptions {
  /** Reject instead of waiting forever. Omit to wait indefinitely. */
  timeoutMs?: number;
  /** Error message used when the timeout fires. */
  message?: string;
}

/**
 * Resolve once `predicate(state)` holds. Rejects on timeout.
 *
 * This replaces MobX's `when()` in tests and imperative flows:
 *
 * ```ts
 * await waitForStore(studio.selectionStore, (s) => s.view !== undefined, {
 *   timeoutMs: 1000,
 *   message: "selection never settled",
 * });
 * ```
 */
export function waitForStore<T>(
  store: Pick<StoreApi<T>, "getState" | "subscribe">,
  predicate: (state: T) => boolean,
  options: WaitForStoreOptions = {},
): Promise<void> {
  if (predicate(store.getState())) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    let unsubscribe: () => void = () => undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const settle = () => {
      unsubscribe();
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    };

    unsubscribe = store.subscribe((state) => {
      if (!predicate(state)) {
        return;
      }
      settle();
      resolve();
    });

    if (options.timeoutMs !== undefined) {
      timer = setTimeout(() => {
        settle();
        reject(
          new Error(
            options.message ??
              `waitForStore timed out after ${options.timeoutMs}ms`,
          ),
        );
      }, options.timeoutMs);
    }
  });
}

/**
 * Service-like values that must never be stored as state. Detected by shape
 * rather than typeof so the check also works in SSR and in tests.
 */
function classifyService(value: object): string | undefined {
  if (typeof (value as { jquery?: unknown }).jquery === "string") {
    return "jQuery object";
  }
  if (typeof Element !== "undefined" && value instanceof Element) {
    return "DOM element";
  }
  if (typeof Window !== "undefined" && value instanceof Window) {
    return "Window";
  }
  if (
    typeof ResizeObserver !== "undefined" &&
    value instanceof ResizeObserver
  ) {
    return "ResizeObserver";
  }
  if (
    typeof MutationObserver !== "undefined" &&
    value instanceof MutationObserver
  ) {
    return "MutationObserver";
  }
  if (typeof WebSocket !== "undefined" && value instanceof WebSocket) {
    return "WebSocket";
  }
  return undefined;
}

/**
 * Development guard for the `no-service-in-state` rule. It is a warning, not an
 * error: the migration is ongoing and a hard failure here would block builds.
 */
function warnAboutNonStateValues(
  value: unknown,
  storeName: string,
  path = "state",
  depth = 0,
): void {
  if (depth > 2 || typeof value !== "object" || value === null) {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      warnAboutNonStateValues(item, storeName, `${path}[${index}]`, depth + 1),
    );
    return;
  }
  const kind = classifyService(value);
  if (kind) {
    console.warn(
      `[store] ${storeName}: ${path} holds a ${kind}. ` +
        `Services belong on a plain class (CanvasCtx, DndManager, ...), not in store state.`,
    );
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    warnAboutNonStateValues(entry, storeName, `${path}.${key}`, depth + 1);
  }
}
