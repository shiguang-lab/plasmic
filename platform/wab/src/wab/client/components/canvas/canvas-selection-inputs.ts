import type { ModelFieldStore, ModelRef, ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import type { ViewSelectionSnapshot } from "@/wab/client/studio-ctx/view-selection";
import { arrayEq, assert, ensure } from "@/wab/shared/common";
import { SlotSelection, isSlotSelection } from "@/wab/shared/core/slots";
import { ancestorsThroughComponentsWithSlotSelections, computeAncestorsValKey } from "@/wab/shared/core/tpls";
import { ObjInst, TplNode, ensureKnownTplComponent, isKnownRenderExpr, isKnownSlotParam, isKnownTplComponent } from "@/wab/shared/model/classes";
import { createStore, StoreApi } from "zustand/vanilla";

export interface CanvasSelectionInfo {
  readonly id: string;
  readonly isSelected: boolean;
  readonly selectedSlotName: string | null;
}
interface NodeInput {
  readonly node: TplNode;
  readonly valKey: string;
  current: CanvasSelectionInfo;
  readonly state: StoreApi<CanvasSelectionInfo>;
  readonly store: ModelFieldStore<CanvasSelectionInfo>;
}
interface PathInput { readonly suffix: string; readonly slotName: string | null; }

/** Declared selection/model path inputs; publication is coordinated with model capsules. */
export class CanvasSelectionInputs {
  private readonly models: ModelSnapshots;
  private readonly nodes = new Map<string, NodeInput>();
  private readonly fields = new Map<ModelFieldStore<unknown>, () => void>();
  private readonly subscriptions = new Set<() => void>();
  private readonly stopSelection: () => void;
  private readonly ancestryBeforePublish = new Set<() => void>();
  private readonly beforePublish = new Set<(changed: ReadonlySet<ModelFieldStore<CanvasSelectionInfo>>) => () => void>();
  private path: Readonly<Record<number, PathInput>> = Object.freeze({});
  private ancestry: readonly ModelRef<TplNode>[] = Object.freeze([]);
  private readonly ancestryState: StoreApi<readonly ModelRef<TplNode>[]>;
  readonly ancestryStore: ModelFieldStore<readonly ModelRef<TplNode>[]>;
  private readonly changed = new Set<NodeInput>();
  private disabled = false;
  private dirty = true;
  private disposed = false;
  private revealTarget: TplNode | undefined;

  constructor(private readonly view: ViewCtx, private draggingObject: boolean) {
    this.models = view.studioCtx.modelSnapshots;
    this.prepareCommit();
    this.ancestryState = createStore(() => this.ancestry);
    this.ancestryStore = {
      getState: () => this.ancestry,
      getInitialState: this.ancestryState.getInitialState,
      subscribe: (listener) => {
        if (this.disposed) { return () => undefined; }
        const off = this.ancestryState.subscribe(listener);
        const stop = () => { off(); this.subscriptions.delete(stop); };
        this.subscriptions.add(stop); return stop;
      },
    };
    this.stopSelection = view.selectionStore.subscribe((next, previous) => {
      if (next.tpls !== previous.tpls || next.targets !== previous.targets ||
          next.disabledAutoOpenUuid !== previous.disabledAutoOpenUuid) {
        this.revealTarget = undefined;
        this.dirty = true;
        if (!view.studioCtx.hasPendingModelChanges()) {
          this.prepareCommit(); this.publishCommit();
        }
      }
    });
  }

  /** Reuse the canvas reveal contract without changing the inspector selection. */
  setRevealTarget(target: TplNode | undefined) {
    if (this.disposed || this.revealTarget === target) { return; }
    this.revealTarget = target;
    this.dirty = true;
    this.prepareCommit();
    this.publishCommit();
  }

  node(node: TplNode, valKey: string): ModelFieldStore<CanvasSelectionInfo> {
    assert(!this.disposed, "Cannot read a disposed canvas selection");
    const key = JSON.stringify([node.uid, valKey]);
    let input = this.nodes.get(key);
    if (!input) {
      const initial = this.captureNode(node, valKey);
      const state = createStore(() => initial);
      const retained: NodeInput = {
        node, valKey, state, current: initial,
        store: {
          getState: () => retained.current,
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
        },
      };
      input = retained;
      this.nodes.set(key, input);
    }
    return input.store;
  }

  /** Install all selected-node values before any model-input subscribers run. */
  prepareCommit() {
    if (this.disposed || !this.dirty) {
      return;
    }
    const selection = this.view.selectionStore.getState();
    const sources = new Set<ModelFieldStore<unknown>>();
    const declare = <T extends ObjInst, Key extends Exclude<keyof T, "uid"> & string>(model: T, key: Key) => {
      sources.add(this.models.field(model, key));
    };
    const declareTpl = (tpl: TplNode) => {
      declare(tpl, "parent");
      if (isKnownTplComponent(tpl)) {
        declare(tpl, "component");
        declare(tpl.component, "type"); declare(tpl.component, "tplTree"); declare(tpl.component, "params");
        declare(tpl, "vsettings");
        for (const setting of tpl.vsettings) {
          declare(setting, "args");
          for (const arg of setting.args) {
            declare(arg, "param"); declare(arg, "expr");
            if (isKnownRenderExpr(arg.expr)) {
              declare(arg.expr, "tpl");
            }
          }
        }
      }
    };
    const selected = this.selectedNode(selection);
    const selectionAncestry = selected ? ancestorsThroughComponentsWithSlotSelections(selected, { includeTplComponentRoot: true }) : [];
    const ancestry = this.revealTarget
      ? ancestorsThroughComponentsWithSlotSelections(this.revealTarget, { includeTplComponentRoot: true })
      : selectionAncestry;
    const path: Record<number, PathInput> = {};
    for (const { node } of [...selectionAncestry, ...ancestry]) {
      if (isSlotSelection(node)) {
        declareTpl(node.getTpl());
        declare(node.slotParam, "variable"); declare(node.slotParam.variable, "name");
        if (isKnownSlotParam(node.slotParam)) {
          declare(node.slotParam, "tplSlot");
        }
      } else {
        declareTpl(node);
      }
    }
    for (let index = 0; index < ancestry.length; index++) {
      const { node } = ancestry[index];
      if (!isSlotSelection(node)) {
        if (!Object.hasOwn(path, node.uid)) {
          const descendant = index > 0 ? ancestry[index - 1].node : undefined;
          path[node.uid] = Object.freeze({
            suffix: computeAncestorsValKey(ancestry.slice(index)),
            slotName: isSlotSelection(descendant) ? descendant.slotParam.variable.name : null,
          });
        }
      }
    }
    const ancestryRefs = selectionAncestry.map(({ node }) => this.models.ref(isSlotSelection(node) ? node.getTpl() : node));
    if (!arrayEq(this.ancestry, ancestryRefs)) { this.ancestry = Object.freeze(ancestryRefs); }
    this.path = Object.freeze(path);
    this.disabled = !this.revealTarget && !!selection.disabledAutoOpenUuid;
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
    this.refreshNodes();
  }

  private refreshNodes() {
    for (const input of this.nodes.values()) {
      const next = this.captureNode(input.node, input.valKey);
      if (input.current.isSelected !== next.isSelected || input.current.selectedSlotName !== next.selectedSlotName) {
        const published = input.state.getState();
        input.current = published.isSelected === next.isSelected && published.selectedSlotName === next.selectedSlotName
          ? published : next;
        this.changed.add(input);
      }
    }
  }

  subscribeBeforePublish(listener: (changed: ReadonlySet<ModelFieldStore<CanvasSelectionInfo>>) => () => void) {
    if (this.disposed) { return () => undefined; }
    this.beforePublish.add(listener);
    return () => { this.beforePublish.delete(listener); };
  }

  subscribeAncestryBeforePublish(listener: () => void) {
    if (this.disposed) { return () => undefined; }
    this.ancestryBeforePublish.add(listener);
    return () => { this.ancestryBeforePublish.delete(listener); };
  }

  /** Install changed node inputs and invalidate their caches before the Studio flag publishes. */
  prepareDraggingObject(draggingObject: boolean): () => void {
    if (this.disposed || draggingObject === this.draggingObject) { return () => undefined; }
    this.draggingObject = draggingObject;
    this.refreshNodes();
    return this.preparePublication();
  }

  private preparePublication() {
    const changed = [...this.changed]; this.changed.clear();
    const ancestryChanged = this.ancestryState.getState() !== this.ancestry;
    if (!changed.length && !ancestryChanged) { return () => undefined; }
    const stores = new Set(changed.map((input) => input.store));
    const notifications = [...this.beforePublish].map((prepare) => prepare(stores));
    if (ancestryChanged) { this.ancestryBeforePublish.forEach((check) => check()); }
    return () => {
      if (this.disposed) { return; }
      changed.forEach((input) => input.state.setState(input.current, true));
      if (ancestryChanged) { this.ancestryState.setState(this.ancestry, true); }
      notifications.forEach((notify) => notify());
    };
  }

  publishCommit() { this.preparePublication()(); }

  private selectedNode(selection: ViewSelectionSnapshot) {
    const targets = selection.targets.filter((target) => !!target);
    if (targets.length === 1) {
      const target = targets[0];
      const tpl = this.models.resolve(target.tpl);
      return target.kind === "slot"
        ? new SlotSelection({ tpl: ensureKnownTplComponent(tpl), slotParam: this.models.resolve(ensure(target.slotParam, "Slot selection requires a parameter")) })
        : tpl;
    }
    const tpls = selection.tpls.filter((tpl) => !!tpl);
    return tpls.length === 1 ? this.models.resolve(tpls[0]) : undefined;
  }

  private captureNode(node: TplNode, valKey: string): CanvasSelectionInfo {
    const path = this.path[node.uid];
    const isSelected = !this.draggingObject && !this.disabled && !!path && valKey.endsWith(path.suffix);
    return Object.freeze({ id: node.uuid, isSelected, selectedSlotName: isSelected ? path.slotName : null });
  }

  dispose() {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.stopSelection();
    this.fields.forEach((stop) => stop()); this.fields.clear();
    this.subscriptions.forEach((stop) => stop()); this.subscriptions.clear();
    this.nodes.clear(); this.changed.clear(); this.beforePublish.clear(); this.ancestryBeforePublish.clear();
  }
}
