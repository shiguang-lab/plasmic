import { ComponentType } from "@/wab/shared/core/components";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { ViewSelection } from "@/wab/client/studio-ctx/view-selection";
import { ViewVariantState } from "@/wab/client/studio-ctx/view-variant-state";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { TplMgr } from "@/wab/shared/TplMgr";
import { mkVariant } from "@/wab/shared/Variants";
import { GlobalVariantFrame, RootComponentVariantFrame, TransientComponentVariantFrame } from "@/wab/shared/component-frame";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplComponent, mkTplTagX } from "@/wab/shared/core/tpls";
import { instUtil } from "@/wab/shared/model/InstUtil";

function setup() {
  const site = createSite();
  const tplMgr = new TplMgr({ site });
  const component = tplMgr.addComponent({ name: "Root", type: ComponentType.Plain });
  const childComponent = tplMgr.addComponent({ name: "Child", type: ComponentType.Plain });
  const variant = mkVariant({ name: "Selected" });
  component.variants.push(variant);
  const childVariant = mkVariant({ name: "Child selected" });
  childComponent.variants.push(childVariant);
  const frame = mkArenaFrame({ site, component, name: "Root", width: 100, height: 100 });
  const arena = mkMixedArena("Variants");
  arena.children.push(frame);
  site.arenas.push(arena);
  const group = tplMgr.createGlobalVariantGroup("Theme");
  const globalVariant = mkVariant({ name: "Dark", parent: group });
  group.variants.push(globalVariant);
  const models = new ModelSnapshots();
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  const root = new RootComponentVariantFrame(frame);
  const child = new TransientComponentVariantFrame(mkTplComponent(childComponent, childComponent.variants[0]));
  const global = new GlobalVariantFrame(site, frame);
  let pending = false;
  let hasRoot = false;
  const owner = new ViewVariantState(() => models, () => frame, () => site, () => pending, () => hasRoot);
  owner.transaction(() => { owner.replaceFrames([root, child]); owner.setGlobal(global); });
  return { site, frame, component, childComponent, models, recorder, owner, root, child, global, variant, childVariant, globalVariant,
    pending: (value: boolean) => { pending = value; },
    rootExists: (value: boolean) => { hasRoot = value; owner.syncRuntime(); },
    dispose: () => { owner.dispose(); models.dispose(); recorder.dispose(); },
  };
}

it("publishes immutable real frame inputs and shares every unaffected owner", () => {
  const f = setup();
  try {
    const initial = f.owner.store.getState();
    const changed = vi.fn();
    f.owner.store.subscribe(changed);
    f.root.setTargetVariants([f.variant]);
    const targeted = f.owner.store.getState();
    expect(changed).toHaveBeenCalledOnce();
    expect(targeted.frames[0].targets).toEqual([f.models.ref(f.variant)]);
    expect(targeted.frames[1]).toBe(initial.frames[1]);
    expect(targeted.global).toBe(initial.global);
    expect(Object.isFrozen(targeted)).toBe(true);
    expect(Object.isFrozen(targeted.frames[0].targets)).toBe(true);
    f.root.setTargetVariants([f.variant]);
    f.child.setPinnedVariants(new Map([[f.childVariant, true]]));
    const pinned = f.owner.store.getState();
    expect(pinned.frames[0]).toBe(targeted.frames[0]);
    expect(pinned.frames[1].pins).toEqual([{ variant: f.models.ref(f.childVariant), active: true }]);
    expect(Object.isFrozen(pinned.frames[1].pins[0])).toBe(true);
    f.child.setPinnedVariants(new Map([[f.childVariant, true]]));
    expect(f.owner.store.getState()).toBe(pinned);
    expect(changed).toHaveBeenCalledTimes(2);
  } finally { f.dispose(); }
});

