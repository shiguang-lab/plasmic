import * as React from "react";
import type { StoreApi } from "zustand/vanilla";

/**
 * Select a store value and coalesce store notifications into animation frames.
 *
 * Use this for high-frequency values — canvas hover, pointer position, drag
 * insertion — where zustand's normal "one notification, one render" behavior
 * would spend the frame budget on React instead of on the canvas.
 *
 * Two properties matter:
 * - unchanged selected values retain their references, so React's
 *   `useSyncExternalStore` invariant holds;
 * - imperative code that reads the store directly always sees the newest value,
 *   even while the next render is still pending.
 *
 * Do NOT use this for values that must update within the same event handler
 * (input values, checkboxes): the extra frame makes them feel laggy.
 *
 */
export interface UseFrameValueOptions<T> {
  /** Comparison used to decide whether a notification is worth a render. */
  equals?: (previous: T, next: T) => boolean;
}

function scheduleOnNextFrame(callback: () => void): () => void {
  if (typeof requestAnimationFrame === "function") {
    const frame = requestAnimationFrame(callback);
    return () => cancelAnimationFrame(frame);
  }
  const timer = setTimeout(callback, 16);
  return () => clearTimeout(timer);
}

export function useFrameValue<T, S>(
  store: StoreApi<S>,
  selector: (state: S) => T,
  options: UseFrameValueOptions<T> = {},
): T {
  const equals = options.equals ?? Object.is;
  const [committed] = React.useState(() => new FrameSelection<S, T>());
  const getSnapshot = React.useMemo(() => createFrameSelectionReader(store, selector, equals, committed), [store, selector, equals, committed]);
  const subscribe = React.useCallback((callback: () => void) => {
    let cancelFrame: (() => void) | undefined;
    const stop = store.subscribe(() => {
      if (cancelFrame) { return; }
      cancelFrame = scheduleOnNextFrame(() => {
        cancelFrame = undefined;
        callback();
      });
    });
    return () => { stop(); cancelFrame?.(); };
  }, [store]);

  // Read the actual store during render and React's commit consistency check.
  // Only notifications are deferred; owner/selector changes and mount-time
  // writes must never wait for a future store update to become visible.
  const value = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  React.useEffect(() => { committed.commit(store, value); }, [committed, store, value]);
  return value;
}

class FrameSelection<S, T> {
  private current: { store: StoreApi<S>; value: T } | undefined;
  read(store: StoreApi<S>) { return this.current?.store === store ? this.current : undefined; }
  commit(store: StoreApi<S>, value: T) { this.current = { store, value }; }
}

function createFrameSelectionReader<S, T>(store: StoreApi<S>, selector: (state: S) => T, equals: (previous: T, next: T) => boolean, committed: FrameSelection<S, T>) {
  let memo: { state: S; value: T } | undefined;
  return () => {
    const state = store.getState();
    if (memo && Object.is(memo.state, state)) { return memo.value; }
    const next = selector(state);
    const previous = memo ?? committed.read(store);
    const value = previous && equals(previous.value, next) ? previous.value : next;
    memo = { state, value };
    return value;
  };
}
