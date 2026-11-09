import type { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { isValComponent } from "@/wab/shared/core/val-nodes";
import { isCodeComponent } from "@/wab/shared/core/components";
import { canvasNodePolicy, type CanvasNodePolicy } from "@/wab/client/components/canvas/canvas-render-policy";
import type { StudioRenderPolicySnapshot } from "@/wab/client/studio-ctx/studio-render-policy";
import { CanvasDataTokenInputs } from "@/wab/client/components/canvas/canvas-data-token-inputs";
import {
  RenderingCtx, computeCanvasSessionKey, computeFullKey,
} from "@/wab/client/components/canvas/canvas-rendering";
import { CanvasGlobalContexts } from "@/wab/client/components/canvas/canvas-global-contexts";
import { CanvasFunctionInputs } from "@/wab/client/components/canvas/canvas-function-inputs";
import { CanvasVariantInputs } from "@/wab/client/components/canvas/canvas-variant-inputs";
import type { CanvasRegistrations } from "@/wab/client/components/canvas/canvas-registrations";
import { CanvasSelectionInputs } from "@/wab/client/components/canvas/canvas-selection-inputs";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { CanvasModelInputs } from "@/wab/client/components/canvas/canvas-model-inputs";
import { canvasSessionInstanceKey, CanvasSessionState } from "@/wab/client/components/canvas/canvas-session-state";
import { DeepMap } from "@/wab/commons/deep-map";
import { ReactHookSpec } from "@/wab/shared/codegen/react-p/react-hook-spec";
import {
  Full,
  arrayEq,
  assert,
  ensure,
  isLiteralObjectByName,
  objsEq,
} from "@/wab/shared/common";
import { StatefulQueryResult } from "@/wab/shared/core/custom-functions";
import { CanvasEnv } from "@/wab/shared/eval";
import { Component, TplNode, isKnownComponent, isKnownTplComponent, isKnownTplSlot } from "@/wab/shared/model/classes";
import { isEqual, uniq } from "lodash";
import type { CanvasObserverInput } from "@/wab/client/components/canvas/canvas-observer";

const emptyObserverSnapshot: readonly unknown[] = Object.freeze([]);
const inactiveObserverInput: CanvasObserverInput = { getState: () => emptyObserverSnapshot, subscribe: () => () => undefined };

export function reactHookSpecsToKey(reactHookSpecs: ReactHookSpec[]) {
  return JSON.stringify(
    uniq(reactHookSpecs.map((spec) => spec.hookName)).sort(),
  );
}

function computeHashFromStableFields(node: TplNode, ctx: RenderingCtx) {
  return [
    ctx.sub,
    // ctx.viewCtx, // `viewCtx` can't change if ctx.sub hasn't changed
    // ctx.site, // `site` can't change if ctx.sub hasn't changed
    node,
    ctx.valKey,
    ctx.renderSlotInstance,
    ctx.ownerKey,
    JSON.stringify(ctx.ownersStack),
    ctx.rootClassName,
    ctx.ownerComponent,
    ctx.nodeNamer,
    ctx.projectFlags,
    ctx.dataTokenDefinitions,
    isKnownTplComponent(node) && isCodeComponent(node.component) ? ctx.viewCtx.contentEditor.isExpanded(computeFullKey(ctx)) : undefined,
    ctx.setDollarQueries,
    ctx.setDollarQ,
    JSON.stringify([...ctx.activeVariants.keys()].map((v) => v.uuid).sort()),
    isKnownTplSlot(node) ? !!ctx.forceValComponentKeysWithDefaultSlotContents?.has(ctx.ownerKey ?? "") : undefined,
    ctx.inline,
    ctx.slate,
    reactHookSpecsToKey(ctx.reactHookSpecs),
    // ctx.triggers, // `triggers` keys can't change if `reactHookSpecs` hasn't changed
    JSON.stringify(ctx.$ccVariants),
    ctx.updateVariant,
    ctx.registerRef,
    ctx.getRefs,
    JSON.stringify([...(ctx.pinnedVariants ?? [])].map((variant) => variant.uuid).sort()),
    ctx.onRenderInvalidated,
    ctx.viewCtx.disabledAutoOpenUuid,
  ];
}

// We use this type to force a type error whenever a new field is added
// to RenderingCtx to make sure the hash will be updated properly
type HandledCtxFields =
  | "valKey"
  | "renderSlotInstance"
  | "sub"
  | "viewCtx"
  | "site"
  | "rootClassName"
  | "nodeNamer"
  | "ownerComponent"
  | "ownerKey"
  | "ownersStack"
  | "activeVariants"
  | "forceValComponentKeysWithDefaultSlotContents"
  | "inline"
  | "slate"
  | "projectFlags"
  | "dataTokenDefinitions"
  | "setDollarQueries"
  | "setDollarQ"
  | "reactHookSpecs"
  | "triggers"
  | "$ccVariants"
  | "updateVariant"
  | "onRenderInvalidated"
  | "registerRef"
  | "getRefs"
  | "pinnedVariants"
  // Output metadata is replayed from each cached node into the current owner.
  | "stateInitializers";

type RecordSnapshot = ReadonlyMap<string, unknown>;
interface CanvasEnvSnapshot {
  readonly locals: RecordSnapshot;
  readonly context: RecordSnapshot;
  readonly props: RecordSnapshot;
  readonly queries: RecordSnapshot;
  readonly serverQueries: RecordSnapshot;
}

type NonStableFieldsFromCtx = Omit<Full<RenderingCtx>, HandledCtxFields | "env" | "wrappingEnv"> & {
  env: CanvasEnvSnapshot;
  wrappingEnv: CanvasEnvSnapshot;
  $stateSnapshot: Record<string, any>;
};

function snapshotCanvasEnv(env: CanvasEnv): CanvasEnvSnapshot {
  // These snapshots are private comparison inputs, never expression/runtime
  // environments. Preserve own enumerable string keys, including __proto__ and
  // explicit undefined; opaque symbol command metadata is not a render input.
  const locals = new Map(Object.entries(env));
  locals.delete("$ctx");
  locals.delete("$props");
  locals.delete("$state");
  locals.delete("$queries");
  locals.delete("$q");
  return {
      locals,
      context: new Map(Object.entries(env.$ctx)),
      props: new Map(Object.entries(env.$props)),
      queries: new Map(Object.entries(env.$queries)),
      // Snapshot the current state of each StatefulQueryResult so record comparison
      // detects changes. This is decoupled from the data picker's unwrap representation,
      // which collapses initial/loading to the same { data: undefined, error: undefined }.
      serverQueries: new Map(
        Object.entries(env.$q).map(
          ([k, v]: [string, StatefulQueryResult]) => [k, v.current],
        ),
      ),
  };
}

function computeNonStableFields(ctx: RenderingCtx): NonStableFieldsFromCtx {
  const env = snapshotCanvasEnv(ctx.env);
  return {
    env,
    // The common non-repeated scope uses one environment for both fields.
    // Capture it once per comparison, preserving a separate snapshot whenever
    // a slot or repeated child has a distinct wrapping environment.
    wrappingEnv: ctx.wrappingEnv === ctx.env ? env : snapshotCanvasEnv(ctx.wrappingEnv),
    overrides: ctx.overrides,
    $stateSnapshot: ctx.$stateSnapshot,
    plasmicInvalidate: ctx.plasmicInvalidate,
    // Canvas state initialization already has an explicit source hash. Retain
    // callbacks without a hash, and always retain onMutate's actual identity.
    stateSpecs: ctx.stateSpecs.map(({ initFunc, ...spec }) => ({
      ...spec, ...(spec.initFuncHash === undefined ? { initFunc } : {}),
    })),
    triggerProps: Object.fromEntries(Object.entries(ctx.triggerProps).map(([key, props]) => [key, {
      ...props, ...(props.style ? { style: { ...props.style } } : {}),
    }])),
  };
}

function compareVals(a: any, b: any) {
  if (a === b) {
    // Fast path for identity
    return true;
  }
  if (isLiteralObjectByName(a) && isLiteralObjectByName(b)) {
    return objsEq(a, b);
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return arrayEq(a, b);
  }
  return a === b;
}

// eslint-disable-next-line @typescript-eslint/ban-types
function oneLevelDeepComparison(a: Object, b: Object) {
  // Minimizing object allocations during this comparison
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) {
    return false;
  }
  for (const key of aKeys) {
    if (!(key in b)) {
      return false;
    }
    if (!compareVals(a[key], b[key])) {
      return false;
    }
  }
  return true;
}

