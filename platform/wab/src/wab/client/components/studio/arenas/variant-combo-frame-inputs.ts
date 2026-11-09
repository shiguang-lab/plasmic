import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ModelFieldStore, ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { ArenaFrame, Component, ComponentArena, ObjInst, PageArena, Site } from "@/wab/shared/model/classes";
import * as React from "react";

interface ComboFrameInputs {
  readonly alive: boolean;
  readonly component: Component | undefined;
  readonly frame: ArenaFrame | undefined;
  readonly width: number | undefined;
}
const retired: ComboFrameInputs = Object.freeze({ alive: false, component: undefined, frame: undefined, width: undefined });

/** Only the first matrix frame determines the combination entry's dimensions.
 * Model props keep the world in which their command identities were received. */
export class VariantComboFrameInputs {
  readonly site: Site;
  private readonly models: ModelSnapshots;
  private readonly lifetime: AbortSignal;
  private current = retired;
  private readonly fields = new Map<ModelFieldStore<unknown>, () => void>();
  private readonly listeners = new Set<() => void>();
  private connected = false;
  constructor(private readonly studio: StudioCtx, private readonly arena: ComponentArena | PageArena) {
    this.models = studio.modelSnapshots; this.site = studio.site; this.lifetime = studio.arenaState.lifetime();
    this.getSnapshot();
  }
  isCurrent = () => !this.lifetime.aborted && this.models === this.studio.modelSnapshots && this.site === this.studio.site;
  private disconnect = () => {
    this.connected = false; this.lifetime.removeEventListener("abort", this.sync);
    this.fields.forEach((stop) => stop()); this.fields.clear();
  };
  private sync = () => {
    const before = this.current; this.getSnapshot();
    if (!this.isCurrent()) { this.disconnect(); }
    if (before !== this.current) { this.listeners.forEach((listener) => listener()); }
  };
  getSnapshot = (): ComboFrameInputs => {
    if (!this.isCurrent()) { this.current = retired; return this.current; }
    const used = new Set<ModelFieldStore<unknown>>();
    const read = <T extends ObjInst, K extends Exclude<keyof T, "uid"> & string>(model: T, key: K) => {
      const store = this.models.field(model, key); used.add(store); return store.getState();
    };
    const component = this.models.resolve(read(this.arena, "component"));
    const grid = this.models.resolve(read(this.arena, "matrix"));
    const rowRef = read(grid, "rows")[0];
    const row = rowRef && this.models.resolve(rowRef);
    const cellRef = row && read(row, "cols")[0];
    const cell = cellRef && this.models.resolve(cellRef);
    const frame = cell && this.models.resolve(read(cell, "frame"));
    const width = frame && read(frame, "width");
    if (!this.current.alive || this.current.component !== component || this.current.frame !== frame || this.current.width !== width) {
      this.current = Object.freeze({ alive: true, component, frame, width });
    }
    if (this.connected) {
      for (const store of used) { if (!this.fields.has(store)) { this.fields.set(store, store.subscribe(this.sync)); } }
      for (const [store, stop] of this.fields) { if (!used.has(store)) { stop(); this.fields.delete(store); } }
    }
    return this.current;
  };
  subscribe = (listener: () => void) => {
    if (!this.isCurrent()) { return () => undefined; }
    this.listeners.add(listener);
    if (!this.connected) { this.connected = true; this.lifetime.addEventListener("abort", this.sync, { once: true }); this.sync(); }
    return () => { this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } };
  };
}
export function useVariantComboFrameInputs(studio: StudioCtx, arena: ComponentArena | PageArena) {
  const source = React.useMemo(() => new VariantComboFrameInputs(studio, arena), [studio, arena]);
  const inputs = React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  return { ...inputs, site: source.site, isCurrent: source.isCurrent };
}
