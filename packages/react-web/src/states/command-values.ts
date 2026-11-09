import * as React from "react";

export const commandValues = new WeakMap<object, () => any>();

/** Resolve a value captured by a render to the state object an event edits.
 * Render values can cross component props or repetition aliases; commands keep
 * the state engine's own object identity and read-after-write semantics. */
export function getStateCommandValue<T>(value: T): T {
  let current = value;
  const seen = new Set<object>();
  while (current !== null && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const source = commandValues.get(current);
    if (!source) { break; }
    current = source();
  }
  return current;
}

export function getStateCommandEnv<T extends Record<string, any>>(env: T): T {
  return Object.fromEntries(Object.entries(env).map(([key, value]) => [key, getStateCommandValue(value)])) as T;
}

/** Resolve command inputs when the event runs, rather than capturing mutable
 * state reads in the render that created the listener. */
export function createStateEventHandler<const Context extends readonly unknown[], Args extends unknown[], Result>(
  getContext: () => Context,
  createHandler: (...context: Context) => (...args: Args) => Result
): (...args: Args) => Result {
  return (...args) => createHandler(...getContext())(...args);
}

export function bindCommands(value: any, source: () => any, original: any, seen = new WeakSet<object>()) {
  if (value === null || typeof value !== "object" || seen.has(value) || React.isValidElement(value)) { return; }
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) { return; }
  seen.add(value);
  if (value !== original) { commandValues.set(value, source); }
  for (const key of Object.keys(value)) {
    const child = original?.[key];
    bindCommands(value[key], original === undefined ? () => source()?.[key] : () => child, child, seen);
  }
}