/**
 * Since all elements from the same component will have the
 * same $state snapshot, we remember results of prior
 * comparisons here
 */
function cachedEquiv<F extends (x: any, y: any) => boolean>(isEquiv: F) {
  const seenComparisons: WeakMap<any, WeakMap<any, boolean>> = new WeakMap();
  return ((a: any, b: any) => {
    let aComps = seenComparisons.get(a);
    if (!aComps) {
      aComps = new WeakMap();
      seenComparisons.set(a, aComps);
    }
    let bResult = aComps.get(b);
    if (bResult != null) {
      // Cache hit!
      return bResult;
    } else {
      bResult = isEquiv(a, b);
      aComps.set(b, bResult);
      return bResult;
    }
  }) as F;
}

const areStateSnapshotsEquiv = cachedEquiv(
  (a: Record<string, any>, b: Record<string, any>) => {
    return isEqual(a, b);
  },
);

const areRecordSnapshotsEquiv = cachedEquiv((a: RecordSnapshot, b: RecordSnapshot) => {
  if (a.size !== b.size) { return false; }
  for (const [key, value] of a) {
    if (!b.has(key) || !compareVals(value, b.get(key))) { return false; }
  }
  return true;
});

const areCanvasEnvsEquiv = cachedEquiv((a: CanvasEnvSnapshot, b: CanvasEnvSnapshot) => {
  if (!areRecordSnapshotsEquiv(a.context, b.context)) {
    return false;
  }
  if (!areRecordSnapshotsEquiv(a.props, b.props)) {
    return false;
  }

  if (!areRecordSnapshotsEquiv(a.queries, b.queries)) {
    return false;
  }
  if (!areRecordSnapshotsEquiv(a.serverQueries, b.serverQueries)) {
    return false;
  }
  if (!areRecordSnapshotsEquiv(a.locals, b.locals)) {
    return false;
  }
  return true;
});

