/**
 * Finite component-property folder inputs for the sidebar tree.
 *
 * The persisted Component/Param/Var models remain the source of truth. This
 * client-side input source exposes stable ModelRefs and folder strings and
 * delegates folder construction/reordering to the shared pure helper.
 */
import type {
  ModelRef,
  ModelSnapshots,
} from "@/wab/client/studio-ctx/model-snapshots";
import { assert } from "@/wab/shared/common";
import { formatParamDisplayName } from "@/wab/shared/core/components";
import { walkDependencyTree } from "@/wab/shared/core/project-deps";
import {
  createFolderTreeStructure,
  isFolder,
  type Folder,
} from "@/wab/shared/folders/folders-util";
import type { Component, Param, Site, Var } from "@/wab/shared/model/classes";
import * as React from "react";

export type PropTreeLeafInput = { kind: "param"; param: ModelRef<Param> };
export type PropTreeFolderInput = {
  kind: "folder";
  name: string;
  path: string;
  children: readonly PropTreeInputNode[];
};
export type PropTreeInputNode = PropTreeLeafInput | PropTreeFolderInput;

type ParamItem = { param: ModelRef<Param>; name: string };
type VarNameBinding = {
  ref: ModelRef<Var>;
  stops: (() => void)[];
};

const EMPTY_TREE: readonly PropTreeInputNode[] = Object.freeze([]);

function isComponentInScope(site: Site, component: Component) {
  return (
    site.components.includes(component) ||
    walkDependencyTree(site, "all").some((dep) =>
      dep.site.components.includes(component),
    )
  );
}

export class PropTreeInputs {
  private readonly preparedStops = new Set<() => void>();
  private readonly publicStops = new Set<() => void>();
  private readonly paramStops = new Set<() => void>();
  private readonly paramPreparedStops = new Set<() => void>();
  private readonly varNameStops = new Map<number, VarNameBinding>();
  private readonly listeners = new Set<() => void>();
  private current: readonly PropTreeInputNode[] = EMPTY_TREE;
  private currentKey = "";
  private params: readonly Param[] = [];
  private connected = false;
  private terminal = false;
  private disposed = false;
  private pendingPublish = false;
  private sharedNodes = new Map<string, PropTreeInputNode>();

  constructor(
    readonly models: ModelSnapshots,
    private readonly component: Component,
    site: Site,
    initialParams: readonly Param[],
    private readonly ownerIsCurrent: () => boolean,
    baseline?: PropTreeInputs,
  ) {
    assert(
      isComponentInScope(site, component),
      "Prop tree inputs require a component in the captured site/dependency roster",
    );
    this.params = Object.freeze([...initialParams]);
    this.current = this.compute(baseline?.sharedNodes);
  }

  get isDisposed() {
    return this.disposed;
  }

  get isTerminal() {
    return this.terminal;
  }

  matchesParams(params: readonly Param[]) {
    return (
      this.params.length === params.length &&
      this.params.every(
        (param, index) =>
          param === params[index] && param.uid === params[index]?.uid,
      )
    );
  }

  canCommit() {
    return !this.disposed && !this.terminal && this.ownerIsCurrent();
  }

  getSnapshot = () => {
    if (!this.terminal && !this.disposed && !this.ownerIsCurrent()) {
      this.closeTerminal(false);
    }
    return this.current;
  };

