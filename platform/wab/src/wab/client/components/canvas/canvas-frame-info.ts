import type { CanvasFrameInfo } from "@/wab/client/components/canvas/canvas-rendering";
import type { ModelFieldStore, ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { hasTokenRefs, isTokenRef, resolveToken, tryParseTokenRef } from "@/wab/commons/StyleToken";
import { assert, ensure } from "@/wab/shared/common";
import { walkDependencyTree } from "@/wab/shared/core/project-deps";
import { toFinalToken } from "@/wab/shared/core/tokens";
import type { ObjInst, Site } from "@/wab/shared/model/classes";
import { useMemo, useSyncExternalStore } from "react";
import { createStore, StoreApi } from "zustand/vanilla";

interface ViewInputs {
  readonly fullPageHeight: boolean;
  readonly interactive: boolean;
  readonly exporting: boolean;
}

/** One frame's committed render props, driven by declared fields and view commands. */
export class CanvasFrameInfoOwner {
  readonly store: ModelFieldStore<CanvasFrameInfo>;
  private readonly state: StoreApi<CanvasFrameInfo>;
  private current: CanvasFrameInfo;
  private readonly models: ModelSnapshots;
  private readonly fields = new Map<ModelFieldStore<unknown>, () => void>();
  private readonly subscriptions = new Set<() => void>();
  private readonly stopCommits: () => void;
  private viewInputs: ViewInputs;
  private dirty = true;
  private disposed = false;

  constructor(readonly viewCtx: ViewCtx) {
    this.models = viewCtx.studioCtx.modelSnapshots;
    this.viewInputs = this.readViewInputs();
    const state = this.state = createStore(() => this.capture(this.viewInputs));
    this.current = state.getState();
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
    this.stopCommits = viewCtx.studioCtx.subscribeModelChanges((event) => {
      if (event.type === "site-replaced") {
        this.dispose();
        return;
      }
      const input = this.readViewInputs();
      if (this.dirty || input.fullPageHeight !== this.viewInputs.fullPageHeight ||
          input.interactive !== this.viewInputs.interactive || input.exporting !== this.viewInputs.exporting) {
        this.prepare()();
      }
    });
  }

  /** View commands may run inside a transaction; publish only its completed values. */
  sync() {
    if (this.disposed) {
      return;
    }
    this.dirty = true;
    if (!this.viewCtx.studioCtx.hasPendingModelChanges()) {
      this.prepare()();
    }
  }

  private readViewInputs(): ViewInputs {
    return {
      fullPageHeight: this.viewCtx.studioCtx.renderPolicy.store.getState().fullPageHeight,
      interactive: this.viewCtx.studioCtx.renderPolicy.store.getState().interactive,
      exporting: this.viewCtx.canvasExporting,
    };
  }

  /** Install the complete output before any policy/cache/frame subscriber runs. */
  prepare(): () => void {
    if (this.disposed) { return () => undefined; }
    const input = this.readViewInputs();
    if (this.dirty || input.fullPageHeight !== this.viewInputs.fullPageHeight ||
        input.interactive !== this.viewInputs.interactive || input.exporting !== this.viewInputs.exporting) {
      const next = this.capture(input);
      this.viewInputs = input;
      const equal = (left: CanvasFrameInfo, right: CanvasFrameInfo) => left.viewMode === right.viewMode && left.height === right.height &&
        left.isHeightAutoDerived === right.isHeightAutoDerived && left.fullPageHeight === right.fullPageHeight && left.bgColor === right.bgColor && left.exporting === right.exporting;
      const published = this.state.getState();
      if (equal(published, next)) { this.current = published; }
      else if (!equal(this.current, next)) { this.current = next; }
    }
    return () => {
      if (!this.disposed && this.state.getState() !== this.current) {
        this.state.setState(this.current, true);
      }
    };
  }

  private capture(input: ViewInputs): CanvasFrameInfo {
    const sources = new Set<ModelFieldStore<unknown>>();
    const read = <T extends ObjInst, Key extends Exclude<keyof T, "uid"> & string>(model: T, key: Key) => {
      const store = this.models.field(model, key);
      sources.add(store);
      return store.getState();
    };
    const frame = this.viewCtx.arenaFrame();
    const viewMode = read(frame, "viewMode");
    assert(viewMode === "centered" || viewMode === "stretch", "Invalid canvas frame view mode");
    const height = read(frame, "height");
    const container = this.models.resolve(read(frame, "container"));
    const component = this.models.resolve(read(container, "component"));
    const componentType = read(component, "type");
    const derived = componentType === "page" || (componentType === "plain" && viewMode === "stretch");
    const background = read(frame, "bgColor");
    let bgColor: string | undefined = background || undefined;
    if (background && hasTokenRefs(background)) {
      const site = this.viewCtx.site;
      const dependencies = walkDependencyTree(site, "all");
      const sites: Site[] = [site];
      for (const dependency of dependencies) {
        read(dependency, "projectId");
        sites.push(this.models.resolve(read(dependency, "site")));
      }
      const tokens = sites.flatMap((owner) => {
        read(owner, "projectDependencies");
        return read(owner, "styleTokens").map((ref) => this.models.resolve(ref));
      });
      for (const ref of read(site, "styleTokenOverrides")) {
        read(this.models.resolve(ref), "token");
      }
      const finalTokens = tokens.map((token) => toFinalToken(token, site));
      const first = tryParseTokenRef(background, finalTokens);
      const seen = new Set<ObjInst>();
      let current = first;
      while (current && !seen.has(current.base)) {
        seen.add(current.base);
        read(current.base, "value");
        read(current.base, "isRegistered");
        const override = current.override;
        if (override) {
          read(override, "value");
        }
        current = isTokenRef(current.value) ? tryParseTokenRef(current.value, finalTokens) : undefined;
      }
      if (first) {
        bgColor = resolveToken(finalTokens, first).value;
      }
    }
    for (const [field, stop] of this.fields) {
      if (!sources.has(field)) {
        stop(); this.fields.delete(field);
      }
    }
    for (const field of sources) {
      if (!this.fields.has(field)) {
        this.fields.set(field, this.models.subscribePreparedField(field, () => { this.dirty = true; }));
      }
    }
    this.dirty = false;
    return Object.freeze({
      viewMode, height, isHeightAutoDerived: derived, exporting: input.exporting,
      fullPageHeight: input.fullPageHeight && derived && !input.interactive && !input.exporting,
      bgColor,
    });
  }

  dispose() {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.stopCommits();
    this.fields.forEach((stop) => stop()); this.fields.clear();
    this.subscriptions.forEach((stop) => stop()); this.subscriptions.clear();
  }
}


const noFrameSubscription = () => () => undefined;
/** Exact native export input for Studio UI; no view is a legitimate empty scope. */
export function useCanvasExporting(view: ViewCtx | undefined) {
  const source = useMemo(() => view ? ensure(view.canvasCtx.frameInfo(view), "Active canvas view requires frame inputs") : undefined, [view]);
  const read = () => source ? source.getState().exporting : false;
  return useSyncExternalStore(source ? source.subscribe : noFrameSubscription, read, read);
}