const areOverridesEquiv = cachedEquiv(
  (a: Record<string, any>, b: Record<string, any>) => {
    // TODO: Probably need one more level of comparison for overrides
    return oneLevelDeepComparison(a, b);
  },
);

function areNonStableFieldsEquiv(
  a: NonStableFieldsFromCtx,
  b: NonStableFieldsFromCtx,
) {
  if (!areCanvasEnvsEquiv(a.env, b.env)) {
    return false;
  }
  if (!areStateSnapshotsEquiv(a.$stateSnapshot, b.$stateSnapshot)) {
    return false;
  }
  if (!areOverridesEquiv(a.overrides, b.overrides)) {
    return false;
  }
  if (!areCanvasEnvsEquiv(a.wrappingEnv, b.wrappingEnv) ||
      a.plasmicInvalidate !== b.plasmicInvalidate ||
      !isEqual(a.stateSpecs, b.stateSpecs) || !isEqual(a.triggerProps, b.triggerProps)) {
    return false;
  }
  return true;
}

type RenderEntries = [NonStableFieldsFromCtx, { readonly value: unknown }][];
interface ContextInputs {
  readonly ownerIsCurrent: boolean;
  readonly nodeIsCurrent: boolean;
  readonly inComponentStack: boolean;
  readonly ownerEditable: boolean;
  readonly ownerInStack: boolean;
  readonly parentOwnerInStack: boolean;
  readonly focusedSlotUid: number | undefined;
  readonly defaultSlotContext: string | undefined;
}

function contextInputs(node: TplNode, ctx: RenderingCtx): ContextInputs {
  const view = ctx.viewCtx;
  const stack = view.valComponentStack().map((value) => value.key);
  const current = view.currentComponent();
  const selection = view.selectionStore.getState();
  const target = selection.targets[0];
  return {
    ownerIsCurrent: ctx.ownerComponent === current,
    nodeIsCurrent: isKnownTplComponent(node) && node.component === current,
    inComponentStack: view.componentStackFrames().some((frame) => frame.tplComponent === node),
    ownerEditable: ctx.ownerKey == null || stack.length === 0 || ctx.ownerKey === stack[stack.length - 1],
    ownerInStack: !!ctx.ownerKey && stack.includes(ctx.ownerKey),
    parentOwnerInStack: ctx.ownersStack.length > 1 && stack.includes(ctx.ownersStack[ctx.ownersStack.length - 2]),
    focusedSlotUid: target?.kind === "slot" && target.key?.startsWith(`${ctx.valKey}~`) ? target.slotParam?.uid : undefined,
    defaultSlotContext: !ctx.ownerKey && view.showDefaultSlotContents() ? selection.context?.valKey : undefined,
  };
}

export interface CanvasRenderPass {
  readonly listener: () => void;
  readonly instances: Set<string>;
  readonly environments: Set<string>;
  readonly previous: CanvasRenderPass | undefined;
}
interface InstanceCache {
  readonly fullKey: string;
  readonly renderSlotInstance?: string;
  readonly environmentIds: Set<string>;
  cache: DeepMap<RenderEntries>;
  readonly listeners: Set<() => void>;
  stopModelInputs: () => void;
  node: TplNode;
  ctx: RenderingCtx;
  context: ContextInputs;
  policy: CanvasNodePolicy;
  contentEditingExpanded: boolean;
  exporting: boolean | undefined;
  visibilityUsesExport: boolean;
}

/** One artboard's retained renders. Session changes invalidate only their tree path. */
export class CanvasRenderOwner {
  private readonly instances = new Map<string, InstanceCache>();
  private readonly stopSession: () => void;
  private disposed = false;
  private readonly lifetimeController = new AbortController();
  readonly lifetime = this.lifetimeController.signal;
  get isDisposed() { return this.disposed; }
  private inputModels: ModelSnapshots | undefined;
  private modelInputs: CanvasModelInputs | undefined;
  private selectionInputs: CanvasSelectionInputs | undefined;
  private globalContexts: CanvasGlobalContexts | undefined;
  private functions: CanvasFunctionInputs | undefined;
  private dataTokens: CanvasDataTokenInputs | undefined;
  private readonly dataTokenConsumers = new Map<string, { readonly target: Pick<InstanceCache, "fullKey" | "renderSlotInstance">; count: number }>();
  private variants: CanvasVariantInputs | undefined;
  private contextView: ViewCtx | undefined;
  private contextVariants: ReturnType<ViewCtx["variantStore"]["getState"]> | undefined;
  private contextDirty = false;
  private stopContextInputs: (() => void) | undefined;
  private readonly modelSubscriptions = new Map<string, {
    readonly model: ReturnType<CanvasModelInputs["node"]>;
    readonly owner: ReturnType<CanvasModelInputs["component"]> | undefined;
    readonly selection: ReturnType<CanvasSelectionInputs["node"]>;
    readonly registration: ReturnType<CanvasRegistrations["component"]> | undefined;
    readonly loading: CanvasRegistrations["loadingStore"] | undefined;
    readonly slot: ReturnType<CanvasVariantInputs["slotStore"]> | undefined;
    readonly stop: () => void;
    readonly listeners: Set<() => void>;
    readonly fullKey: string;
    readonly renderSlotInstance: string | undefined;
  }>();
  private stopModelCommits: (() => void) | undefined;
  private inputNotifications: Set<() => void> | undefined;
  private readonly activeRenderPasses = new Map<() => void, CanvasRenderPass>();
  private readonly environments = new Map<string, { readonly listener: (() => void) | undefined; readonly value: { env: CanvasEnv; wrappingEnv: CanvasEnv } }>();
  private readonly observerSources = new WeakMap<Component | TplNode, Map<string, { ctx?: RenderingCtx; input: CanvasObserverInput }>>();