it("installs completed model-backed pins before notifying and ignores unrelated model fields", () => {
  const f = setup();
  try {
    const initial = f.owner.store.getState();
    const changed = vi.fn();
    f.owner.store.subscribe(changed);
    f.pending(true);
    const edit = f.recorder.withRecording(() => {
      f.root.setTargetVariants([f.variant]);
      f.global.setPinnedVariants(new Map([[f.globalVariant, false]]));
    });
    expect(f.owner.store.getState()).toBe(initial);
    expect(changed).not.toHaveBeenCalled();
    f.models.sync(edit.changes);
    f.owner.prepareCommit();
    const installed = f.owner.store.getState();
    expect(installed.frames[0].targets).toEqual([f.models.ref(f.variant)]);
    expect(installed.global.pins).toEqual([{ variant: f.models.ref(f.globalVariant), active: false }]);
    expect(changed).not.toHaveBeenCalled();
    f.owner.publishCommit();
    expect(changed).toHaveBeenCalledExactlyOnceWith(installed, initial);
    const unrelated = f.recorder.withRecording(() => { f.component.name = "Renamed"; });
    f.models.sync(unrelated.changes);
    f.owner.prepareCommit(); f.owner.publishCommit();
    expect(f.owner.store.getState()).toBe(installed);
    expect(changed).toHaveBeenCalledOnce();
  } finally { f.dispose(); }
});

it("reflects undo/API frame edits that bypass variant frame setter commands", () => {
  const f = setup();
  try {
    f.pending(true);
    const edit = f.recorder.withRecording(() => {
      f.frame.targetVariants = [f.variant];
      f.frame.pinnedGlobalVariants[f.globalVariant.uuid] = true;
    });
    f.models.sync(edit.changes);
    f.owner.prepareCommit(); f.owner.publishCommit();
    expect(f.owner.store.getState().frames[0].targets).toEqual([f.models.ref(f.variant)]);
    expect(f.owner.store.getState().global.pins).toEqual([{ variant: f.models.ref(f.globalVariant), active: true }]);
    const undo = f.recorder.withRecording(() => {
      f.frame.targetVariants = [];
      delete f.frame.pinnedGlobalVariants[f.globalVariant.uuid];
    });
    f.models.sync(undo.changes);
    f.owner.prepareCommit(); f.owner.publishCommit();
    expect(f.owner.store.getState().frames[0].targets).toEqual([]);
    expect(f.owner.store.getState().global.pins).toEqual([]);
  } finally { f.dispose(); }
});

it("coordinates selection and component stack publication and rolls back nested failures", () => {
  const f = setup();
  const selection = new ViewSelection(() => f.models);
  const stops: (() => void)[] = [];
  const transaction = (command: () => void) => selection.deferPublication(() => f.owner.deferPublication(() => selection.transaction(() => f.owner.transaction(command))));
  try {
    const tpl = mkTplTagX("span");
    const notifications = vi.fn(() => {
      expect(selection.store.getState().tpls).toEqual([f.models.ref(tpl)]);
      expect(f.owner.store.getState().frames).toHaveLength(1);
      expect(f.owner.store.getState().showDefaultSlots).toBe(true);
    });
    stops.push(selection.store.subscribe(notifications), f.owner.store.subscribe(notifications));
    transaction(() => { selection.setTpls([tpl]); f.owner.replaceFrames([f.root]); f.owner.setShowDefaultSlots(true); });
    expect(notifications).toHaveBeenCalledTimes(2);
    const snapshot = f.owner.store.getState();
    const focused = selection.store.getState();
    notifications.mockClear();
    expect(() => transaction(() => { selection.setTpls([]); f.owner.replaceFrames([f.root, f.child]); f.owner.setShowDefaultSlots(false); throw new Error("failed selection"); })).toThrow("failed selection");
    expect(f.owner.store.getState()).toBe(snapshot);
    expect(selection.store.getState()).toBe(focused);
    expect(f.owner.frames()).toHaveLength(1);
    expect(notifications).not.toHaveBeenCalled();
    transaction(() => {
      try { transaction(() => { f.owner.replaceFrames([f.root, f.child]); selection.setTpls([]); throw new Error("nested"); }); }
      catch { expect(f.owner.frames()).toHaveLength(1); }
    });
    expect(f.owner.store.getState()).toBe(snapshot);
    expect(selection.store.getState()).toBe(focused);
    expect(notifications).not.toHaveBeenCalled();
  } finally { stops.forEach((stop) => stop()); selection.dispose(); f.dispose(); }
});