  subscribe = (listener: () => void) => {
    if (this.disposed || this.terminal) {
      return () => undefined;
    }
    if (!this.ownerIsCurrent()) {
      this.listeners.add(listener);
      this.closeTerminal(true);
      return () => this.listeners.delete(listener);
    }
    if (!this.connected) {
      this.connect();
      this.prepareTree();
    }
    this.listeners.add(listener);
    const stop = () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.disconnect();
      }
    };
    return stop;
  };

  /** Active-world params; stale worlds close terminal without resolving refs. */
  setParams(
    params: readonly Param[],
    notify = true,
    connectIfConnected = false,
  ) {
    if (this.disposed || this.terminal) {
      return;
    }
    if (!this.ownerIsCurrent()) {
      this.closeTerminal(notify);
      return;
    }
    if (this.matchesParams(params)) {
      return;
    }
    this.params = Object.freeze([...params]);
    if (connectIfConnected && this.connected) {
      this.connectParams();
    }
    const next = this.compute();
    if (next !== this.current) {
      this.current = next;
      this.pendingPublish = true;
    }
  }

  /** Commit-safe roster installation: connect new finite fields after commit. */
  commitParams() {
    if (this.disposed || this.terminal || !this.connected) {
      return;
    }
    this.connectParams();
    this.prepareTree();
  }

  /** Publish a tree already installed by render/param preparation. */
  publishPending() {
    this.publishTree();
  }

  dispose() {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.disconnect();
    this.listeners.clear();
    this.current = EMPTY_TREE;
    this.currentKey = "";
    this.pendingPublish = false;
    this.sharedNodes.clear();
  }

  private closeTerminal(notify: boolean) {
    if (this.terminal || this.disposed) {
      return;
    }
    this.terminal = true;
    this.disconnect();
    this.current = EMPTY_TREE;
    this.currentKey = "";
    this.pendingPublish = false;
    this.sharedNodes.clear();
    if (notify) {
      for (const listener of this.listeners) {
        listener();
      }
    } else {
      queueMicrotask(() => {
        for (const listener of this.listeners) {
          listener();
        }
      });
    }
  }

  private trackField(
    store: ReturnType<ModelSnapshots["declaredField"]>,
  ) {
    this.preparedStops.add(
      this.models.subscribePreparedField(store, () => this.prepareTree()),
    );
    this.publicStops.add(store.subscribe(() => this.publishTree()));
  }

  private connect() {
    this.connected = true;
    this.trackField(
      this.models.declaredField(this.component, "codeComponentMeta"),
    );
    this.connectParams();
  }

  private disconnect() {
    if (!this.connected) {
      return;
    }
    this.connected = false;
    for (const stop of this.preparedStops) {
      stop();
    }
    for (const stop of this.publicStops) {
      stop();
    }
    for (const stop of this.paramStops) {
      stop();
    }
    for (const stop of this.paramPreparedStops) {
      stop();
    }
    for (const binding of this.varNameStops.values()) {
      binding.stops.forEach((stop) => stop());
    }
    this.preparedStops.clear();
    this.publicStops.clear();
    this.paramStops.clear();
    this.paramPreparedStops.clear();
    this.varNameStops.clear();
  }

  private connectParams() {
    for (const stop of this.paramStops) {
      stop();
    }
    for (const stop of this.paramPreparedStops) {
      stop();
    }
    this.paramStops.clear();
    this.paramPreparedStops.clear();
    for (const binding of this.varNameStops.values()) {
      binding.stops.forEach((stop) => stop());
    }
    this.varNameStops.clear();
    for (const param of this.params) {
      const displayNameStore = this.models.declaredField(
        param,
        "displayName",
      );
      this.paramPreparedStops.add(
        this.models.subscribePreparedField(displayNameStore, () =>
          this.prepareTree(),
        ),
      );
      this.paramStops.add(displayNameStore.subscribe(() => this.publishTree()));
      const variableStore = this.models.declaredField(param, "variable");
      this.paramPreparedStops.add(
        this.models.subscribePreparedField(variableStore, () =>
          this.prepareTree(),
        ),
      );
      this.paramStops.add(variableStore.subscribe(() => this.publishTree()));
      this.bindVarName(
        param,
        this.models.field(param, "variable").getState(),
      );
    }
  }

  private bindVarName(param: Param, variableRef: ModelRef<Var>) {
    const existing = this.varNameStops.get(param.uid);
    if (existing && existing.ref === variableRef) {
      return;
    }
    existing?.stops.forEach((stop) => stop());
    const nameStore = this.models.declaredField(
      this.models.resolve(variableRef),
      "name",
    );
    const stops = [
      this.models.subscribePreparedField(nameStore, () => this.prepareTree()),
      nameStore.subscribe(() => this.publishTree()),
    ];
    this.varNameStops.set(param.uid, { ref: variableRef, stops });
  }

  private rebindVariables() {
    for (const param of this.params) {
      const variableRef = this.models.field(param, "variable").getState();
      this.bindVarName(param, variableRef);
    }
  }

  private prepareTree() {
    if (this.disposed || this.terminal) {
      return;
    }
    this.rebindVariables();
    const next = this.compute();
    if (next !== this.current) {
      this.current = next;
      this.pendingPublish = true;
    }
  }

  private publishTree() {
    if (this.disposed || this.terminal || !this.pendingPublish) {
      return;
    }
    this.pendingPublish = false;
    for (const listener of this.listeners) {
      listener();
    }
  }

  private compute(previousNodes: ReadonlyMap<string, PropTreeInputNode> = this.sharedNodes): readonly PropTreeInputNode[] {
    const hasCodeComponentMeta = !!this.models
      .field(this.component, "codeComponentMeta")
      .getState();
    const items: ParamItem[] = this.params.map((param) => {
      const displayName = this.models.field(param, "displayName").getState();
      const variableRef = this.models.field(param, "variable").getState();
      const variable = this.models.resolve(variableRef);
      const variableName = this.models.field(variable, "name").getState();
      return {
        param: this.models.ref(param),
        name: formatParamDisplayName(
          displayName,
          variableName,
          hasCodeComponentMeta,
        ),
      };
    });
    const key = encodeParamItems(items);
    if (key === this.currentKey) {
      return this.current;
    }
    const rawTree = createFolderTreeStructure(items, {
      pathPrefix: "",
      getName: (item) => item.name,
      mapper: (item) => item,
    });
    const nextShared = new Map<string, PropTreeInputNode>();
    const convert = (
      item: ParamItem | Folder<ParamItem>,
    ): { key: string; node: PropTreeInputNode } => {
      if (isFolder(item)) {
        const children = item.items.map(convert);
        const nodeKey = encodeTuple([
          "folder",
          item.path,
          item.name,
          ...children.map((child) => child.key),
        ]);
        const existing = previousNodes.get(nodeKey);
        if (existing) {
          nextShared.set(nodeKey, existing);
          return { key: nodeKey, node: existing };
        }
        const node: PropTreeFolderInput = Object.freeze({
          kind: "folder",
          name: item.name,
          path: item.path,
          children: Object.freeze(children.map((child) => child.node)),
        });
        nextShared.set(nodeKey, node);
        return { key: nodeKey, node };
      }
      const nodeKey = encodeTuple(["param", item.param.uid, item.name]);
      const existing = previousNodes.get(nodeKey);
      if (existing) {
        nextShared.set(nodeKey, existing);
        return { key: nodeKey, node: existing };
      }
      const node: PropTreeLeafInput = Object.freeze({
        kind: "param",
        param: item.param,
      });
      nextShared.set(nodeKey, node);
      return { key: nodeKey, node };
    };
    const tree = rawTree.map((item) => convert(item).node);
    this.sharedNodes = nextShared;
    this.currentKey = key;
    return Object.freeze(tree);
  }
}