  constructor(session: CanvasSessionState) {
    this.stopSession = session.subscribeToChanges((instance) =>
      this.invalidateInstance(instance, false),
    );
  }

  invalidateInstance(instance: string, notify = true) {
    const changed = this.instances.get(instance);
    // A session can be initialized before the first cached render of a node.
    const [fullKey, slot] = instance.startsWith('["')
      ? JSON.parse(instance) as [string, string]
      : [instance, undefined];
    const targetKey = changed?.fullKey ?? fullKey;
    const targetSlot = changed?.renderSlotInstance ?? slot;
    return this.invalidatePaths([{ fullKey: targetKey, renderSlotInstance: targetSlot }], notify);
  }

  private invalidatePaths(targets: readonly Pick<InstanceCache, "fullKey" | "renderSlotInstance">[], notify = true) {
    const callbacks = new Set<() => void>();
    for (const target of targets) {
      const parts = target.fullKey.split(".");
      let prefix = "";
      for (const part of parts) {
        prefix = prefix ? `${prefix}.${part}` : part;
        for (const key of [prefix, canvasSessionInstanceKey(prefix, target.renderSlotInstance)]) {
          const resource = this.instances.get(key);
          if (resource) {
            this.instances.delete(key);
            resource.listeners.forEach((listener) => callbacks.add(listener));
          }
        }
      }
    }
    const publish = () => callbacks.forEach((callback) => {
      if (this.inputNotifications) {
        this.inputNotifications.add(callback);
      } else {
        callback();
      }
    });
    if (notify) {
      publish();
    }
    return publish;
  }

  private bindInputs(view: ViewCtx) {
    assert(!this.disposed, "Cannot bind inputs to a disposed canvas owner");
    if (this.inputModels && this.inputModels !== view.studioCtx.modelSnapshots) { this.dispose(); throw new Error("Canvas inputs belong to a retired model world"); }
    if (this.modelInputs) {
      return;
    }
    const studio = view.studioCtx;
    this.contextView = view;
    this.inputModels = studio.modelSnapshots;
    this.modelInputs = new CanvasModelInputs(studio.modelSnapshots);
    this.selectionInputs = new CanvasSelectionInputs(view, studio.draggingObjectStore.getState());
    const stopSelectionCache = this.selectionInputs.subscribeBeforePublish((changed) => {
      const targets: InstanceCache[] = [];
      for (const [instance, resource] of this.instances) {
        const selection = this.modelSubscriptions.get(instance)?.selection;
        if (selection && changed.has(selection)) { targets.push(resource); }
      }
      return this.invalidatePaths(targets, false);
    });
    const syncContext = () => {
      this.contextDirty = true;
      if (!studio.hasPendingModelChanges()) {
        this.prepareContextInputs()();
      }
    };
    const stopSelection = view.selectionStore.subscribe((next, previous) => {
      if (next.context !== previous.context || next.targets !== previous.targets) {
        syncContext();
      }
    });
    const stopRoot = view.frameState.valRootStore.subscribe(syncContext);
    const stopVariants = view.variantStore.subscribe(() => this.prepareContextInputs()());
    this.stopContextInputs = () => { stopSelection(); stopRoot(); stopVariants(); stopSelectionCache(); };
    this.stopModelCommits = studio.subscribeModelChanges((event) => {
      if (event.type === "commit") {
        const parentNotifications = this.inputNotifications;
        const notifications = this.inputNotifications = parentNotifications ?? new Set();
        try {
          this.modelInputs?.prepareCommit();
          this.globalContexts?.prepareCommit();
          this.functions?.prepareCommit();
          this.dataTokens?.prepareCommit();
          this.variants?.prepareCommit();
          this.modelInputs?.prepareCommit();
          this.selectionInputs?.prepareCommit();
          const publishContext = this.prepareContextInputs();
          this.modelInputs?.publishCommit();
          this.selectionInputs?.publishCommit();
          this.globalContexts?.publishCommit();
          this.functions?.publishCommit();
          this.dataTokens?.publishCommit();
          this.variants?.publishCommit();
          publishContext();
        } finally {
          this.inputNotifications = parentNotifications;
        }
        if (!parentNotifications) {
          notifications.forEach((notify) => notify());
        }
      } else { this.dispose(); }
    });
  }

