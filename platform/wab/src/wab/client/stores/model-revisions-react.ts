import {
  ModelRevisions,
  type ModelKey,
} from "@/wab/shared/model-revisions";
import * as React from "react";

/**
 * React bindings for the model revision index.
 *
 * A component that renders model data subscribes to the keys it depends on and
 * re-renders when one of them is dirtied by a mutation. This replaces the
 * automatic dependency tracking that `observer` provided.
 */

function keysToSnapshotString(revisions: ModelRevisions, keys: readonly ModelKey[]): string {
  return keys.map((key) => revisions.getModelRevision(key)).join(".");
}

/** Subscribe to one model key's revision. */
export function useModelRevision(revisions: ModelRevisions, key: ModelKey): number {
  const subscribe = React.useCallback(
    (listener: () => void) => revisions.subscribeModelKeys([key], listener),
    [revisions, key],
  );
  const getSnapshot = React.useCallback(() => revisions.getModelRevision(key), [revisions, key]);
  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Explicit invalidation for whole-structure readers that do not select a value. */
export function useModelRevisions(revisions: ModelRevisions, keys: readonly ModelKey[]): void {
  const signature = JSON.stringify(keys);
  const stableKeys = React.useMemo<readonly ModelKey[]>(() => JSON.parse(signature), [signature]);
  const subscribe = React.useCallback((listener: () => void) => revisions.subscribeModelKeys(stableKeys, listener), [revisions, stableKeys]);
  const read = React.useCallback(() => keysToSnapshotString(revisions, stableKeys), [revisions, stableKeys]);
  React.useSyncExternalStore(subscribe, read, read);
}

/**
 * Subscribe to a set of model keys and memoize a value computed from them.
 *
 * `keys` may be an inline array: the hook keys its subscription by content, so
 * `[tplKey(tpl)]` is fine. `compute` reads the mutable model (it is NOT reactive
 * by itself); the revision keys are what make the read observable.
 *
 * Prefer one narrow key over many: `[modelKeys.tpl(tpl.uuid)]` re-renders only
 * for that element, while `[modelKeys.component(uuid)]` re-renders for the whole
 * component.
 */
export function useModelSelector<T>(
  revisions: ModelRevisions,
  keys: readonly ModelKey[],
  compute: () => T,
  equals: (previous: T, next: T) => boolean = Object.is,
): T {
  const keysJoined = JSON.stringify(keys);
  const subscribedKeys = React.useMemo<readonly ModelKey[]>(() => JSON.parse(keysJoined), [keysJoined]);
  const subscribe = React.useCallback(
    (listener: () => void) =>
      revisions.subscribeModelKeys(subscribedKeys, listener),
    [revisions, subscribedKeys],
  );
  const [committed] = React.useState(() => new ModelSelection<T>());
  const getSnapshot = React.useMemo(() => createModelSelectionReader(revisions, subscribedKeys, compute, equals, committed), [revisions, subscribedKeys, compute, equals, committed]);
  const value = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  React.useEffect(() => { committed.commit(value); }, [committed, value]);
  return value;
}

class ModelSelection<T> {
  private value: { value: T } | undefined;
  read = () => this.value;
  commit(value: T) { this.value = { value }; }
}

function createModelSelectionReader<T>(revisions: ModelRevisions, subscribedKeys: readonly ModelKey[], compute: () => T, equals: (previous: T, next: T) => boolean, committed: ModelSelection<T>) {
  let memo: { revisions: string; value: T } | undefined;
  return () => {
    const signature = keysToSnapshotString(revisions, subscribedKeys);
    if (memo?.revisions === signature) { return memo.value; }
    const next = compute();
    const previous = memo ?? committed.read();
    const value = previous && equals(previous.value, next) ? previous.value : next;
    memo = { revisions: signature, value };
    return value;
  };
}
