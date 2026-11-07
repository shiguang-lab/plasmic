import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ModelFieldStore, ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { ensureAutoDerivedFrameHeight, getAutoDerivedFrameHeightStore } from "@/wab/shared/Arenas";
import { arrayEq, assert } from "@/wab/shared/common";
import type { ArenaFrame, ObjInst } from "@/wab/shared/model/classes";
import { createStore, type StoreApi } from "zustand/vanilla";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { useMemo, useRef } from "react";

interface HeightInput {
  readonly frame: ArenaFrame;
  readonly models: ModelSnapshots;
  readonly lifetime: AbortSignal;
  readonly state: StoreApi<number>;
  readonly store: ModelFieldStore<number>;
  readonly fields: Map<ModelFieldStore<unknown>, () => void>;
  readonly subscriptions: Set<() => void>;
  stopMeasurement: () => void;
  current: number;
  dirty: boolean;
  connected: boolean;
  disposed: boolean;
}

/** Committed numeric projections over the sole shared transient measurement.
 * Render candidates hold cached values only; subscriptions own the input leases. */
export class FrameHeights {
  private readonly records = new Map<ArenaFrame, Set<HeightInput>>();
  private readonly retired = new WeakMap<ArenaFrame, ModelFieldStore<number>>();
  private readonly candidates = new WeakMap<ArenaFrame, HeightInput>();
  private readonly publications = new Set<HeightInput>();
  private stopCommits: (() => void) | undefined;
  private modelOwner: ModelSnapshots | undefined;
  private preparing = false;
  private disposed = false;

  constructor(private readonly studio: StudioCtx) {}

  frameStore(frame: ArenaFrame): ModelFieldStore<number> {
    if (this.modelOwner && this.modelOwner !== this.studio.modelSnapshots) { this.resetModelOwner(); }
    const retained = this.records.get(frame)?.values().next().value;
    if (retained) { return retained.store; }
    const terminal = this.retired.get(frame);
    if (terminal && (this.disposed || !this.isCurrentFrame(frame))) { return terminal; }
    const cached = this.candidates.get(frame);
    if (cached && (this.disposed || !this.isCurrentFrame(frame))) { this.seal(cached); return cached.store; }
    assert(!this.disposed, "Cannot demand frame heights from a disposed owner");
    assert(this.isCurrentFrame(frame), "Cannot attach a foreign frame to the current height owner");
    const models = this.studio.modelSnapshots, lifetime = this.studio.arenaState.lifetime();
    const initial = this.capture(frame, models, new Set());
    const state = createStore(() => initial);
    const record: HeightInput = {
      frame, models, lifetime, state, current: initial, dirty: false, connected: false, disposed: false,
      fields: new Map(), subscriptions: new Set(), stopMeasurement: () => undefined,
      store: {
        // Inactive and departed render candidates remain safe primitive snapshots.
        getState: () => record.current, getInitialState: state.getInitialState,
        subscribe: (listener) => {
          if (!this.canConnect(record)) { this.seal(record); return () => undefined; }
          const off = state.subscribe(listener);
          const stop = () => {
            off(); record.subscriptions.delete(stop);
            if (!record.subscriptions.size) { this.disconnect(record); }
          };
          record.subscriptions.add(stop);
          try { this.connect(record); }
          catch (error) { stop(); throw error; }
          return stop;
        },
      },
    };
    this.candidates.set(frame, record);
    return record.store;
  }

  private isCurrentFrame(frame: ArenaFrame) {
    return this.studio.arenaState.frameMembershipStore.getState().some((ref) =>
      ref.uid === frame.uid && this.studio.modelSnapshots.resolve(ref) === frame);
  }

  private canConnect(record: HeightInput) {
    return !this.disposed && !record.disposed && record.models === this.studio.modelSnapshots &&
      this.studio.arenaState.isCurrentLifetime(record.lifetime) && this.isCurrentFrame(record.frame);
  }

  private connect(record: HeightInput) {
    if (record.connected) { return; }
    assert(this.canConnect(record), "Cannot reconnect a departed height candidate");
    const fields = new Set<ModelFieldStore<unknown>>();
    const next = this.capture(record.frame, record.models, fields);
    record.current = next; record.dirty = false; record.connected = true;
    this.modelOwner = record.models;
    let group = this.records.get(record.frame);
    if (!group) { group = new Set(); this.records.set(record.frame, group); }
    group.add(record);
    try {
      this.bindFields(record, fields);
      record.stopMeasurement = getAutoDerivedFrameHeightStore(record.frame).subscribe(() => {
        if (!this.canConnect(record)) { this.seal(record); return; }
        this.records.get(record.frame)?.forEach((input) => { input.dirty = true; });
        if (!this.preparing && !this.studio.hasPendingModelChanges()) { this.prepareCommit(); this.publishCommit(); }
      });
      if (!this.stopCommits) {
        this.stopCommits = this.studio.subscribeModelChanges((event) => {
          if (event.type === "site-replaced") {
            if (this.modelOwner && this.modelOwner !== this.studio.modelSnapshots) { this.resetModelOwner(); }
          } else { this.prepareCommit(); this.publishCommit(); }
        });
      }
    } catch (error) { this.disconnect(record); throw error; }
    if (!Object.is(record.state.getState(), next)) { record.state.setState(next, true); }
  }