function encodeTuple(values: readonly (string | number)[]): string {
  return JSON.stringify(values);
}

function encodeParamItems(items: readonly ParamItem[]): string {
  return encodeTuple(
    items.flatMap((item) => [item.param.uid, item.name] as const),
  );
}

export function collectPropTreeParams(
  node: PropTreeInputNode,
): ModelRef<Param>[] {
  return node.kind === "param"
    ? [node.param]
    : node.children.flatMap(collectPropTreeParams);
}

export function usePropTreeInputs(
  studioCtx: { modelSnapshots: ModelSnapshots; site: Site },
  component: Component,
  params: readonly Param[],
) {
  const bindings = React.useRef(
    new WeakMap<
      typeof studioCtx,
      WeakMap<Component, PropTreeInputs>
    >(),
  );
  const modelWorld = studioCtx.modelSnapshots;
  const committed = (() => {
    let byComponent = bindings.current.get(studioCtx);
    if (!byComponent) {
      byComponent = new WeakMap();
      bindings.current.set(studioCtx, byComponent);
    }
    let found = byComponent.get(component);
    if (!found || found.isDisposed) {
      found = new PropTreeInputs(
        modelWorld,
        component,
        studioCtx.site,
        params,
        () => studioCtx.modelSnapshots === modelWorld,
      );
      byComponent.set(component, found);
    }
    return found;
  })();
  committed.getSnapshot();
  const paramKey = params.map((param) => param.uid).join("|");
  const candidate = React.useMemo(() => {
    if (
      committed.isTerminal ||
      committed.isDisposed ||
      committed.matchesParams(params)
    ) {
      return committed;
    }
    return new PropTreeInputs(
      modelWorld,
      component,
      studioCtx.site,
      params,
      () => studioCtx.modelSnapshots === modelWorld,
      committed,
    );
  }, [studioCtx, component, committed, params, paramKey, modelWorld]);
  React.useEffect(() => {
    if (candidate !== committed && candidate.canCommit()) {
      let byComponent = bindings.current.get(studioCtx);
      if (!byComponent) {
        byComponent = new WeakMap();
        bindings.current.set(studioCtx, byComponent);
      }
      byComponent.set(component, candidate);
    }
    candidate.commitParams();
    candidate.publishPending();
  }, [candidate, committed, studioCtx, component, paramKey, modelWorld]);
  const tree = React.useSyncExternalStore(
    candidate.subscribe,
    candidate.getSnapshot,
    candidate.getSnapshot,
  );
  return { models: candidate.models, tree };
}
