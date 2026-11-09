import * as React from "react";
import { isBrowser } from "../react-utils";

type Queries = { [name: string]: string };
const queries: Queries = {};
const listeners = new Set<() => void>();
const empty: string[] = [];
let current: string[] | undefined;

function recalculateScreenVariants() {
  if (!isBrowser) return;
  const next = Object.entries(queries).filter(([, query]) => window.matchMedia(query).matches).map(([name]) => name);
  if (!current || next.length !== current.length || next.some((name, index) => name !== current?.[index])) {
    current = next;
    listeners.forEach(listener => listener());
  }
}

const store = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    if (listeners.size === 1 && isBrowser) window.addEventListener("resize", recalculateScreenVariants);
    recalculateScreenVariants();
    return () => {
      listeners.delete(listener);
      if (!listeners.size && isBrowser) window.removeEventListener("resize", recalculateScreenVariants);
    };
  },
  getSnapshot: () => current ?? empty,
  getServerSnapshot: () => empty,
};

/** Registers the queries from a generated project module. */
export function createScreenVariantStore(screenQueries: Queries) {
  Object.assign(queries, screenQueries);
  current = undefined;
  return store;
}

export function useScreenVariants(screenStore: typeof store, isMulti: true): string[];
export function useScreenVariants(screenStore: typeof store, isMulti: false): string | undefined;
export function useScreenVariants(screenStore: typeof store, isMulti: boolean): string[] | string | undefined;
export function useScreenVariants(screenStore: typeof store, isMulti: boolean): string[] | string | undefined {
  const active = React.useSyncExternalStore(screenStore.subscribe, screenStore.getSnapshot, screenStore.getServerSnapshot);
  return isMulti ? active : active[active.length - 1];
}