  private disconnect(record: HeightInput) {
    if (!record.connected) { return; }
    record.connected = false;
    this.candidates.set(record.frame, record);
    record.stopMeasurement(); record.stopMeasurement = () => undefined;
    record.fields.forEach((stop) => stop()); record.fields.clear();
    const group = this.records.get(record.frame);
    group?.delete(record);
    if (!group?.size) { this.records.delete(record.frame); }
    this.publications.delete(record);
    if (!this.records.size) { this.stopCommits?.(); this.stopCommits = undefined; }
  }

  private seal(record: HeightInput) {
    if (record.disposed) { return; }
    record.disposed = true;
    record.subscriptions.forEach((stop) => stop()); record.subscriptions.clear();
    this.disconnect(record);
    this.retired.set(record.frame, record.store);
  }

  /** All demanded dirty values are installed before the first UI notification. */
  prepareCommit() {
    if (this.disposed) { return; }
    if (this.modelOwner && this.modelOwner !== this.studio.modelSnapshots) { this.resetModelOwner(); return; }
    this.preparing = true;
    try {
      for (const group of this.records.values()) {
        for (const record of group) {
          if (!this.canConnect(record)) { this.seal(record); continue; }
          if (!record.dirty) { continue; }
          const fields = new Set<ModelFieldStore<unknown>>();
          const next = this.capture(record.frame, record.models, fields);
          this.bindFields(record, fields); record.dirty = false; record.current = next;
          if (Object.is(record.state.getState(), next)) { this.publications.delete(record); }
          else { this.publications.add(record); }
        }
      }
    } finally { this.preparing = false; }
  }

  publishCommit() {
    if (this.disposed || this.preparing) { return; }
    const publish = [...this.publications]; this.publications.clear();
    for (const record of publish) {
      if (record.connected && !record.disposed && !Object.is(record.state.getState(), record.current)) { record.state.setState(record.current, true); }
    }
  }

  private capture(frame: ArenaFrame, models: ModelSnapshots, fields: Set<ModelFieldStore<unknown>>) {
    const read = <T extends ObjInst, Key extends Exclude<keyof T, "uid"> & string>(model: T, key: Key) => {
      const field = models.field(model, key); fields.add(field); return field.getState();
    };
    const authoredHeight = read(frame, "height"), viewMode = read(frame, "viewMode");
    const container = models.resolve(read(frame, "container"));
    const component = models.resolve(read(container, "component"));
    const type = read(component, "type");
    return type === "page" || (type === "plain" && viewMode === "stretch")
      ? ensureAutoDerivedFrameHeight(frame, authoredHeight) : authoredHeight;
  }

  private bindFields(record: HeightInput, next: ReadonlySet<ModelFieldStore<unknown>>) {
    for (const [field, stop] of record.fields) { if (!next.has(field)) { stop(); record.fields.delete(field); } }
    for (const field of next) {
      if (!record.fields.has(field)) { record.fields.set(field, record.models.subscribePreparedField(field, () => { record.dirty = true; })); }
    }
  }

  /** Seal subscribed old outputs without clearing their shared cached number. */
  resetModelOwner() {
    for (const group of this.records.values()) { for (const record of group) { this.seal(record); } }
    this.records.clear(); this.publications.clear(); this.stopCommits?.(); this.stopCommits = undefined; this.modelOwner = undefined;
  }

  dispose() {
    if (this.disposed) { return; }
    this.disposed = true; this.resetModelOwner();
  }
}

const noFrameHeight = createStore<number | undefined>(() => undefined);
export function useFrameHeight(studio: StudioCtx, frame: ArenaFrame): number;
export function useFrameHeight(studio: StudioCtx, frame: ArenaFrame | undefined): number | undefined;
export function useFrameHeight(studio: StudioCtx, frame: ArenaFrame | undefined) {
  const store = useMemo<ModelFieldStore<number | undefined>>(() => frame ? studio.frameHeights.frameStore(frame) : noFrameHeight, [studio, frame]);
  return useStore(store);
}

export function useFrameHeights(studio: StudioCtx, frames: readonly ArenaFrame[]) {
  const roster = useRef<readonly ArenaFrame[]>(frames.slice());
  if (!arrayEq(roster.current, frames)) { roster.current = frames.slice(); }
  const stableFrames = roster.current;
  const store = useMemo<ModelFieldStore<readonly number[]>>(() => {
    const sources = stableFrames.map((frame) => studio.frameHeights.frameStore(frame));
    const initial = Object.freeze(sources.map((source) => source.getInitialState()));
    let current = Object.freeze(sources.map((source) => source.getState()));
    const read = () => {
      const next = sources.map((source) => source.getState());
      if (!arrayEq(current, next)) { current = Object.freeze(next); }
      return current;
    };
    return {
      getState: read, getInitialState: () => initial,
      subscribe: (listener) => {
        let previous = read();
        const notify = () => {
          const next = read();
          if (next !== previous) { const before = previous; previous = next; listener(next, before); }
        };
        const stops = sources.map((source) => source.subscribe(notify)); return () => stops.forEach((stop) => stop());
      },
    };
  }, [studio, stableFrames]);
  return useStore(store, useShallow((heights) => heights));
}

export function subscribeFrameHeights(studio: StudioCtx, frames: readonly ArenaFrame[], listener: () => void) {
  const stops = frames.map((frame) => studio.frameHeights.frameStore(frame).subscribe(listener));
  return () => stops.forEach((stop) => stop());
}
