import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ModelFieldStore } from "@/wab/client/studio-ctx/model-snapshots";
import { arrayEq } from "@/wab/shared/common";
import type { ArenaFrame, ObjInst } from "@/wab/shared/model/classes";
import * as React from "react";

const closed = Object.freeze([]);

/** Scope metadata used to match activity and choose one cursor across frames.
 * Geometry and rendered descendants remain owned by the existing animation loop. */
export class CopilotActivityInputs {
  private readonly models;
  private readonly lifetime;
  private snapshot: readonly unknown[] = closed;
  private readonly fields = new Map<ModelFieldStore<unknown>, () => void>();
  private readonly listeners = new Set<() => void>();
  private connected = false;

  constructor(private readonly studio: StudioCtx, private readonly frames: readonly ArenaFrame[]) {
    this.models = studio.modelSnapshots;
    this.lifetime = studio.arenaState.lifetime();
    this.getSnapshot();
  }

  private disconnect = () => {
    this.connected = false;
    this.lifetime.removeEventListener("abort", this.close);
    this.fields.forEach((stop) => stop());
    this.fields.clear();
  };
  private close = () => {
    this.snapshot = closed;
    this.disconnect();
    this.listeners.forEach((listener) => listener());
  };
  private sync = () => {
    const previous = this.snapshot;
    this.getSnapshot();
    if (previous !== this.snapshot) { this.listeners.forEach((listener) => listener()); }
  };

  getSnapshot = (): readonly unknown[] => {
    if (this.lifetime.aborted || this.studio.modelSnapshots !== this.models) {
      this.snapshot = closed;
      this.disconnect();
      return this.snapshot;
    }
    const used = new Set<ModelFieldStore<unknown>>();
    const field = (model: ObjInst, key: string) => used.add(this.models.declaredField(model, key));
    for (const frame of this.frames) {
      field(frame, "uuid");
      field(frame, "container");
      field(frame.container, "component");
      field(frame.container.component, "uuid");
      field(frame.container.component, "tplTree");
    }
    const next = [...used].map((store) => store.getState());
    if (!arrayEq(this.snapshot, next)) { this.snapshot = Object.freeze(next); }
    if (this.connected) {
      for (const store of used) {
        if (!this.fields.has(store)) { this.fields.set(store, store.subscribe(this.sync)); }
      }
      for (const [store, stop] of this.fields) {
        if (!used.has(store)) { stop(); this.fields.delete(store); }
      }
    }
    return this.snapshot;
  };

  subscribe = (listener: () => void) => {
    if (this.lifetime.aborted || this.studio.modelSnapshots !== this.models) { return () => undefined; }
    this.listeners.add(listener);
    if (!this.connected) {
      this.connected = true;
      this.lifetime.addEventListener("abort", this.close, { once: true });
      this.sync();
    }
    return () => {
      this.listeners.delete(listener);
      if (!this.listeners.size) { this.disconnect(); }
    };
  };
}

export function useCopilotActivityInputs(studio: StudioCtx, frames: readonly ArenaFrame[]) {
  const source = React.useMemo(() => new CopilotActivityInputs(studio, frames), [studio, studio.modelSnapshots, frames]);
  React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
}