  globalContextInputs(view: ViewCtx) {
    this.bindInputs(view);
    // CSEval builds this owner before React rendering, so initial model reads
    // do not become incidental dependencies of the first component reaction.
    this.dataTokenInputs(view);
    return this.globalContexts ??= new CanvasGlobalContexts(view, ensure(this.modelInputs, "Canvas model inputs must be initialized"));
  }

  functionInputs(view: ViewCtx) {
    this.bindInputs(view);
    return this.functions ??= new CanvasFunctionInputs(view, view.canvasCtx.registrations);
  }

  dataTokenInputs(view: ViewCtx) {
    assert(!this.disposed, "Cannot read data-token inputs for a disposed canvas owner");
    this.bindInputs(view);
    if (!this.dataTokens) {
      const inputs = this.dataTokens = new CanvasDataTokenInputs({ site: view.site, modelSnapshots: view.studioCtx.modelSnapshots, projectId: view.studioCtx.siteInfo.id });
      inputs.subscribeBeforePublish(() => this.invalidatePaths([...this.dataTokenConsumers.values()].map((consumer) => consumer.target), false));
    }
    return this.dataTokens;
  }

  /** A lease belongs to an existing mounted component boundary, never a new
   * wrapper around children. Repeated owners with the same key share a target. */
  retainDataTokenConsumer(fullKey: string, renderSlotInstance?: string): () => void {
    assert(!this.disposed, "Cannot retain data-token inputs for a disposed canvas owner");
    const key = canvasSessionInstanceKey(fullKey, renderSlotInstance);
    let consumer = this.dataTokenConsumers.get(key);
    if (!consumer) { consumer = { target: { fullKey, renderSlotInstance }, count: 0 }; this.dataTokenConsumers.set(key, consumer); }
    consumer.count++;
    const retained = consumer;
    let released = false;
    return () => {
      if (released) { return; } released = true;
      if (--retained.count === 0 && this.dataTokenConsumers.get(key) === retained) { this.dataTokenConsumers.delete(key); }
    };
  }

  variantInputs(view: ViewCtx) {
    this.bindInputs(view);
    if (!this.variants) {
      const variants = this.variants = new CanvasVariantInputs(view);
      variants.subscribeBeforePublish((next, previous) => {
        const notifications: (() => void)[] = [];
        if (!arrayEq(next.frames, previous.frames, (left, right) => left.key === right.key)) {
          this.contextDirty = true; notifications.push(this.prepareContextInputs());
        }
        if (next.defaultSlots !== previous.defaultSlots) {
          const affected: InstanceCache[] = [];
          for (const resource of this.instances.values()) {
            const key = resource.ctx.ownerKey;
            if (isKnownTplSlot(resource.node) && key && next.defaultSlots.includes(key) !== previous.defaultSlots.includes(key)) { affected.push(resource); }
          }
          notifications.push(this.invalidatePaths(affected, false));
        }
        return () => notifications.forEach((publish) => publish());
      });
    }
    return this.variants;
  }

  /** Install per-node decisions and invalidate actual paths before publication. */
  prepareRenderPolicy(policy: StudioRenderPolicySnapshot): () => void {
    if (this.disposed) { return () => undefined; }
    // Prepared model fields are already installed at the completed-model fence.
    // Refresh projections without notifying before reading per-node decisions.
    this.modelInputs?.prepareCommit();
    this.selectionInputs?.prepareCommit();
    const changed: InstanceCache[] = [];
    for (const [instance, resource] of this.instances) {
      const next = canvasNodePolicy(resource.node, resource.ctx, policy);
      const usesExport = (isKnownTplComponent(resource.node) && isCodeComponent(resource.node.component)) ||
        resource.visibilityUsesExport || resource.ctx.viewCtx.canvasSessionState.has(instance, "$visibility");
      const exporting = usesExport ? resource.ctx.viewCtx.canvasCtx.frameInfo(resource.ctx.viewCtx).getState().exporting : undefined;
      if (!objsEq(resource.policy, next) || (resource.exporting !== exporting && usesExport)) { changed.push(resource); }
      resource.policy = next; resource.exporting = exporting;
    }
    return this.invalidatePaths(changed, false);
  }

  /** Native visibility evaluation declares this finite cache input explicitly. */
  setExportVisibilityInput(ctx: RenderingCtx, usesExport: boolean) {
    const resource = this.instances.get(computeCanvasSessionKey(ctx));
    if (resource) {
      resource.visibilityUsesExport = usesExport;
      const code = isKnownTplComponent(resource.node) && isCodeComponent(resource.node.component);
      resource.exporting = usesExport || code ? ctx.viewCtx.canvasCtx.frameInfo(ctx.viewCtx).getState().exporting : undefined;
    }
  }

