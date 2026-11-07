import type { CanvasRegistrations } from "@/wab/client/components/canvas/canvas-registrations";
import type { ModelFieldStore, ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { customFunctionId } from "@/wab/shared/core/query-ids";
import type { CanvasEnv } from "@/wab/shared/eval";
import type { ObjInst, Site } from "@/wab/shared/model/classes";
import { isEqual } from "lodash";
import { objsEq } from "@/wab/shared/common";
import { createStore } from "zustand/vanilla";

/** The committed $$ environment; library/function command handles retain identity. */
export class CanvasFunctionInputs {
  private readonly models: ModelSnapshots;
  private readonly state = createStore<CanvasEnv["$$"]>(() => Object.freeze({}));
  private current = this.state.getState();
  private readonly fields = new Map<ModelFieldStore<unknown>, () => void>();
  private readonly subscriptions = new Set<() => void>();
  private dirty = true;
  private disposed = false;
  private readonly stopRegistry: () => void;
  readonly store: ModelFieldStore<CanvasEnv["$$"]> = {
    getState: () => this.current,
    getInitialState: () => this.current,
    subscribe: (listener) => {
      if (this.disposed) { return () => undefined; }
      const unsubscribe = this.state.subscribe(listener);
      const stop = () => { unsubscribe(); this.subscriptions.delete(stop); };
      this.subscriptions.add(stop);
      return stop;
    },
  };

  constructor(private readonly view: ViewCtx, private readonly registry: CanvasRegistrations) {
    this.models = view.studioCtx.modelSnapshots;
    this.prepareCommit(); this.publishCommit();
    this.stopRegistry = registry.subscribeBeforePublish(() => {
      this.prepareCommit(true);
      return () => this.publishCommit();
    });
  }

  prepareCommit(registrationsChanged = false) {
    if (this.disposed || !this.dirty && !registrationsChanged) { return; }
    this.dirty = false;
    const fields = new Set<ModelFieldStore<unknown>>();
    const read = <T extends ObjInst, Key extends Exclude<keyof T, "uid"> & string>(model: T, key: Key) => {
      const store = this.models.field(model, key); fields.add(store); return store.getState();
    };
    const sites: Site[] = [this.view.site];
    const queuedIds = new Set<string>();
    const queue = [...read(this.view.site, "projectDependencies")].map((ref) => this.models.resolve(ref));
    queue.forEach((dependency) => queuedIds.add(read(dependency, "projectId")));
    for (let index = 0; index < queue.length; index++) {
      const site = this.models.resolve(read(queue[index], "site"));
      sites.push(site);
      for (const ref of read(site, "projectDependencies")) {
        const dependency = this.models.resolve(ref), id = read(dependency, "projectId");
        if (!queuedIds.has(id)) { queuedIds.add(id); queue.push(dependency); }
      }
    }
    const next: CanvasEnv["$$"] = {};
    const namespaces = new Map<string, Record<string, Function>>();
    const ids = new Set<string>();
    for (const site of sites) {
      for (const ref of read(site, "customFunctions")) {
        const fn = this.models.resolve(ref);
        const namespace = read(fn, "namespace"), importName = read(fn, "importName");
        const id = customFunctionId({ namespace, importName });
        if (ids.has(id)) { continue; }
        ids.add(id);
        const implementation = this.registry.function(id).getState()?.runtime.function;
        if (!implementation) { continue; }
        if (namespace) {
          let group = namespaces.get(namespace);
          if (!group) { group = {}; namespaces.set(namespace, group); }
          group[importName] = implementation;
        } else { next[importName] = implementation; }
      }
    }
    for (const [namespace, group] of namespaces) {
      next[namespace] = isEqual(this.current[namespace], group) ? this.current[namespace] : Object.freeze(group);
    }
    for (const name of this.registry.libraryNamesStore.getState()) {
      const library = this.registry.library(name).getState()?.runtime;
      if (library) { next[library.meta.jsIdentifier] = library.lib; }
    }
    for (const [field, stop] of this.fields) {
      if (!fields.has(field)) { stop(); this.fields.delete(field); }
    }
    for (const field of fields) {
      if (!this.fields.has(field)) { this.fields.set(field, this.models.subscribePreparedField(field, () => { this.dirty = true; })); }
    }
    if (!objsEq(this.current, next)) { this.current = Object.freeze(next); }
  }

  publishCommit() { if (!this.disposed) { this.state.setState(() => this.current, true); } }

  dispose() {
    this.disposed = true;
    this.stopRegistry();
    this.subscriptions.forEach((stop) => stop()); this.subscriptions.clear();
    this.fields.forEach((stop) => stop()); this.fields.clear();
    this.current = Object.freeze({}); this.state.setState(this.current, true);
  }
}
