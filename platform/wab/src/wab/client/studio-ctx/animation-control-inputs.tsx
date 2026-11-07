import type { ModelFieldStore, ModelRef } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { arrayEq, assert, ensure } from "@/wab/shared/common";
import { walkDependencyTree } from "@/wab/shared/core/project-deps";
import { allAnimationSequences } from "@/wab/shared/core/sites";
import type { Animation, AnimationSequence, ObjInst } from "@/wab/shared/model/classes";
import { naturalSortByName } from "@/wab/shared/sort";
import * as React from "react";

interface AnimationScope {
  readonly models: StudioCtx["modelSnapshots"];
  readonly lifetime: AbortSignal;
  readonly site: StudioCtx["site"];
}
const scopes = new WeakMap<StudioCtx, WeakMap<Animation, AnimationScope>>();
function animationScope(studio: StudioCtx, animation: Animation) {
  let animations = scopes.get(studio);
  const known = animations?.get(animation);
  if (known) { return known; }
  const scope = { models: studio.modelSnapshots, lifetime: studio.arenaState.lifetime(), site: studio.site };
  // New animations choose root/direct sequences; cloneAnimation preserves its
  // original sequence, including transitive dependencies. Admission validates
  // the model world, independently of the editor's direct-only choice roster.
  if (!scope.lifetime.aborted) {
    assert(allAnimationSequences(scope.site, { includeDeps: "all" }).includes(animation.sequence), "Animation sequence belongs to another model world");
  }
  if (!animations) { animations = new WeakMap(); scopes.set(studio, animations); }
  animations.set(animation, scope);
  return scope;
}
interface SequenceChoice {
  readonly ref: ModelRef<AnimationSequence>;
  readonly uuid: string;
  readonly name: string;
}
interface SequenceGroup {
  readonly name: string;
  readonly sequences: readonly SequenceChoice[];
}
export interface AnimationControlSnapshot {
  readonly active: boolean;
  readonly groups: readonly SequenceGroup[];
  readonly sequenceId: string;
  readonly duration: Animation["duration"];
  readonly delay: Animation["delay"];
  readonly timingFunction: Animation["timingFunction"];
  readonly iterationCount: Animation["iterationCount"];
  readonly direction: Animation["direction"];
  readonly fillMode: Animation["fillMode"];
}

/** The one animation editor's explicit fields and root/direct choice roster.
 * Rows are immutable UI values; only commands resolve their captured refs. */
