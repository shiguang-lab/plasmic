/**
 * Finite native CSS reads for the real ViewCtx/StudioCtx style owners.
 * Indicator popovers and token labels keep their own model subscriptions.
 * Render candidates connect only after commit and closed owners retain their
 * last installed cells.
 */
import * as React from "react";
import { useSyncExternalStore } from "react";
import { ensure } from "@/wab/shared/common";
import type { DefinedIndicatorType } from "@/wab/shared/defined-indicator";
import {
  normalizeStyleKeys,
  type NativeStyleProvider,
  type SingleRsStyleInputs,
  type StyleCell,
  type StyleCellsSnapshot,
  type ViewStyleInputs,
} from "@/wab/client/studio-ctx/style-inputs";

const EMPTY_CELLS: StyleCellsSnapshot = Object.freeze([]);

type StyleProjectionHandle =
  | ReturnType<ViewStyleInputs["get"]>
  | ReturnType<SingleRsStyleInputs["get"]>;

function noopSubscribe() {
  return () => undefined;
}

/**
 * Explicit finite keys only. Returns a cached frozen array in normalized key
 * order. While a real view/model owner is being disposed, the last installed
 * snapshot is retained rather than resolving a closed model. The hook never
 * resolves models.
 */
function useStyleProjection(
  provider: NativeStyleProvider,
  keys: readonly string[],
) {
  const keysKey = keys.join("\u0000");
  const normalized = React.useMemo(
    () => normalizeStyleKeys(keys),
    [keysKey],
  );
  const lastSnapshot = React.useRef<StyleCellsSnapshot>(EMPTY_CELLS);

  const native = provider.getNativeStyleSource();
  const handle: StyleProjectionHandle | undefined = React.useMemo(() => native.inputs.isDisposed || normalized.length === 0
    ? undefined : native.kind === "tpl"
      ? native.inputs.get(native.source, normalized) : native.inputs.get(native.source, normalized),
    [provider, native.inputs, normalized]);

  const store = handle?.projection.store;
  const subscribe = React.useCallback(
    (listener: () => void) =>
      store ? store.subscribe(listener) : noopSubscribe(),
    [store],
  );
  const getSnapshot = React.useCallback(
    () => (store ? store.getState() : lastSnapshot.current),
    [store],
  );
  const getServerSnapshot = React.useCallback(
    () => (store ? store.getInitialState() : lastSnapshot.current),
    [store],
  );
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  if (store) {
    lastSnapshot.current = snapshot;
  }

  const key = handle?.key;
  React.useEffect(
    () => (handle ? handle.retain() : undefined),
    [store, key],
  );

  return { snapshot: normalized.length ? snapshot : EMPTY_CELLS, projection: handle?.projection, inputs: native.inputs };
}

/** Frozen CSS cells in normalized, deduplicated key order. */
export function useStyleCells(provider: NativeStyleProvider, keys: readonly string[]): StyleCellsSnapshot {
  return useStyleProjection(provider, keys).snapshot;
}

const EMPTY_INDICATORS: readonly DefinedIndicatorType[] = Object.freeze([]);
const NONE_INDICATOR: DefinedIndicatorType = Object.freeze({ source: "none" });

/**
 * Resolve the installed finite CSS source recipe using its original model owner.
 * Only the source stack is resolved here; metadata/token/popover children keep
 * their real model subscriptions. Active unsupported recipes remain errors.
 */
export function useStyleIndicators(provider: NativeStyleProvider, keys: readonly string[]): readonly DefinedIndicatorType[] {
  const { snapshot, projection, inputs } = useStyleProjection(provider, keys);
  const last = React.useRef<{ inputs: typeof inputs; indicators: readonly DefinedIndicatorType[] } | undefined>(undefined);
  return React.useMemo(() => {
    if (snapshot.length === 0) { return EMPTY_INDICATORS; }
    if (!projection || projection.isDisposed) {
      return last.current?.inputs === inputs ? last.current.indicators : EMPTY_INDICATORS;
    }
    const indicators = Object.freeze(snapshot.map((cell) => projection.resolveIndicator(
      ensure(cell.indicator, cell.indicatorUnsupported ?? `Expected a CSS indicator for ${cell.key}`),
    )));
    last.current = { inputs, indicators };
    return indicators;
  }, [snapshot, projection, inputs]);
}

/** One CSS source recipe; an initially closed owner has no source. */
export function useStyleIndicator(provider: NativeStyleProvider, key: string): DefinedIndicatorType {
  return useStyleIndicators(provider, [key])[0] ?? NONE_INDICATOR;
}

/** Convenience for one key; returns undefined only during owner teardown. */
export function useStyleCell(
  provider: NativeStyleProvider,
  key: string,
): StyleCell | undefined {
  return useStyleCells(provider, [key])[0];
}