it("updates the exact editing Boolean when native root/context/targets become available", () => {
  const f = setup();
  try {
    f.child.setTargetVariants([f.childVariant]);
    expect(f.owner.store.getState().isEditingNonBaseVariant).toBe(false);
    f.rootExists(true);
    expect(f.owner.store.getState().isEditingNonBaseVariant).toBe(true);
    f.owner.replaceFrames([f.root]);
    expect(f.owner.store.getState().isEditingNonBaseVariant).toBe(false);
    f.root.setTargetVariants([f.variant]);
    expect(f.owner.store.getState().isEditingNonBaseVariant).toBe(true);
    f.rootExists(false);
    expect(f.owner.store.getState().isEditingNonBaseVariant).toBe(false);
  } finally { f.dispose(); }
});

it("clones transient/private command state independently and stops every source on disposal", () => {
  const f = setup();
  try {
    const privateVariant = mkVariant({ name: "Hover", selectors: [":hover"], forTpl: f.component.tplTree });
    f.component.variants.push(privateVariant);
    f.root.setTargetVariants([privateVariant]);
    f.root.setPinnedVariants(new Map([[privateVariant, false]]));
    const copy = f.root.clone();
    copy.setTargetVariants([]);
    copy.setPinnedVariants(new Map());
    expect(f.root.getTargetVariants()).toEqual([privateVariant]);
    expect(f.root.getPinnedVariants().get(privateVariant)).toBe(false);
    f.child.setTargetVariants([f.childVariant]);
    const childCopy = f.child.clone();
    childCopy.setTargetVariants([]);
    expect(f.child.getTargetVariants()).toEqual([f.childVariant]);
    const current = f.owner.store.getState();
    const changed = vi.fn();
    f.owner.store.subscribe(changed);
    f.owner.dispose();
    f.child.setTargetVariants([]);
    f.root.setTargetVariants([]);
    expect(f.owner.store.getState()).toBe(current);
    expect(changed).not.toHaveBeenCalled();
  } finally { f.dispose(); }
});


it("installs type and target projections before the first model-field callback", () => {
  const f = setup();
  try {
    f.owner.replaceFrames([f.root]);
    f.pending(true);
    const seed = f.recorder.withRecording(() => f.root.setTargetVariants([f.variant]));
    f.models.sync(seed.changes);
    f.owner.prepareCommit(); f.owner.publishCommit();
    f.pending(false);
    f.rootExists(true);
    expect(f.owner.store.getState().isEditingNonBaseVariant).toBe(true);
    const type = f.models.field(f.component, "type");
    const nativePublish = vi.fn();
    f.owner.store.subscribe(nativePublish);
    const reads: { type: string; editing: boolean; targets: readonly number[]; nativeNotifications: number }[] = [];
    type.subscribe(() => reads.push({ type: type.getState(), editing: f.owner.store.getState().isEditingNonBaseVariant, targets: f.owner.store.getState().frames[0].targets.map((ref) => ref.uid), nativeNotifications: nativePublish.mock.calls.length }));
    f.pending(true);
    const edit = f.recorder.withRecording(() => {
      f.component.type = ComponentType.Frame;
      f.frame.targetVariants = [f.component.variants[0]];
    });
    f.models.sync(edit.changes, () => f.owner.prepareModelCommit(edit.changes));
    f.owner.publishCommit();
    expect(reads).toEqual([{ type: ComponentType.Frame, editing: false, targets: [f.component.variants[0].uid], nativeNotifications: 0 }]);
    expect(nativePublish).toHaveBeenCalledOnce();
  } finally { f.dispose(); }
});

it("prepares pending frame owners before a coordinated publication and restores an abandoned prepared snapshot", () => {
  const f = setup();
  try {
    const original = f.owner.store.getState(); const changed = vi.fn(); const stop = f.owner.store.subscribe(changed);
    expect(() => f.owner.deferPublication(() => f.owner.transaction(() => {
      f.owner.replaceFrames([f.child]); f.owner.setShowDefaultSlots(true); f.owner.prepareCommit();
      expect(f.owner.store.getState().frames[0].tpl).toBe(f.models.ref(f.child.tplComponent)); expect(f.owner.store.getState().showDefaultSlots).toBe(true); expect(changed).not.toHaveBeenCalled();
      throw new Error("abandoned prepared variants");
    }))).toThrow("abandoned prepared variants");
    expect(f.owner.store.getState()).toBe(original); expect(f.owner.frames()).toEqual([f.root, f.child]); expect(changed).not.toHaveBeenCalled();
    stop();
  } finally { f.dispose(); }
});