export class AnimationControlInputs {
  private readonly scope;
  private current: AnimationControlSnapshot | undefined;
  private readonly fields = new Map<ModelFieldStore<unknown>, { prepare: () => void; publish: () => void }>();
  private captured = new Map<ModelFieldStore<unknown>, unknown>();
  private readonly listeners = new Set<() => void>();
  private stopApp: (() => void) | undefined;
  private connected = false;
  private dirty = true;
  private closed = false;
  private hostless;
  constructor(private readonly studio: StudioCtx, private readonly animation: Animation) {
    this.scope = animationScope(studio, animation);
    this.hostless = studio.appCtx.appConfig.hostLessComponents;
  }
  private isClosed = () => this.closed || this.scope.lifetime.aborted;
  private invalidate = () => { this.dirty = true; };
  private disconnect = () => {
    this.connected = false;
    for (const stops of this.fields.values()) { stops.prepare(); stops.publish(); }
    this.fields.clear(); this.stopApp?.(); this.stopApp = undefined;
    this.scope.lifetime.removeEventListener("abort", this.close);
  };
  private close = () => {
    if (this.closed) { return; } this.closed = true; this.disconnect();
    if (this.current) { this.current = Object.freeze({ ...this.current, active: false }); }
    this.listeners.forEach((listener) => listener()); this.listeners.clear();
  };
  private publish = () => {
    if (this.isClosed()) { this.close(); return; }
    const previous = this.current;
    const next = this.getSnapshot();
    if (next !== previous) { this.listeners.forEach((listener) => listener()); }
  };
  getSnapshot = (): AnimationControlSnapshot | undefined => {
    if (this.isClosed()) {
      if (this.current?.active) { this.current = Object.freeze({ ...this.current, active: false }); }
      return this.current;
    }
    if (this.hostless !== this.studio.appCtx.appConfig.hostLessComponents || [...this.captured].some(([field, value]) => field.getState() !== value)) { this.dirty = true; }
    if (!this.dirty && this.current) { return this.current; }
    const { site, models } = this.scope;
    const used = new Set<ModelFieldStore<unknown>>();
    const declare = (model: ObjInst, ...names: string[]) => names.forEach((name) => used.add(models.declaredField(model, name)));
    declare(this.animation, "sequence", "duration", "delay", "timingFunction", "iterationCount", "direction", "fillMode");
    declare(this.animation.sequence, "uuid");
    declare(site, "animationSequences", "projectDependencies");
    const dependencies = walkDependencyTree(site, "direct");
    dependencies.forEach((dep) => { declare(dep, "site", "projectId", "name"); declare(dep.site, "animationSequences"); });
    const groups = [
      { name: "This project", animationSequences: naturalSortByName<AnimationSequence>(site.animationSequences) },
      ...naturalSortByName(dependencies.map((dep) => ({
        name: this.studio.projectDependencyManager.getNiceDepName(dep),
        animationSequences: naturalSortByName<AnimationSequence>(dep.site.animationSequences),
      }))),
    ].filter((group) => group.animationSequences.length > 0);
    const previousGroups = this.current?.groups;
    const projected = groups.map((group, index) => {
      const previous = previousGroups?.[index];
      const sequences = group.animationSequences.map((sequence) => {
        declare(sequence, "uuid", "name");
        const ref = models.ref(sequence), before = previousGroups?.flatMap((row) => row.sequences).find((row) => row.ref === ref);
        return before && before.uuid === sequence.uuid && before.name === sequence.name ? before : Object.freeze({ ref, uuid: sequence.uuid, name: sequence.name });
      });
      return previous && previous.name === group.name && arrayEq(previous.sequences, sequences) ? previous : Object.freeze({ name: group.name, sequences: Object.freeze(sequences) });
    });
    const next = { active: true, groups: previousGroups && arrayEq(previousGroups, projected) ? previousGroups : Object.freeze(projected),
      sequenceId: this.animation.sequence.uuid, duration: this.animation.duration, delay: this.animation.delay, timingFunction: this.animation.timingFunction,
      iterationCount: this.animation.iterationCount, direction: this.animation.direction, fillMode: this.animation.fillMode };
    const previous = this.current;
    if (!previous || previous.groups !== next.groups || previous.sequenceId !== next.sequenceId || previous.duration !== next.duration || previous.delay !== next.delay || previous.timingFunction !== next.timingFunction || previous.iterationCount !== next.iterationCount || previous.direction !== next.direction || previous.fillMode !== next.fillMode) {
      this.current = Object.freeze(next);
    }
    this.captured = new Map([...used].map((field) => [field, field.getState()]));
    this.hostless = this.studio.appCtx.appConfig.hostLessComponents;
    if (this.connected) {
      for (const field of used) {
        if (!this.fields.has(field)) { this.fields.set(field, { prepare: models.subscribePreparedField(field, this.invalidate), publish: field.subscribe(this.publish) }); }
      }
      for (const [field, stops] of this.fields) { if (!used.has(field)) { stops.prepare(); stops.publish(); this.fields.delete(field); } }
    }
    this.dirty = false;
    return ensure(this.current, "Animation inputs must be installed");
  };
  subscribe = (listener: () => void) => {
    if (this.isClosed()) { return () => undefined; }
    this.listeners.add(listener);
    if (!this.connected) {
      this.connected = true; this.scope.lifetime.addEventListener("abort", this.close, { once: true });
      this.stopApp = this.studio.appCtx.subscribeUiEnvironmentInputs(() => { this.invalidate(); this.publish(); });
      this.invalidate(); this.publish();
    }
    let stopped = false;
    return () => { if (stopped) { return; } stopped = true; this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } };
  };
  sequence(uuid: string) {
    assert(!this.isClosed(), "Cannot select from a closed animation owner");
    const row = ensure(this.getSnapshot(), "Active animation inputs must exist").groups.flatMap((group) => group.sequences).find((sequence) => sequence.uuid === uuid);
    return row ? this.scope.models.resolve(row.ref) : undefined;
  }
}

export function useAnimationControlInputs(studio: StudioCtx, animation: Animation) {
  const source = React.useMemo(() => new AnimationControlInputs(studio, animation), [studio, animation]);
  const snapshot = React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  return { snapshot, sequence: (uuid: string) => source.sequence(uuid) };
}