  /** Session output is installed first; only changed component keys and their
   * existing retained ancestors are invalidated before any session notification. */
  prepareContentEditor(expandedKeys: readonly string[]): () => void {
    if (this.disposed) { return () => undefined; }
    const affected: InstanceCache[] = [];
    for (const resource of this.instances.values()) {
      if (!isKnownTplComponent(resource.node) || !isCodeComponent(resource.node.component)) { continue; }
      const next = expandedKeys.includes(resource.fullKey);
      if (next !== resource.contentEditingExpanded) { resource.contentEditingExpanded = next; affected.push(resource); }
    }
    return this.invalidatePaths(affected, false);
  }

  /** Called before the unique Studio dragging source publishes its new flag. */
  prepareDraggingObject(draggingObject: boolean): () => void {
    return this.disposed ? () => undefined : this.selectionInputs?.prepareDraggingObject(draggingObject) ?? (() => undefined);
  }

  ancestryInput(view: ViewCtx) {
    assert(!this.disposed, "Cannot read ancestry inputs for a disposed canvas owner");
    this.bindInputs(view);
    return ensure(this.selectionInputs, "Canvas selection inputs must be initialized").ancestryStore;
  }

  subscribeAncestryBeforePublish(view: ViewCtx, check: () => void) {
    assert(!this.disposed, "Cannot subscribe to ancestry inputs for a disposed canvas owner");
    this.bindInputs(view);
    return ensure(this.selectionInputs, "Canvas selection inputs must be initialized").subscribeAncestryBeforePublish(check);
  }

  observerInput(view: ViewCtx, model: Component | TplNode, ctx?: RenderingCtx): CanvasObserverInput {
    if (this.inputModels && this.inputModels !== view.studioCtx.modelSnapshots) { this.dispose(); }
    if (this.disposed || view.disposeSignal.aborted || view.isDisposed) { return inactiveObserverInput; }
    this.bindInputs(view);
    const models = ensure(this.inputModels, "Canvas original model scope");
    const component = isKnownComponent(model);
    const modelInput = component ? ensure(this.modelInputs, "Canvas model owner").component(model) : ensure(this.modelInputs, "Canvas model owner").node(model);
    const selected = !component && ctx ? this.selectionInput(view, model, ctx.valKey) : undefined;
    const key = ctx ? JSON.stringify([ctx.valKey, ctx.ownerKey, ctx.renderSlotInstance, ctx.ownerComponent?.uid]) : "component";
    let sources = this.observerSources.get(model);
    if (!sources) { sources = new Map(); this.observerSources.set(model, sources); }
    const retained = sources.get(key);
    if (retained) { retained.ctx = ctx; return retained.input; }
    const entry: { ctx?: RenderingCtx; input: CanvasObserverInput } = { ctx, input: inactiveObserverInput };
    let current: readonly unknown[] = [];
    const closed = () => this.disposed || view.disposeSignal.aborted || view.isDisposed || view.studioCtx.modelSnapshots !== models;
    const capture = () => {
      if (closed()) { return emptyObserverSnapshot; }
      const context = !component && entry.ctx ? Object.values(contextInputs(model, entry.ctx)) : [view.currentComponent() === model];
      const values = [modelInput.getState(), selected?.getState(), ...context];
      if (!arrayEq(current, values)) { current = Object.freeze(values); }
      return current;
    };
    entry.input = {
      getState: capture,
      subscribe: (listener) => {
        if (closed()) { return () => undefined; }
        let previous = capture();
        const runtime = new Map<CanvasObserverInput, () => void>();
        const rebindRuntime = () => {
          const used = new Set<CanvasObserverInput>();
          if (!closed()) {
            const values = [...view.valComponentStack()];
            const root = view.frameState.valRootStore.getState();
            if (root) { values.push(root); }
            values.forEach((value) => { used.add(value.runtimeInputs); if (isValComponent(value)) { used.add(value.componentRuntimeInputs); } });
          }
          for (const source of used) { if (!runtime.has(source)) { runtime.set(source, source.subscribe(changed)); } }
          for (const [source, stop] of runtime) { if (!used.has(source)) { stop(); runtime.delete(source); } }
        };
        const changed = () => { rebindRuntime(); const next = capture(); if (next !== previous) { previous = next; listener(); } };
        const stops = [modelInput.subscribe(changed), view.selectionStore.subscribe(changed), view.variantStore.subscribe(changed), view.frameState.valRootStore.subscribe(changed)];
        if (selected) { stops.push(selected.subscribe(changed)); }
        rebindRuntime();
        return () => { stops.forEach((stop) => stop()); runtime.forEach((stop) => stop()); runtime.clear(); };
      },
    };
    sources.set(key, entry);
    return entry.input;
  }

  selectionInput(view: ViewCtx, node: TplNode, valKey: string) {
    this.bindInputs(view);
    return ensure(this.selectionInputs, "Canvas selection inputs must be initialized").node(node, valKey);
  }

