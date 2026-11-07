import type { ModelFieldStore, ModelRef, ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { arrayEq, assert } from "@/wab/shared/common";
import type { ArenaFrame } from "@/wab/shared/model/classes";
import { createStore } from "zustand/vanilla";

export interface StudioSelectionSnapshot {
  /** Command owner identity, like viewportOwnerStore; its model fields are separate inputs. */
  readonly view: ViewCtx | undefined;
  readonly frames: readonly ModelRef<ArenaFrame>[];
}

const emptyFrames: readonly ModelRef<ArenaFrame>[] = Object.freeze([]);
export class StudioSelection {
  private readonly state = createStore<StudioSelectionSnapshot>(() => Object.freeze({ view: undefined, frames: emptyFrames }));
  private snapshot = this.state.getState();
  private publicationDepth = 0;
  private readonly subscriptions = new Set<() => void>();
  private readonly frameCommands = new WeakMap<readonly ModelRef<ArenaFrame>[], readonly ArenaFrame[]>();
  private disposed = false;
  private modelOwner = {};
  private pending: StudioSelectionSnapshot | undefined;
  private depth = 0;
  private transactionSnapshot: StudioSelectionSnapshot | undefined;
  readonly store: ModelFieldStore<StudioSelectionSnapshot> = {
    getState: () => this.snapshot,
    getInitialState: this.state.getInitialState,
    subscribe: (listener) => {
      if (this.disposed) { return () => undefined; }
      const unsubscribe = this.state.subscribe(listener);
      const stop = () => { unsubscribe(); this.subscriptions.delete(stop); };
      this.subscriptions.add(stop);
      return stop;
    },
  };
  constructor(private readonly models: () => ModelSnapshots) {}
  current() { return this.disposed ? this.snapshot : this.pending ?? this.snapshot; }
  deferPublication<Result>(command: () => Result): Result {
    this.publicationDepth++;
    try { return command(); }
    finally { this.publicationDepth--; this.publish(); }
  }
  private install(snapshot: StudioSelectionSnapshot) {
    this.snapshot = snapshot;
    this.publish();
  }
  private publish() {
    if (!this.publicationDepth && !this.depth && this.state.getState() !== this.snapshot) { this.state.setState(this.snapshot, true); }
  }
  transaction<Result>(command: () => Result): Result {
    const checkpoint = { pending: this.pending, snapshot: this.snapshot, modelOwner: this.modelOwner };
    if (!this.depth) { this.transactionSnapshot = this.snapshot; }
    this.depth++;
    let succeeded = false;
    try { const result = command(); succeeded = true; return result; }
    catch (error) {
      if (this.disposed) { this.pending = undefined; }
      else if (checkpoint.modelOwner !== this.modelOwner) { this.resetModelOwner(); }
      else { this.pending = checkpoint.pending; this.snapshot = checkpoint.snapshot; }
      throw error;
    }
    finally {
      this.depth--;
      if (!this.disposed && !this.depth && succeeded && this.pending) {
        const previous = this.transactionSnapshot ?? this.snapshot;
        const pending = this.pending;
        this.pending = undefined;
        const frames = arrayEq(previous.frames, pending.frames) ? previous.frames : pending.frames;
        const next = previous.view === pending.view && frames === previous.frames ? previous : Object.freeze({ view: pending.view, frames });
        if (this.snapshot !== next) { this.install(next); }
      }
      if (!this.depth) { this.transactionSnapshot = undefined; this.publish(); }
    }
  }
  /** Install pending focus before model-field listeners run; notification waits
   * for the coordinating native transaction to finish. */
  prepareCommit() {
    if (!this.disposed && this.pending) {
      const previous = this.transactionSnapshot ?? this.snapshot;
      const frames = arrayEq(previous.frames, this.pending.frames) ? previous.frames : this.pending.frames;
      const next = previous.view === this.pending.view && frames === previous.frames ? previous : Object.freeze({ view: this.pending.view, frames });
      this.install(next);
    }
  }
  set(view: ViewCtx | undefined, frames: readonly ArenaFrame[]) {
    assert(!this.disposed, "Cannot change a disposed Studio selection");
    const previous = this.current();
    const refs = frames.map((frame) => this.models().ref(frame));
    const sameFrames = arrayEq(previous.frames, refs);
    if (previous.view === view && sameFrames) { return; }
    const next = Object.freeze({ view, frames: sameFrames ? previous.frames : Object.freeze(refs) });
    if (this.depth) { this.pending = next; } else { this.install(next); }
  }
  frames() {
    const refs = this.current().frames;
    let frames = this.frameCommands.get(refs);
    if (!frames) {
      frames = Object.freeze(refs.map((ref) => this.models().resolve(ref)));
      this.frameCommands.set(refs, frames);
    }
    return frames;
  }
  clear() { this.set(undefined, []); }
  /** Model replacement supersedes savepoints from the departed model owner. */
  resetModelOwner() {
    assert(!this.disposed, "Cannot replace models on a disposed Studio selection");
    this.modelOwner = {}; this.pending = undefined; this.transactionSnapshot = undefined;
    this.install(Object.freeze({ view: undefined, frames: emptyFrames }));
  }
  dispose() {
    if (this.disposed) { return; }
    this.pending = undefined;
    this.disposed = true;
    this.snapshot = Object.freeze({ view: undefined, frames: emptyFrames });
    // Owner exit supersedes an in-flight command and publication deferral.
    this.state.setState(this.snapshot, true);
    for (const stop of this.subscriptions) { stop(); }
  }
}
