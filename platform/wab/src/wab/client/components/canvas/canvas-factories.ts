import { assert } from "@/wab/shared/common";

interface Branch<T> {
  readonly objects: WeakMap<object, Branch<T>>;
  readonly values: Map<unknown, Branch<T>>;
  result?: { readonly value: T };
}
const releases = new Set<(owner: object) => void>();
const branch = <T>(): Branch<T> => ({ objects: new WeakMap(), values: new Map() });
const objectKey = (value: unknown): value is object => (typeof value === "object" && value !== null) || typeof value === "function";

/** Canvas component factories are keyed by explicit identities/hook shapes.
 * Their first argument owns the cache; no model read is inferred or tracked. */
export function canvasFactory<Args extends unknown[], Result>(factory: (...args: Args) => Result, keys?: (...args: Args) => readonly unknown[]): (...args: Args) => Result {
  const owners = new WeakMap<object, Branch<Result>>();
  releases.add((owner) => owners.delete(owner));
  return (...args) => {
    const path = keys ? keys(...args) : args;
    const owner = path[0]; assert(objectKey(owner), "Canvas factory requires an object owner");
    let current: Branch<Result> = owners.get(owner) ?? branch<Result>();
    owners.set(owner, current);
    for (const key of path.slice(1)) {
      // Each collection keeps its own key type, without retaining object keys.
      const next: Branch<Result> = (objectKey(key) ? current.objects.get(key) : current.values.get(key)) ?? branch<Result>();
      if (objectKey(key)) { current.objects.set(key, next); } else { current.values.set(key, next); }
      current = next;
    }
    if (!current.result) { current.result = { value: factory(...args) }; }
    return current.result.value;
  };
}

export function disposeCanvasFactories(owner: object) { releases.forEach((release) => release(owner)); }
