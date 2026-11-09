import { CanvasVariantInputs } from "@/wab/client/components/canvas/canvas-variant-inputs";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { ComponentCtx } from "@/wab/client/studio-ctx/component-ctx";
import type { Fiber } from "@/wab/client/react-global-hook/fiber";
import { globalHookCtx } from "@/wab/client/react-global-hook/globalHook";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewSelection } from "@/wab/client/studio-ctx/view-selection";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { ViewVariantState } from "@/wab/client/studio-ctx/view-variant-state";
import { mkArenaFrame } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure, ensureInstance } from "@/wab/shared/common";
import { GlobalVariantFrame, RootComponentVariantFrame, TransientComponentVariantFrame } from "@/wab/shared/component-frame";
import { ComponentType } from "@/wab/shared/core/components";
import type { ModelChange } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplComponent } from "@/wab/shared/core/tpls";
import { ValComponent } from "@/wab/shared/core/val-nodes";
import { ObjInst, TplComponent } from "@/wab/shared/model/classes";
import { mock } from "vitest-mock-extended";

function fixture() {
  const site = createSite(), manager = new TplMgr({ site });
  const component = manager.addComponent({ name: "Root", type: ComponentType.Plain });
  const group = manager.createVariantGroup({ component, name: "Mode" });
  const first = manager.createVariant(component, group, "First"), second = manager.createVariant(component, group, "Second");
  const theme = manager.createGlobalVariantGroup("Theme"), dark = manager.createGlobalVariant(theme, "Dark");
  const arena = mkArenaFrame({ site, component, name: "Root", width: 800, height: 600 });
  const models = new ModelSnapshots(), frame = globalHookCtx.createFrameState({ uid: arena.uid, objectPrototype: Object.prototype });
  let pending = false;
  const variants = new ViewVariantState(() => models, () => arena, () => site, () => pending, () => !!frame.valRootStore.getState());
  const selection = new ViewSelection(() => models), root = new RootComponentVariantFrame(arena), global = new GlobalVariantFrame(site, arena);
  variants.transaction(() => { variants.replaceFrames([root]); variants.setGlobal(global); });
  const rawValues = new Map<string, ValComponent>();
  const value = (tpl: TplComponent, key: string, owner?: ValComponent) => {
    const raw = new ValComponent({ tpl, key, fullKey: key.split(".").map((part) => `${part}[0]`).join("."), frameUid: arena.uid,
      valOwner: owner, parent: undefined, className: "", slotInfo: undefined, slotArgs: new Map(), slotCanvasEnvs: new Map(),
      fibers: [Object.assign(mock<Fiber>(), { memoizedProps: { variants: { mode: "first" } } })] });
    rawValues.set(raw.fullKey, raw);
    return ensureInstance(frame.renderState.registerVal(raw), ValComponent);
  };
  const rootValue = value(arena.container, arena.container.uuid); frame.valRootStore.setState(rootValue, true);
  const studio = Object.assign(mock<StudioCtx>(), { site, modelSnapshots: models, hasPendingModelChanges: () => pending });
  const view = Object.assign(mock<ViewCtx>(), { site, studioCtx: studio, variantStore: variants.store, selectionStore: selection.store, frameState: frame });
  const owner = new CanvasVariantInputs(view);
  const commit = (...fields: [ObjInst, string][]) => {
    const changes: ModelChange[] = fields.map(([inst, field]) => ({ type: "update", oldValue: undefined, newValue: Reflect.get(inst, field), changeNode: { inst, field } }));
    models.sync(changes); variants.prepareCommit(); owner.prepareCommit(); pending = false; owner.publishCommit(); variants.publishCommit();
  };
  return { site, manager, component, rawValues, first, second, dark, arena, models, frame, root, global, rootValue, value, variants, selection, owner, commit,
    begin: () => { pending = true; }, dispose: () => { owner.dispose(); variants.dispose(); selection.dispose(); frame.dispose(); models.dispose(); } };
}

