import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import type { ModelFieldStore, ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { arrayEq } from "@/wab/shared/common";
import { isSlotSelection } from "@/wab/shared/core/slots";
import { isKnownTplTag, isKnownTplComponent, isKnownTplSlot, isKnownRenderExpr, type ObjInst } from "@/wab/shared/model/classes";
import * as React from "react";

interface ContentControlSnapshot { readonly alive: boolean; readonly fields: readonly unknown[]; }
const empty: ContentControlSnapshot = Object.freeze({ alive: false, fields: Object.freeze([]) });
interface ContentControlScope {
  readonly models: ModelSnapshots;
  readonly signal: AbortSignal;
}

/** Model eligibility and child-boundary inputs for getContentEditorTarget.
 * Rendered DOM remains observed by the control's existing geometry observers. */
export class ContentEditorControlInputs {
  private readonly models;
  private readonly signal;
  private snapshot: ContentControlSnapshot = empty;
  private readonly fields = new Map<ModelFieldStore<unknown>, () => void>();
  private readonly listeners = new Set<() => void>();
  private connected = false;
  constructor(private readonly view: ViewCtx, scope: ContentControlScope = { models: view.studioCtx.modelSnapshots, signal: view.disposeSignal }) {
    this.models = scope.models;
    this.signal = scope.signal;
    this.getSnapshot();
  }
  private disconnect = () => {
    this.connected = false; this.signal.removeEventListener("abort", this.close);
    this.fields.forEach((stop) => stop()); this.fields.clear();
  };
  private close = () => {
    this.snapshot = empty; this.disconnect(); this.listeners.forEach((listener) => listener());
  };
  private sync = () => {
    const previous = this.snapshot; this.getSnapshot();
    if (previous !== this.snapshot) { this.listeners.forEach((listener) => listener()); }
  };
  getSnapshot = (): ContentControlSnapshot => {
    if (this.signal.aborted || this.view.studioCtx.modelSnapshots !== this.models) {
      this.snapshot = empty; this.disconnect(); return this.snapshot;
    }
    const used = new Set<ModelFieldStore<unknown>>();
    const field = (model: ObjInst, ...keys: string[]) => keys.forEach((key) => used.add(this.models.declaredField(model, key)));
    for (const { node } of this.view.focusedTplAncestorsThroughComponents()) {
      const tpl = isSlotSelection(node) ? node.getTpl() : node;
      field(tpl, "parent");
      if (isKnownTplTag(tpl)) { field(tpl, "tag", "type", "children"); }
      else if (isKnownTplComponent(tpl)) {
        field(tpl, "component", "vsettings"); field(tpl.component, "type", "params", "tplTree");
        tpl.component.params.forEach((param) => field(param, "type"));
        tpl.vsettings.forEach((setting) => {
          field(setting, "args", "variants"); setting.variants.forEach((variant) => field(variant, "name"));
          setting.args.forEach((arg) => {
            field(arg, "param", "expr"); field(arg.param, "type");
            if (isKnownRenderExpr(arg.expr)) { field(arg.expr, "tpl"); }
          });
        });
      } else if (isKnownTplSlot(tpl)) { field(tpl, "defaultContents"); }
    }
    const values = [...used].map((store) => store.getState());
    if (!this.snapshot.alive || !arrayEq(this.snapshot.fields, values)) { this.snapshot = Object.freeze({ alive: true, fields: Object.freeze(values) }); }
    if (this.connected) {
      for (const store of used) { if (!this.fields.has(store)) { this.fields.set(store, store.subscribe(this.sync)); } }
      for (const [store, stop] of this.fields) { if (!used.has(store)) { stop(); this.fields.delete(store); } }
    }
    return this.snapshot;
  };
  subscribe = (listener: () => void) => {
    if (this.signal.aborted || this.view.studioCtx.modelSnapshots !== this.models) { return () => undefined; }
    this.listeners.add(listener);
    if (!this.connected) { this.connected = true; this.signal.addEventListener("abort", this.close, { once: true }); this.sync(); }
    return () => { this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } };
  };
}

export function useContentEditorControlInputs(view: ViewCtx | undefined, selection: unknown) {
  const scope = React.useMemo(() => view ? { view, models: view.studioCtx.modelSnapshots, signal: view.disposeSignal } : undefined, [view]);
  const source = React.useMemo(() => scope ? new ContentEditorControlInputs(scope.view, scope) : undefined, [scope, selection]);
  const subscribe = source?.subscribe ?? (() => () => undefined);
  const read = source?.getSnapshot ?? (() => empty);
  return React.useSyncExternalStore(subscribe, read, read).alive;
}
