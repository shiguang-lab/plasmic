import { pathToDisplayString, transformDataTokensToDisplay } from "@/wab/shared/eval/expression-parser";
import type { ModelFieldStore } from "@/wab/client/studio-ctx/model-snapshots";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { arrayEq } from "@/wab/shared/common";
import type { Site } from "@/wab/shared/model/classes";
import * as React from "react";

/** Display paths resolve dependency project IDs/names, never token values or
 * document trees. The original dependency-walk algorithm still formats paths. */
type BindingValue = string | (string | number)[] | null | undefined;
type BindingDisplay = {readonly displayValue: BindingValue; readonly codeExpr: BindingValue};

export function useDataBindingDisplayValue(view: ViewCtx | undefined, value: BindingValue) {
  const source = React.useMemo(() => createDisplaySource(view, value), [view, value]);
  return React.useSyncExternalStore(source.subscribe, source.read, source.read);
}

function createDisplaySource(view: ViewCtx | undefined, value: BindingValue) {
    if (!view) { const fallback: BindingDisplay = {displayValue: value, codeExpr: value}; return { read: () => fallback, subscribe: () => () => undefined }; }
    const studio = view.studioCtx, models = studio.modelSnapshots, site = view.site, lifetime = view.modelLifetime;
    let currentFields: readonly unknown[] | undefined;
    let current: BindingDisplay = {displayValue: value, codeExpr: value};
    const fields = new Map<ModelFieldStore<unknown>, () => void>(), listeners = new Set<() => void>();
    const alive = () => !lifetime.aborted && !view.disposeSignal.aborted && models === studio.modelSnapshots;
    const read = () => {
      if (!alive()) { return current; }
      const used = new Set<ModelFieldStore<unknown>>(), seen = new Set<Site>();
      const scan = (value: Site) => {
        if (seen.has(value)) { return; } seen.add(value);
        const dependencies = models.field(value, "projectDependencies"); used.add(dependencies);
        dependencies.getState().forEach((ref) => {
          const dependency = models.resolve(ref), child = models.field(dependency, "site");
          used.add(child); used.add(models.field(dependency, "name")); used.add(models.field(dependency, "projectId")); scan(models.resolve(child.getState()));
        });
      };
      scan(site);
      const next = [...used].map((field) => field.getState());
      if (!currentFields || !arrayEq(currentFields, next)) {
        currentFields = Object.freeze(next);
        const display = typeof value === "string" ? transformDataTokensToDisplay(value, site, view.siteInfo.id) : value;
        current = Object.freeze({displayValue: display, codeExpr: display && typeof display === "object" ? pathToDisplayString(display, site, view.siteInfo.id) : display});
      }
      if (listeners.size) {
        used.forEach((field) => { if (!fields.has(field)) { fields.set(field, field.subscribe(sync)); } });
        for (const [field, stop] of fields) { if (!used.has(field)) { stop(); fields.delete(field); } }
      }
      return current;
    };
    const disconnect = () => { fields.forEach((stop) => stop()); fields.clear(); lifetime.removeEventListener("abort", disconnect); view.disposeSignal.removeEventListener("abort", disconnect); };
    const sync = () => { const before = current; read(); if (before !== current) { listeners.forEach((listener) => listener()); } };
    const subscribe = (listener: () => void) => {
      if (!alive()) { return () => undefined; }
      listeners.add(listener); lifetime.addEventListener("abort", disconnect, { once: true }); view.disposeSignal.addEventListener("abort", disconnect, { once: true }); read();
      return () => { listeners.delete(listener); if (!listeners.size) { disconnect(); } };
    };
    return { read, subscribe };
}