  private prepareContextInputs() {
    if (this.contextView) {
      const next = this.contextView.variantStore.getState(), previous = this.contextVariants;
      if (!previous || next.showDefaultSlots !== previous.showDefaultSlots ||
          !arrayEq(next.frames, previous.frames, (left, right) => left.tpl === right.tpl && left.component === right.component)) {
        this.contextDirty = true;
      }
      this.contextVariants = next;
    }
    const publish: (() => void)[] = [];
    if (this.contextDirty) {
      this.contextDirty = false;
      const affected: string[] = [];
      for (const [instance, resource] of this.instances) {
        const next = contextInputs(resource.node, resource.ctx);
        if (!objsEq(resource.context, next)) {
          affected.push(instance);
        }
      }
      for (const instance of affected) {
        publish.push(this.invalidateInstance(instance, false));
      }
    }
    return () => publish.forEach((notify) => notify());
  }

  private releaseInputs() {
    this.stopModelCommits?.(); this.stopModelCommits = undefined;
    this.stopContextInputs?.(); this.stopContextInputs = undefined;
    this.modelSubscriptions.forEach((subscription) => subscription.stop()); this.modelSubscriptions.clear();
    this.globalContexts?.dispose(); this.globalContexts = undefined;
    this.functions?.dispose(); this.functions = undefined;
    this.dataTokens?.dispose(); this.dataTokens = undefined;
    this.dataTokenConsumers.clear();
    this.variants?.dispose(); this.variants = undefined;
    this.contextView = undefined; this.contextVariants = undefined;
    this.modelInputs?.dispose(); this.modelInputs = undefined;
    this.selectionInputs?.dispose(); this.selectionInputs = undefined;
  }

  beginRender(listener: () => void): CanvasRenderPass {
    const pass = { listener, instances: new Set<string>(), environments: new Set<string>(), previous: this.activeRenderPasses.get(listener) };
    this.activeRenderPasses.set(listener, pass); return pass;
  }
  endRender(pass: CanvasRenderPass) {
    if (this.activeRenderPasses.get(pass.listener) === pass) {
      if (pass.previous) { this.activeRenderPasses.set(pass.listener, pass.previous); }
      else { this.activeRenderPasses.delete(pass.listener); }
    }
  }
  commitRender(pass: CanvasRenderPass) {
    this.releaseUnusedRenderInputs(pass.listener, pass.instances);
    for (const [id, environment] of this.environments) {
      if (environment.listener === pass.listener && !pass.environments.has(id)) { this.environments.delete(id); }
    }
  }
  retainEnvironment(ctx: RenderingCtx, id: string, value: { env: CanvasEnv; wrappingEnv: CanvasEnv }) {
    assert(!this.disposed, "Cannot retain an environment on a disposed canvas owner");
    this.environments.set(id, { listener: ctx.onRenderInvalidated, value });
    this.instances.get(computeCanvasSessionKey(ctx))?.environmentIds.add(id);
    if (ctx.onRenderInvalidated) { this.activeRenderPasses.get(ctx.onRenderInvalidated)?.environments.add(id); }
  }
  private releaseUnusedRenderInputs(listener: () => void, retained?: ReadonlySet<string>) {
    for (const [instance, subscription] of this.modelSubscriptions) {
      if (retained?.has(instance)) { continue; }
      if (subscription.listeners.delete(listener) && !subscription.listeners.size) {
        subscription.stop(); this.modelSubscriptions.delete(instance); this.instances.delete(instance);
      }
    }
  }
  /** A render candidate and its committed component own the same explicit
   * listener, so abandoned/StrictMode cleanup also releases native node leases. */
  releaseRenderListener(listener: () => void) {
    this.releaseUnusedRenderInputs(listener);
    for (const [id, environment] of this.environments) { if (environment.listener === listener) { this.environments.delete(id); } }
  }