it("derives atomic pins from native frame DTOs before their publication without observable models", () => {
  const f = fixture(), source = f.owner.ownerStore(f.rootValue.key), unrelated = f.owner.ownerStore("unrelated");
  expect(source.getState()?.pins.find((pin) => pin.variant.uid === f.first.uid)?.active).toBe(true);
  const observed: unknown[] = [], other = vi.fn();
  source.subscribe(() => observed.push([source.getState(), f.owner.globalStore.getState()])); unrelated.subscribe(other);
  f.begin(); f.root.setTargetVariants([f.second]); f.root.setPinnedVariants(new Map([[f.first, false]]));
  f.global.setPinnedVariants(new Map([[f.dark, true]]));
  const before = source.getState();
  f.commit([f.arena, "targetVariants"], [f.arena, "pinnedVariants"], [f.arena, "pinnedGlobalVariants"]);
  expect(observed).toEqual([[source.getState(), f.owner.globalStore.getState()]]);
  expect(source.getState()).not.toBe(before);
  expect(source.getState()?.pins.find((pin) => pin.variant.uid === f.first.uid)?.active).toBe(false);
  expect(source.getState()?.pins.find((pin) => pin.variant.uid === f.second.uid)?.active).toBe(true);
  expect(f.owner.globalStore.getState().find((pin) => pin.variant.uid === f.dark.uid)?.active).toBe(true);
  expect(other).not.toHaveBeenCalled();
  f.dispose();
});

it("refreshes model-only variant names and inherited pins while sharing unchanged globals", () => {
  const f = fixture(), globals = f.owner.globalStore.getState();
  f.begin(); f.first.name = "Renamed"; f.commit([f.first, "name"]);
  expect(f.owner.ownerStore(f.rootValue.key).getState()?.pins.find((pin) => pin.variant.uid === f.first.uid)?.active).toBe(false);
  expect(f.owner.globalStore.getState()).toBe(globals);
  const parent = f.manager.addComponent({ name: "Parent", type: ComponentType.Plain });
  const group = f.manager.createVariantGroup({ component: parent, name: "Inherited" });
  const inherited = f.manager.createVariant(parent, group, "Enabled");
  f.begin(); f.component.superComp = parent; f.arena.pinnedVariants[inherited.uuid] = true;
  f.commit([f.component, "superComp"], [f.arena, "pinnedVariants"]);
  expect(f.owner.ownerStore(f.rootValue.key).getState()?.pins.find((pin) => pin.variant.uid === inherited.uid)?.active).toBe(true);
  expect(f.owner.globalStore.getState()).toBe(globals);
  f.dispose();
});

it("selects default slot keys and stack pins narrowly from committed runtime owners", () => {
  const f = fixture(), rootStore = f.owner.ownerStore(f.rootValue.key), rootChanged = vi.fn(); rootStore.subscribe(rootChanged);
  const child = f.manager.addComponent({ name: "Child", type: ComponentType.Plain });
  const tpl = mkTplComponent(child, child.variants[0]);
  const childValue = f.value(tpl, `${f.rootValue.key}.${f.component.tplTree.uuid}.${tpl.uuid}`, f.rootValue);
  const childFrame = new TransientComponentVariantFrame(tpl);
  const rootSlot = f.owner.slotStore(f.rootValue.key), childSlot = f.owner.slotStore(childValue.key), other = f.owner.slotStore("other");
  const unrelated = vi.fn(); other.subscribe(unrelated);
  f.variants.deferPublication(() => f.selection.deferPublication(() => {
    f.selection.setContext(new ComponentCtx({ valComponent: childValue }));
    f.variants.replaceFrames([f.root, childFrame]); f.variants.setShowDefaultSlots(true);
  }));
  expect(rootSlot.getState()).toBe(true); expect(childSlot.getState()).toBe(true); expect(other.getState()).toBe(false);
  expect(rootChanged).not.toHaveBeenCalled(); expect(unrelated).not.toHaveBeenCalled();
  f.variants.setShowDefaultSlots(false);
  expect(rootSlot.getState()).toBe(false); expect(childSlot.getState()).toBe(false);
  expect(rootChanged).not.toHaveBeenCalled();
  f.dispose();
});

