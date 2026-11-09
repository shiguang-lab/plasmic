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
  const keysKey = JSON.stringify(keys);
  const normalized = React.useMemo(
    () => normalizeStyleKeys(JSON.parse(keysKey) as string[]),
    [keysKey],
  );
  const [lastSnapshot, setLastSnapshot] = React.useState<StyleCellsSnapshot>(EMPTY_CELLS);

  const native = React.useMemo(() => provider.getNativeStyleSource(), [provider]);
  const handle: StyleProjectionHandle | undefined = React.useMemo(() => native.inputs.isDisposed || normalized.length === 0
    ? undefined : native.kind === "tpl"
      ? native.inputs.get(native.source, normalized) : native.inputs.get(native.source, normalized),
    [native, normalized]);

  const store = handle?.projection.store;
  const subscribe = React.useCallback(
    (listener: () => void) =>
      store ? store.subscribe(listener) : noopSubscribe(),
    [store],
  );
  const getSnapshot = React.useCallback(
    () => (store ? store.getState() : lastSnapshot),
    [store, lastSnapshot],
  );
  const getServerSnapshot = React.useCallback(
    () => (store ? store.getInitialState() : lastSnapshot),
    [store, lastSnapshot],
  );
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  if (store && lastSnapshot !== snapshot) {
    setLastSnapshot(snapshot);
  }

  React.useEffect(() => handle?.retain(), [handle]);

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
  const [last, setLast] = React.useState<{
    inputs: typeof inputs;
    projection: typeof projection;
    snapshot: typeof snapshot;
    indicators: readonly DefinedIndicatorType[];
  }>();
  if (!snapshot.length) { return EMPTY_INDICATORS; }
  if (!projection || projection.isDisposed) {
    return last?.inputs === inputs ? last.indicators : EMPTY_INDICATORS;
  }
  if (last?.inputs === inputs && last.projection === projection && last.snapshot === snapshot) {
    return last.indicators;
  }
  const indicators = Object.freeze(snapshot.map((cell) => projection.resolveIndicator(
    ensure(cell.indicator, cell.indicatorUnsupported ?? `Expected a CSS indicator for ${cell.key}`),
  )));
  setLast({ inputs, projection, snapshot, indicators });
  return indicators;
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

/** Source markers can include synthetic properties such as animation. This
 * dedicated mode never asks a RuleSet for a CSS value or its initial value. */
export function useTplStyleIndicators(provider: NativeStyleProvider, keys: readonly string[]): readonly DefinedIndicatorType[] {
  const key = JSON.stringify(keys);
  const normalized = React.useMemo(() => normalizeStyleKeys(JSON.parse(key) as string[]), [key]);
  const native = React.useMemo(() => provider.getNativeStyleSource(), [provider]);
  if (native.kind !== "tpl") { throw new Error("Tpl source markers require a tpl style provider"); }
  const handle = React.useMemo(() => native.inputs.isDisposed || !normalized.length ? undefined : native.inputs.getIndicators(native.source, normalized), [native, normalized]);
  const store = handle?.store;
  const subscribe = React.useCallback((listener: () => void) => store ? store.subscribe(listener) : noopSubscribe(), [store]);
  const read = React.useCallback(() => store?.getState() ?? EMPTY_SOURCE_MARKERS, [store]);
  const snapshot = useSyncExternalStore(subscribe, read, read);
  React.useEffect(() => handle?.retain(), [handle]);
  const [last, setLast] = React.useState<{
    inputs: typeof native.inputs;
    projection: typeof handle;
    snapshot: typeof snapshot;
    value: readonly DefinedIndicatorType[];
  }>();
  if (!snapshot.length) { return EMPTY_INDICATORS; }
  if (!handle || handle.projection.isDisposed) {
    return last?.inputs === native.inputs ? last.value : EMPTY_INDICATORS;
  }
  if (last?.inputs === native.inputs && last.projection === handle && last.snapshot === snapshot) { return last.value; }
  const value = Object.freeze(snapshot.map((cell) => handle.projection.resolveIndicator(ensure(cell.indicator, cell.indicatorUnsupported ?? `Expected a source marker for ${cell.key}`))));
  setLast({ inputs: native.inputs, projection: handle, snapshot, value });
  return value;
}
const EMPTY_SOURCE_MARKERS: import("@/wab/client/studio-ctx/style-inputs").StyleIndicatorCellsSnapshot = Object.freeze([]);
