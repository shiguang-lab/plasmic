import type { ModelFieldStore, ModelRef, ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { assert, ensure } from "@/wab/shared/common";
import type { ArenaFrame, Component, TplComponent } from "@/wab/shared/model/classes";
import { createStore } from "zustand/vanilla";

export interface ViewRegistryEntry {
  readonly view: ViewCtx;
  readonly frame: ModelRef<ArenaFrame>;
  readonly component: ModelRef<Component>;
  readonly ready: ModelFieldStore<boolean>;
}
export type ViewRegistrySnapshot = readonly ViewRegistryEntry[];
const emptyEntries: ViewRegistrySnapshot = Object.freeze([]);
const emptyViews: readonly ViewCtx[] = Object.freeze([]);

interface Registration {
  readonly view: ViewCtx;
  readonly frame: ArenaFrame;
  readonly models: ModelSnapshots;
  entry: ViewRegistryEntry;
  container: TplComponent;
  dirty: boolean;
  stopFrame: (() => void) | undefined;
  stopComponent: (() => void) | undefined;
}
interface Checkpoint {
  readonly epoch: object;
  readonly records: readonly Registration[];
  readonly entries: ViewRegistrySnapshot;
  readonly views: readonly ViewCtx[];
  readonly containers: readonly TplComponent[];
}
interface RegistryContext {
  readonly modelSnapshots: ModelSnapshots;
  lifetime(): AbortSignal;
  ownsView(view: ViewCtx): boolean;
}

/** One ordered registration domain, composed by the existing Arena transaction.
 * Readiness is owned by ViewCtx; entries only retain that exact readonly source. */
export class StudioViewRegistry {
  private records: readonly Registration[] = Object.freeze([]);
  private entries: ViewRegistrySnapshot = emptyEntries;
  private views: readonly ViewCtx[] = emptyViews;
  private readonly notifications = createStore<ViewRegistrySnapshot>(() => emptyEntries);
  private readonly subscriptions = new Set<() => void>();
  private readonly byFrame = new Map<ArenaFrame, Registration>();
  private readonly byView = new Map<ViewCtx, Registration>();
  private readonly identities = new WeakMap<ViewRegistryEntry, { readonly frame: ArenaFrame; readonly component: Component; readonly container: TplComponent }>();
  private readonly checkpoints: Checkpoint[] = [];
  private depth = 0;
  private epoch: object = {};
  private suspended = false;
  private disposed = false;

  constructor(private readonly context: RegistryContext) {}

  readonly store: ModelFieldStore<ViewRegistrySnapshot> = {
    getState: () => this.entries,
    getInitialState: () => emptyEntries,
    subscribe: (listener) => {
      if (this.disposed) { return () => undefined; }
      const off = this.notifications.subscribe(listener);
      const stop = () => { off(); this.subscriptions.delete(stop); };
      this.subscriptions.add(stop);
      return stop;
    },
  };

  commandViews() { return this.views; }
  forFrame(frame: ArenaFrame | undefined) { return frame ? this.byFrame.get(frame)?.entry : undefined; }
  forComponent(component: Component | undefined) {
    return this.selectComponent(this.entries, component);
  }
  /** Snapshot selectors compare captured model identity, never a mutable getter
   * or a ref resolved against whichever model owner happens to be current. */
  selectFrame(entries: ViewRegistrySnapshot, frame: ArenaFrame | undefined) {
    return frame ? entries.find((entry) => this.identities.get(entry)?.frame === frame) : undefined;
  }
  selectComponent(entries: ViewRegistrySnapshot, component: Component | undefined) {
    return component ? entries.find((entry) => this.identities.get(entry)?.component === component) : undefined;
  }

  register(view: ViewCtx) {
    assert(!this.disposed && !this.suspended, "Cannot register a view on an inactive registry");
    assert(this.context.ownsView(view) && view.modelLifetime === this.context.lifetime() && !view.modelLifetime.aborted && !view.isDisposed,
      "Cannot register a view from another canvas lifetime");
    const existing = this.byView.get(view);
    if (existing) { return existing.entry; }
    const frame = view.arenaFrame();
    assert(!this.byFrame.has(frame), "A canvas frame already has a registered view");
    const models = this.context.modelSnapshots;
    const frameRef = models.ref(frame);
    const container = frame.container;
    const entry = Object.freeze({ view, frame: frameRef, component: models.ref(view.component), ready: view.initialRenderReadyStore });
    this.identities.set(entry, { frame, component: view.component, container });
    const record: Registration = { view, frame, models, entry, container, dirty: false, stopFrame: undefined, stopComponent: undefined };
    this.bind(record);
    this.installRecords(Object.freeze([...this.records, record]));
    this.publishCommit();
    return entry;
  }

  remove(view: ViewCtx) {
    const record = this.byView.get(view);
    if (!record) { return; }
    this.detach(record);
    this.installRecords(Object.freeze(this.records.filter((item) => item !== record)));
    this.publishCommit();
  }

  private bind(record: Registration) {
    const invalidate = () => { record.dirty = true; };
    record.stopFrame = record.models.subscribePreparedField(record.models.field(record.frame, "container"), invalidate);
    record.stopComponent = record.models.subscribePreparedField(record.models.field(record.container, "component"), invalidate);
  }
  private detach(record: Registration) {
    record.stopFrame?.(); record.stopComponent?.();
    record.stopFrame = undefined; record.stopComponent = undefined;
  }
  private installRecords(next: readonly Registration[]) {
    for (const record of this.records) {
      if (!next.includes(record)) { this.byFrame.delete(record.frame); this.byView.delete(record.view); }
    }
    for (const record of next) {
      this.byFrame.set(record.frame, record); this.byView.set(record.view, record);
    }
    const membershipChanged = next !== this.records;
    this.records = next;
    if (membershipChanged) { this.views = next.length ? Object.freeze(next.map((record) => record.view)) : emptyViews; }
    this.installEntries();
  }
  private installEntries() {
    const next = this.records.map((record) => record.entry);
    if (next.length === this.entries.length && next.every((entry, index) => entry === this.entries[index])) { return; }
    this.entries = next.length ? Object.freeze(next) : emptyEntries;
  }
  prepareCommit() {
    if (this.disposed || this.suspended) { return; }
    for (const record of this.records) {
      if (!record.dirty) { continue; }
      record.dirty = false;
      const containerRef = record.models.field(record.frame, "container").getState();
      const container = record.models.resolve(containerRef);
      if (container !== record.container) {
        record.stopComponent?.(); record.container = container;
        record.stopComponent = record.models.subscribePreparedField(record.models.field(container, "component"), () => { record.dirty = true; });
      }
      const componentRef = record.models.field(container, "component").getState();
      const previous = record.entry;
      if (previous.component !== componentRef) {
        record.entry = Object.freeze({ view: previous.view, frame: previous.frame, component: componentRef, ready: previous.ready });
        this.identities.set(record.entry, { frame: record.frame, container, component: record.models.resolve(componentRef) });
      }
    }
    this.installEntries();
  }
  publishCommit() {
    if (this.depth || this.checkpoints.length) { return; }
    if (this.notifications.getState() !== this.entries) { this.notifications.setState(() => this.entries, true); }
    if (this.disposed) { for (const stop of this.subscriptions) { stop(); } }
  }
  deferPublication<Result>(command: () => Result): Result {
    this.depth++;
    try { return command(); } finally { this.depth--; this.publishCommit(); }
  }
  transaction<Result>(command: () => Result): Result {
    assert(!this.disposed, "Cannot change a disposed view registry");
    const checkpoint: Checkpoint = { epoch: this.epoch, records: this.records, entries: this.entries, views: this.views, containers: this.records.map((record) => record.container) };
    this.checkpoints.push(checkpoint);
    try { return command(); }
    catch (error) {
      if (!this.disposed && checkpoint.epoch === this.epoch) {
        for (const record of this.records) { if (!checkpoint.records.includes(record)) { this.detach(record); } }
        checkpoint.records.forEach((record, index) => {
          record.entry = checkpoint.entries[index];
          const container = ensure(checkpoint.containers[index], "Registered view container");
          if (record.container !== container) { this.detach(record); record.container = container; }
          if (!record.stopFrame) { this.bind(record); }
          record.dirty = false;
        });
        this.installRecords(checkpoint.records);
        this.entries = checkpoint.entries; this.views = checkpoint.views;
      }
      throw error;
    } finally { this.checkpoints.pop(); if (!this.checkpoints.length) { this.prepareCommit(); this.publishCommit(); } }
  }
  reset() {
    for (const record of this.records) { this.detach(record); }
    this.installRecords(Object.freeze([]));
    this.suspended = true; this.epoch = {};
    this.publishCommit();
  }
  attachSite() {
    assert(!this.disposed, "Cannot attach a disposed view registry");
    this.suspended = false;
  }
  dispose() {
    if (this.disposed) { return; }
    this.reset(); this.disposed = true;
    // Closing supersedes publication deferral, without corrupting the nesting
    // counters still owned by the synchronous commands that must unwind.
    if (this.notifications.getState() !== this.entries) { this.notifications.setState(() => this.entries, true); }
    for (const stop of this.subscriptions) { stop(); }
  }
}