it("consumes same-Val Fiber updates, preserves no-ops and stops after disposal", () => {
  const f = fixture(), source = f.owner.ownerStore(f.rootValue.key), changed = vi.fn(); source.subscribe(changed);
  ensure(f.rootValue.fibers[0], "Root must have its committed Fiber").memoizedProps = { variants: { mode: "second" } };
  f.frame.variantInputs.invalidate(); f.frame.variantInputs.prepareCommit(); f.frame.variantInputs.publishCommit();
  expect(source.getState()?.pins.find((pin) => pin.variant.uid === f.second.uid)?.active).toBe(true);
  expect(changed).toHaveBeenCalledTimes(1);
  const before = source.getState();
  f.frame.variantInputs.invalidate(); f.frame.variantInputs.prepareCommit(); f.frame.variantInputs.publishCommit();
  expect(source.getState()).toBe(before); expect(changed).toHaveBeenCalledTimes(1);
  f.owner.dispose();
  f.root.setTargetVariants([f.first]);
  expect(changed).toHaveBeenCalledTimes(1);
  f.dispose();
});


it("captures a normalized rendered root on first read and follows same-root context child replacement without broad slot or global notifications", () => {
  const f = fixture(), source = f.owner.rootStore;
  const initial = source.getState();
  expect(initial).toEqual({ tpl: f.models.ref(f.rootValue.tpl), key: f.rootValue.key, fullKey: f.rootValue.fullKey });
  const changed = vi.fn(), globalsChanged = vi.fn(), slotsChanged = vi.fn();
  source.subscribe(changed); f.owner.globalStore.subscribe(globalsChanged); f.owner.slotStore("unrelated").subscribe(slotsChanged);
  const context = mkCodeComponent("Context", { name: "Context", importPath: "./Context", props: {} }, {});
  ensure(context.codeComponentMeta, "Actual context metadata").isContext = true;
  const tpl = mkTplComponent(context, context.variants[0]);
  const wrapper = f.value(tpl, tpl.uuid), raw = ensure(f.rawValues.get(wrapper.fullKey), "Non-cached runtime producer");
  const commitRuntime = () => {
    f.frame.renderState.recomputeCachedVal(wrapper.fullKey);
    f.frame.variantInputs.invalidate(); f.frame.variantInputs.prepareCommit(); f.frame.variantInputs.publishCommit();
  };
  try {
    raw.contents = [f.rootValue]; commitRuntime();
    f.frame.valRootStore.setState(wrapper, true);
    expect(source.getState()).toBe(initial); expect(changed).not.toHaveBeenCalled();
    raw.contents = []; commitRuntime();
    expect(f.frame.valRootStore.getState()).toBe(wrapper);
    expect(source.getState()).toBeUndefined(); expect(changed).toHaveBeenCalledOnce();
    raw.contents = [f.rootValue]; commitRuntime();
    expect(source.getState()).toEqual(initial); expect(changed).toHaveBeenCalledTimes(2);
    const stable = source.getState(); commitRuntime();
    expect(source.getState()).toBe(stable); expect(changed).toHaveBeenCalledTimes(2);
    expect(globalsChanged).not.toHaveBeenCalled(); expect(slotsChanged).not.toHaveBeenCalled();
    f.owner.dispose();
    const demand = vi.spyOn(f.models, "field");
    raw.contents = []; commitRuntime();
    expect(source.getState()).toBeUndefined(); expect(demand).not.toHaveBeenCalled();
  } finally { f.dispose(); }
});
