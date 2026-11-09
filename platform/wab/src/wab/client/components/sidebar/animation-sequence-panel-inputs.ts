import type { ModelFieldStore, ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { arrayEq } from "@/wab/shared/common";
import { flattenComponent } from "@/wab/shared/cached-selectors";
import { isTplTag, isTplSlot, isTplComponent } from "@/wab/shared/core/tpls";
import { AnimationSequence, ObjInst, Site, isKnownRenderExpr } from "@/wab/shared/model/classes";
import * as React from "react";

const empty: readonly unknown[] = Object.freeze([]);
let nextKey = 0;
/** Directory labels and, only while open, the exact animation-reference graph. */
export class AnimationSequencePanelInputs {
  readonly key = ++nextKey;
  private readonly models: ModelSnapshots;
  private readonly site: Site;
  private readonly lifetime: AbortSignal;
  private current = empty;
  private published = empty;
  private dirty = true;
  private connected = false;
  private readonly fields = new Map<ModelFieldStore<unknown>, { prepare: () => void; stop: () => void }>();
  private readonly listeners = new Set<() => void>();
  constructor(private readonly studio: StudioCtx, private readonly input: { kind: "catalog" } | { kind: "usage"; sequence: AnimationSequence | undefined }) {
    this.models = studio.modelSnapshots; this.site = studio.site; this.lifetime = studio.arenaState.lifetime();
  }
  isActive = () => !this.lifetime.aborted && this.models === this.studio.modelSnapshots && this.site === this.studio.site;
  private disconnect = () => { this.connected = false; this.lifetime.removeEventListener("abort", this.close); this.fields.forEach(({ prepare, stop }) => { prepare(); stop(); }); this.fields.clear(); };
  private close = () => { this.current = empty; this.disconnect(); this.publishSnapshot(); this.listeners.clear(); };
  private invalidate = () => { this.dirty = true; };
  private publishSnapshot = () => { if (this.current !== this.published) { this.published = this.current; this.listeners.forEach((listener) => listener()); } };
  private publish = () => { this.getSnapshot(); this.publishSnapshot(); };
  getSnapshot = (): readonly unknown[] => {
    if (!this.isActive()) { return empty; }
    if (this.connected && !this.dirty) { return this.current; }
    const used = new Set<ModelFieldStore<unknown>>();
    const field = (model: ObjInst, ...keys: string[]) => keys.forEach((key) => used.add(this.models.declaredField(model, key)));
    if (this.input.kind === "catalog") {
      field(this.site, "animationSequences", "projectDependencies");
      const sites = [this.site, ...this.site.projectDependencies.map((dependency) => {
        field(dependency, "uuid", "name", "projectId", "site"); field(dependency.site, "animationSequences", "hostLessPackageInfo"); return dependency.site;
      })];
      sites.forEach((site) => site.animationSequences.forEach((sequence) => field(sequence, "uuid", "name")));
    } else if (this.input.sequence) {
      field(this.input.sequence, "name"); field(this.site, "components", "arenas");
      this.site.components.forEach((component) => {
        field(component, "type", "tplTree");
        flattenComponent(component).forEach((tpl) => {
          field(tpl, "vsettings");
          if (isTplTag(tpl)) { field(tpl, "children"); }
          if (isTplSlot(tpl)) { field(tpl, "defaultContents"); }
          tpl.vsettings.forEach((setting) => {
            field(setting, "rs"); field(setting.rs, "animations"); setting.rs.animations?.forEach((animation) => field(animation, "sequence"));
            if (isTplComponent(tpl)) { field(setting, "args"); setting.args.forEach((arg) => { field(arg, "expr"); if (isKnownRenderExpr(arg.expr)) { field(arg.expr, "tpl"); } }); }
          });
        });
      });
      this.site.arenas.forEach((arena) => { field(arena, "children"); arena.children.forEach((frame) => { field(frame, "container"); field(frame.container, "component"); }); });
    }
    const values = [...used].map((store) => store.getState());
    if (!arrayEq(this.current, values)) { this.current = Object.freeze(values); }
    if (this.connected) {
      for (const store of used) { if (!this.fields.has(store)) { this.fields.set(store, { prepare: this.models.subscribePreparedField(store, this.invalidate), stop: store.subscribe(this.publish) }); } }
      for (const [store, binding] of this.fields) { if (!used.has(store)) { binding.prepare(); binding.stop(); this.fields.delete(store); } }
    }
    this.dirty = false; return this.current;
  };
  subscribe = (listener: () => void) => {
    if (!this.isActive()) { return () => undefined; } this.listeners.add(listener);
    if (!this.connected) { this.connected = true; this.dirty = true; this.lifetime.addEventListener("abort", this.close, { once: true }); this.publish(); }
    return () => { this.listeners.delete(listener); if (!this.listeners.size) { this.disconnect(); } };
  };
}

export function useAnimationSequenceCatalog(studio: StudioCtx) {
  const subscribe = React.useCallback((listener: () => void) => studio.subscribeModelChanges((event) => { if (event.type === "site-replaced") { listener(); } }), [studio]);
  const read = React.useCallback(() => studio.modelSnapshots, [studio]);
  const models = React.useSyncExternalStore(subscribe, read, read), lifetime = studio.arenaState.lifetime();
  const source = React.useMemo(() => new AnimationSequencePanelInputs(studio, { kind: "catalog" }), [studio, models, studio.site, lifetime]);
  React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot); return source;
}
export function useAnimationSequenceUsage(studio: StudioCtx, sequence: AnimationSequence | undefined) {
  const source = React.useMemo(() => new AnimationSequencePanelInputs(studio, { kind: "usage", sequence }), [studio, sequence]);
  React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
}
