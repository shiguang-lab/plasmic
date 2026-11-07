import type { ModelFieldStore } from "@/wab/client/studio-ctx/model-snapshots";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { equalColumnDistribution } from "@/wab/shared/columns-utils";
import { arrayEq, assert } from "@/wab/shared/common";
import { isTplAttachedToSite } from "@/wab/shared/core/sites";
import type { TplColumnsTag } from "@/wab/shared/core/tpls";
import type { ColumnsConfig, ObjInst } from "@/wab/shared/model/classes";
import * as React from "react";

export interface ColumnsWrapSnapshot {
  readonly breakUpRows: boolean;
  readonly colsSizes: readonly number[];
  readonly childCount: number;
}
const empty: ColumnsWrapSnapshot = Object.freeze({ breakUpRows: false, colsSizes: Object.freeze([]), childCount: 0 });

/** A canonical VS config or the original missing-config equal-distribution
 * recipe. The fallback never becomes a model and the parent retains ownership
 * of effective-variant selection and its non-CSS defined indicator. */
export class ColumnsWrapInputs {
  private readonly models;
  private readonly site;
  private readonly lifetime;
  private current = empty;
  private dirty = true;
  private connected = false;
  private readonly listeners = new Set<() => void>();
  private readonly fields = new Map<ModelFieldStore<unknown>, { captured: unknown; prepared?: () => void; published?: () => void }>();
  constructor(private readonly view: ViewCtx, private readonly tpl: TplColumnsTag, private readonly config: ColumnsConfig | undefined) {
    this.models = view.studioCtx.modelSnapshots; this.site = view.site; this.lifetime = view.disposeSignal;
    if (!this.isClosed()) {
      assert(isTplAttachedToSite(this.site, tpl), "Responsive columns belong to another model world");
      assert(!config || tpl.vsettings.some((vs) => vs.columnsConfig === config), "Responsive config must be the original selected VS object");
    }
    this.getSnapshot();
  }
  private isClosed() { return this.lifetime.aborted || this.view.studioCtx.modelSnapshots !== this.models || this.view.studioCtx.site !== this.site; }
  private invalidate = () => { this.dirty = true; };
  private notify = () => { if (!this.isClosed()) { this.listeners.forEach((listener) => listener()); } };
  private disconnect = () => {
    this.connected = false; this.lifetime.removeEventListener("abort", this.disconnect);
    for (const stops of this.fields.values()) { stops.prepared?.(); stops.published?.(); stops.prepared = undefined; stops.published = undefined; }
    if (this.isClosed()) { this.listeners.clear(); }
  };
  getSnapshot = (): ColumnsWrapSnapshot => {
    if (this.isClosed()) { this.disconnect(); return this.current; }
    if (!this.connected && [...this.fields].some(([store, binding]) => store.getState() !== binding.captured)) { this.dirty = true; }
    if (!this.dirty) { return this.current; }
    const read = <T extends ObjInst, K extends Exclude<keyof T, "uid"> & string>(model: T, key: K) => {
      const store = this.models.field(model, key);
      let binding = this.fields.get(store);
      if (!binding) { binding = { captured: store.getState() }; this.fields.set(store, binding); }
      binding.captured = store.getState();
      if (this.connected && !binding.prepared) { binding.prepared = this.models.subscribePreparedField(store, this.invalidate); binding.published = store.subscribe(this.notify); }
      return store.getState();
    };
    const childCount = read(this.tpl, "children").length;
    const breakUpRows = this.config ? read(this.config, "breakUpRows") : false;
    const nextSizes = this.config ? read(this.config, "colsSizes") : equalColumnDistribution(childCount);
    const colsSizes = arrayEq(nextSizes, this.current.colsSizes) ? this.current.colsSizes : Object.freeze([...nextSizes]);
    if (childCount !== this.current.childCount || breakUpRows !== this.current.breakUpRows || colsSizes !== this.current.colsSizes) { this.current = Object.freeze({ breakUpRows, colsSizes, childCount }); }
    this.dirty = false; return this.current;
  };
  subscribe = (listener: () => void): (() => void) => {
    if (this.isClosed()) { this.disconnect(); return () => undefined; }
    this.listeners.add(listener);
    if (!this.connected) { this.connected = true; this.lifetime.addEventListener("abort", this.disconnect, { once: true }); this.dirty = true; this.getSnapshot(); }
    let stopped = false;
    return () => { if (stopped) { return; } stopped = true; this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } };
  };
}

export function useColumnsWrapInputs(view: ViewCtx, tpl: TplColumnsTag, config: ColumnsConfig | undefined) {
  const source = React.useMemo(() => new ColumnsWrapInputs(view, tpl, config), [view, tpl, config]);
  return React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
}