  render<R>(node: TplNode, ctx: RenderingCtx, doRenderNode: () => R): R {
    assert(!this.disposed, "Cannot render a disposed canvas owner");
    const instance = computeCanvasSessionKey(ctx);
    this.bindInputs(ctx.viewCtx);
    const modelInput = ensure(this.modelInputs, "Canvas model inputs must be initialized").node(node);
    const ownerInput = ctx.ownerComponent ? ensure(this.modelInputs, "Canvas model inputs must be initialized").component(ctx.ownerComponent) : undefined;
    const selectionInput = this.selectionInput(ctx.viewCtx, node, ctx.valKey);
    const registrationInput = isKnownTplComponent(node) && node.component.codeComponentMeta
      ? ctx.viewCtx.canvasCtx.registrations.component(node.component.name) : undefined;
    const loadingInput = registrationInput && !registrationInput.getState() && isKnownTplComponent(node) && node.component.codeComponentMeta?.isHostLess
      ? ctx.viewCtx.canvasCtx.registrations.loadingStore : undefined;
    const slotInput = isKnownTplSlot(node) && ctx.ownerKey ? this.variants?.slotStore(ctx.ownerKey) : undefined;
    let subscription = this.modelSubscriptions.get(instance);
    if (!subscription || subscription.model !== modelInput || subscription.owner !== ownerInput || subscription.selection !== selectionInput ||
        subscription.registration !== registrationInput || subscription.loading !== loadingInput || subscription.slot !== slotInput) {
      const listeners = subscription?.listeners ?? new Set<() => void>();
      subscription?.stop();
      const changed = () => { this.invalidateInstance(instance); };
      const stopModel = modelInput.subscribe(changed);
      const stopOwner = ownerInput?.subscribe(changed);
      const stopRegistration = registrationInput?.subscribe(changed), stopLoading = loadingInput?.subscribe(changed);
      subscription = { model: modelInput, owner: ownerInput, selection: selectionInput, registration: registrationInput, loading: loadingInput, slot: slotInput, listeners, fullKey: computeFullKey(ctx), renderSlotInstance: ctx.renderSlotInstance,
        stop: () => { stopModel(); stopOwner?.(); stopRegistration?.(); stopLoading?.(); } };
      this.modelSubscriptions.set(instance, subscription);
    }
    let resource = this.instances.get(instance);
    if (!resource) {
      resource = {
        fullKey: computeFullKey(ctx), renderSlotInstance: ctx.renderSlotInstance, environmentIds: new Set(),
        cache: new DeepMap<RenderEntries>(), listeners: subscription.listeners,
        stopModelInputs: subscription.stop, node, ctx, context: contextInputs(node, ctx),
        policy: canvasNodePolicy(node, ctx, ctx.viewCtx.studioCtx.renderPolicy.store.getState()),
        contentEditingExpanded: isKnownTplComponent(node) && isCodeComponent(node.component) && ctx.viewCtx.contentEditor.isExpanded(computeFullKey(ctx)),
        exporting: isKnownTplComponent(node) && isCodeComponent(node.component) ? ctx.viewCtx.canvasCtx.frameInfo(ctx.viewCtx).getState().exporting : undefined,
        visibilityUsesExport: false,
      };
      this.instances.set(instance, resource);
    }
    resource.stopModelInputs = subscription.stop;
    resource.node = node;
    resource.ctx = ctx;
    resource.context = contextInputs(node, ctx);
    resource.policy = canvasNodePolicy(node, ctx, ctx.viewCtx.studioCtx.renderPolicy.store.getState());
    resource.contentEditingExpanded = isKnownTplComponent(node) && isCodeComponent(node.component) && ctx.viewCtx.contentEditor.isExpanded(computeFullKey(ctx));
    if (ctx.onRenderInvalidated) {
      resource.listeners.add(ctx.onRenderInvalidated);
    }
    const hash = [...computeHashFromStableFields(node, ctx), modelInput.getState(), ownerInput?.getState(), selectionInput.getState(),
      registrationInput?.getState(), loadingInput?.getState(), slotInput?.getState(), ...Object.values(contextInputs(node, ctx)), ...Object.values(resource.policy)];
    const rest = computeNonStableFields(ctx);
    const mapEntry = resource.cache.entry(hash);
    const entries = mapEntry.exists() ? mapEntry.get() : [];
    const hit = entries.find(([key]) => areNonStableFieldsEquiv(rest, key));
    const pass = ctx.onRenderInvalidated ? this.activeRenderPasses.get(ctx.onRenderInvalidated) : undefined;
    if (pass) {
      pass.instances.add(instance);
      if (hit) {
        resource.environmentIds.forEach((id) => pass.environments.add(id));
        for (const [key, descendant] of this.modelSubscriptions) {
          if (descendant.listeners.has(pass.listener) && descendant.renderSlotInstance === ctx.renderSlotInstance &&
            (descendant.fullKey === resource.fullKey || descendant.fullKey.startsWith(resource.fullKey + "."))) {
            pass.instances.add(key); this.instances.get(key)?.environmentIds.forEach((id) => pass.environments.add(id));
          }
        }
      }
    }
    if (hit) { return hit[1].value as R; }
    // React retains previous elements itself. Keep only this instance's latest
    // successful native-input result; invalidation evicts its retained ancestors.
    const previousEnvironments = [...resource.environmentIds];
    resource.environmentIds.clear();
    let result: R;
    try { result = doRenderNode(); }
    catch (error) {
      resource.environmentIds.clear(); previousEnvironments.forEach((id) => resource.environmentIds.add(id));
      throw error;
    }
    resource.cache = new DeepMap<RenderEntries>();
    resource.cache.entry(hash).set([[rest, { value: result }]]);
    return result;
  }

  dispose() {
    if (this.disposed) { return; }
    this.disposed = true; this.lifetimeController.abort();
    this.stopSession();
    this.releaseInputs();
    this.instances.clear(); this.environments.clear(); this.activeRenderPasses.clear();
  }
}

export function cachedRenderTplNode<R>(
  node: TplNode, ctx: RenderingCtx, doRenderNode: () => R,
): R {
  return ctx.viewCtx.canvasRenderOwner.render(node, ctx, doRenderNode);
}
