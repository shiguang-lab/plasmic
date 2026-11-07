import type { CanvasModelInputs } from "@/wab/client/components/canvas/canvas-model-inputs";
import type { ModelFieldStore, ModelRef, ModelSnapshot, ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { ContextFactory } from "@/wab/shared/code-components/context-factory";
import type { Site, TplNode } from "@/wab/shared/model/classes";
import { createStore, StoreApi } from "zustand/vanilla";

export interface CanvasGlobalRoot {
  readonly root: ModelRef<TplNode>;
  readonly flags: ModelSnapshot<Site["flags"]>;
}

/** Produces provider clones at the committed model boundary, never during React rendering. */
export class CanvasGlobalContexts {
  readonly store: ModelFieldStore<CanvasGlobalRoot>;
  private readonly models: ModelSnapshots;
  private readonly factory: ContextFactory;
  private readonly subscriptions = new Set<() => void>();
  private readonly state: StoreApi<CanvasGlobalRoot>;
  private current: CanvasGlobalRoot;
  private sources: readonly unknown[] = [];
  private changed = false;
  private disposed = false;

  constructor(private readonly view: ViewCtx, private readonly modelInputs: CanvasModelInputs) {
    this.models = view.studioCtx.modelSnapshots;
    this.factory = new ContextFactory(view.site);
    this.current = Object.freeze({ root: this.models.ref(view.componentArgsContainer()), flags: this.models.field(view.site, "flags").getState() });
    this.prepareCommit();
    const state = this.state = createStore(() => this.current);
    this.changed = false;
    this.store = {
      getState: () => this.current,
      getInitialState: state.getInitialState,
      subscribe: (listener) => {
        if (this.disposed) {
          return () => undefined;
        }
        const unsubscribe = state.subscribe(listener);
        const stop = () => { unsubscribe(); this.subscriptions.delete(stop); };
        this.subscriptions.add(stop);
        return stop;
      },
    };
  }

  /** Source capsules are captured before this step; runtime clone fields are installed here. */
  prepareCommit() {
    if (this.disposed) {
      return;
    }
    const root = this.models.field(this.view.arenaFrame(), "container").getState();
    const contexts = this.models.field(this.view.site, "globalContexts").getState();
    const flags = this.models.field(this.view.site, "flags").getState();
    const providers = contexts.map((ref) => this.models.resolve(ref));
    const sources = [root, contexts, flags, ...providers.map((provider) => this.modelInputs.node(provider).getState())];
    if (sources.length === this.sources.length && sources.every((value, index) => Object.is(value, this.sources[index]))) {
      return;
    }
    this.sources = sources;
    const update = this.factory.wrap(this.models.resolve(root), providers);
    this.models.sync(update.changes);
    const next = this.models.ref(update.root);
    if (next !== this.current.root || flags !== this.current.flags) {
      this.current = Object.freeze({ root: next, flags });
      this.changed = true;
    }
  }

  publishCommit() {
    if (!this.disposed && this.changed) {
      this.changed = false;
      this.state.setState(this.current, true);
    }
  }

  dispose() {
    this.disposed = true;
    this.subscriptions.forEach((stop) => stop()); this.subscriptions.clear();
    this.factory.dispose(); this.sources = [];
  }
}
