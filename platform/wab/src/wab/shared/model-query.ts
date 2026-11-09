import { getModelMutationVersion, isInstrumentedModel } from "@/wab/shared/core/model-mutations";

/** Cached imperative queries invalidate on writes, including writes inside an
 * unfinished command. UI subscriptions remain explicit field stores. */
export function memoizeModelQuery<T extends (...args: any[]) => any>(
  query: T,
  options?: { equals?: (left: ReturnType<T>, right: ReturnType<T>) => boolean; keyFn?: (...args: Parameters<T>) => string },
): T {
  interface Cache { version: number; values: Map<unknown, any>; previous: Map<unknown, any>; }
  // Queries cannot keep a retired document alive through a global argument map.
  const owners = new WeakMap<object, Cache>();
  const leaf = Symbol();
  return function (...args: Parameters<T>) {
    const owner = args.find(isInstrumentedModel);
    if (!owner) { return query(...args); }
    const version = getModelMutationVersion();
    let cache = owners.get(owner);
    if (!cache) { cache = {version, values: new Map(), previous: new Map()}; owners.set(owner, cache); }
    if (version !== cache.version) {
      cache.previous = cache.values; cache.values = new Map(); cache.version = version;
    }
    let node = cache.values, prior: Map<unknown, any> | undefined = cache.previous;
    for (const key of options?.keyFn ? [options.keyFn(...args)] : args) {
      let child = node.get(key);
      if (!child) { child = new Map(); node.set(key, child); }
      node = child; prior = prior?.get(key);
    }
    if (!node.has(leaf)) {
      const next = query(...args), previous = prior?.get(leaf);
      node.set(leaf, prior?.has(leaf) && options?.equals?.(previous, next) ? previous : next);
    }
    return node.get(leaf);
  } as T;
}
