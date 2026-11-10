import { CanvasSelectionInputs } from "@/wab/client/components/canvas/canvas-selection-inputs";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { ViewSelection } from "@/wab/client/studio-ctx/view-selection";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { mkParam } from "@/wab/shared/core/lang";
import { typeFactory } from "@/wab/shared/model/model-util";
import { SlotSelection } from "@/wab/shared/core/slots";
import { mkTplComponent, mkTplTagX } from "@/wab/shared/core/tpls";
import { Arg, RenderExpr, type ObjInst } from "@/wab/shared/model/classes";

function fixture() {
  const models = new ModelSnapshots();
  const selection = new ViewSelection(() => models);
  const mode = { pending: false };
  const view = { selectionStore: selection.store,
    studioCtx: { modelSnapshots: models, hasPendingModelChanges: () => mode.pending },
  } as unknown as ViewCtx;
  const inputs = new CanvasSelectionInputs(view, false);
  const commit = (changes: { inst: ObjInst; field: string }[] = []) => {
    models.sync(changes.map(({ inst, field }) => ({
      type: "update", oldValue: undefined, newValue: Reflect.get(inst, field), changeNode: { inst, field },
    })));
    inputs.prepareCommit(); inputs.publishCommit();
  };
  return { models, selection, mode, inputs, commit,
    dispose: () => { inputs.dispose(); selection.dispose(); models.dispose(); } };
}

it("publishes only nodes whose selected result changed and ignores hover/DOM-only input", () => {
  const f = fixture();
  const a = mkTplTagX("div"), b = mkTplTagX("span"), other = mkTplTagX("i");
  const first = f.inputs.node(a, a.uuid), second = f.inputs.node(b, b.uuid), untouched = f.inputs.node(other, other.uuid);
  const before = untouched.getState(), noChange = vi.fn(); untouched.subscribe(noChange);
  f.selection.setTpls([a]);
  expect(first.getState().isSelected).toBe(true);
  expect(second.getState().isSelected).toBe(false);
  const firstSelected = first.getState();
  f.selection.setCloneKeys(["clone"]);
  f.selection.setDoms([null]);
  f.selection.setHover(undefined, undefined);
  expect(first.getState()).toBe(firstSelected);
  f.selection.setTpls([b]);
  expect(first.getState().isSelected).toBe(false);
  expect(second.getState().isSelected).toBe(true);
  expect(untouched.getState()).toBe(before);
  expect(noChange).not.toHaveBeenCalled();
  f.dispose();
});

it("rebuilds ancestry after a native reparent commit with unchanged selection identity and installs nodes atomically", () => {
  const f = fixture();
  const child = mkTplTagX("span"), first = mkTplTagX("div", {}, [child]), second = mkTplTagX("section");
  expect(child.parent).toBe(first);
  f.selection.setTpls([child]);
  const a = f.inputs.node(first, first.uuid), b = f.inputs.node(second, second.uuid);
  expect(a.getState().isSelected).toBe(true);
  const observed: boolean[][] = [];
  a.subscribe(() => observed.push([a.getState().isSelected, b.getState().isSelected]));
  b.subscribe(() => observed.push([a.getState().isSelected, b.getState().isSelected]));
  const before = f.selection.store.getState().tpls;
  first.children = []; second.children = [child]; child.parent = second;
  f.commit([{ inst: child, field: "parent" }, { inst: first, field: "children" }, { inst: second, field: "children" }]);
  expect(f.selection.store.getState().tpls).toBe(before);
  expect(observed).toEqual([[false, true], [false, true]]);
  f.dispose();
});

it("tracks slot names by declared variable fields and clears disabled auto-open through the native source", () => {
  const f = fixture();
  const component = mkCodeComponent("Widget", { name: "Widget", importPath: "./Widget", props: { content: "slot" } }, {});
  const param = mkParam({ name: "content", type: typeFactory.renderable(), paramType: "slot" });
  component.params.push(param);
  const tpl = mkTplComponent(component, component.variants[0]);
  f.selection.setTargets([new SlotSelection({ tpl, slotParam: param })]);
  const input = f.inputs.node(tpl, tpl.uuid);
  expect(input.getState()).toEqual({ id: tpl.uuid, isSelected: true, selectedSlotName: "content" });
  param.variable.name = "body";
  f.commit([{ inst: param.variable, field: "name" }]);
  expect(input.getState().selectedSlotName).toBe("body");
  f.selection.setDisabledAutoOpen(tpl.uuid);
  expect(input.getState().isSelected).toBe(false);
  f.selection.setDisabledAutoOpen(undefined);
  expect(input.getState().isSelected).toBe(true);
  const changed = vi.fn(); input.subscribe(changed);
  f.inputs.dispose();
  f.selection.setTpls([]); f.selection.setTargets([]);
  param.variable.name = "unused"; f.commit([{ inst: param.variable, field: "name" }]);
  expect(changed).not.toHaveBeenCalled();
  f.dispose();
});

it("uses the shared slot reveal path for a presentation target while preserving inspector selection and ancestry", () => {
  const f = fixture();
  const component = mkCodeComponent("Widget", { name: "Widget", importPath: "./Widget", props: { content: "slot" } }, {});
  const param = mkParam({ name: "content", type: typeFactory.renderable(), paramType: "slot" });
  component.params.push(param);
  const child = mkTplTagX("span");
  const tpl = mkTplComponent(component, component.variants[0]);
  tpl.vsettings[0].args.push(new Arg({ param, expr: new RenderExpr({ tpl: [child] }) }));
  child.parent = tpl;
  const selected = mkTplTagX("i");
  f.selection.setTpls([selected]);
  const selection = f.selection.store.getState();
  const ancestry = f.inputs.ancestryStore.getState();
  const input = f.inputs.node(tpl, tpl.uuid);
  f.inputs.setRevealTarget(child);
  expect(input.getState()).toEqual({ id: tpl.uuid, isSelected: true, selectedSlotName: "content" });
  expect(f.selection.store.getState()).toBe(selection);
  expect(f.inputs.ancestryStore.getState()).toBe(ancestry);
  param.variable.name = "body";
  f.commit([{ inst: param.variable, field: "name" }]);
  expect(input.getState().selectedSlotName).toBe("body");
  f.selection.setTpls([mkTplTagX("b")]);
  expect(input.getState().isSelected).toBe(false);
  f.dispose();
});

it("defers logical selection changes until the surrounding model transaction commits", () => {
  const f = fixture();
  const node = mkTplTagX("div");
  const input = f.inputs.node(node, node.uuid);
  const changed = vi.fn(); input.subscribe(changed);
  f.mode.pending = true;
  f.selection.transaction(() => { f.selection.setTpls([node]); f.selection.setCloneKeys(["instance"]); });
  expect(input.getState().isSelected).toBe(false);
  expect(changed).not.toHaveBeenCalled();
  f.commit();
  expect(input.getState().isSelected).toBe(true);
  expect(changed).toHaveBeenCalledTimes(1);
  f.dispose();
});

it("prepares all drag selection values before notification and preserves unrelated nodes and disposal", () => {
  const f = fixture(), selected = mkTplTagX("div"), sibling = mkTplTagX("span");
  f.selection.setTpls([selected]);
  const node = f.inputs.node(selected, selected.uuid), other = f.inputs.node(sibling, sibling.uuid);
  const before = node.getState(), siblingBefore = other.getState(), observed = vi.fn(), unrelated = vi.fn();
  node.subscribe(observed); other.subscribe(unrelated);
  const prepare = vi.fn((changed) => {
    expect(changed.has(node)).toBe(true); expect(changed.has(other)).toBe(false);
    expect(node.getState().isSelected).toBe(false);
    expect(observed).not.toHaveBeenCalled();
    return vi.fn();
  });
  const stop = f.inputs.subscribeBeforePublish(prepare);
  const publish = f.inputs.prepareDraggingObject(true);
  expect(prepare).toHaveBeenCalledTimes(1);
  expect(node.getState().isSelected).toBe(false); expect(observed).not.toHaveBeenCalled();
  publish(); expect(observed).toHaveBeenCalledTimes(1);
  f.inputs.prepareDraggingObject(true)(); expect(observed).toHaveBeenCalledTimes(1);
  stop();
  f.inputs.prepareDraggingObject(false)();
  expect(node.getState().isSelected).toBe(true);
  expect(other.getState()).toBe(siblingBefore); expect(unrelated).not.toHaveBeenCalled();
  expect(before.isSelected).toBe(true);
  const total = observed.mock.calls.length;
  const abandoned = f.inputs.prepareDraggingObject(true);
  f.dispose(); abandoned();
  f.inputs.prepareDraggingObject(true)(); expect(observed).toHaveBeenCalledTimes(total);
});

it("prepares reparented paths before deferred public model fields notify", () => {
  const f = fixture();
  const child = mkTplTagX("span"), first = mkTplTagX("div", {}, [child]), second = mkTplTagX("section");
  f.selection.setTpls([child]);
  const a = f.inputs.node(first, first.uuid), b = f.inputs.node(second, second.uuid);
  const publicField = f.models.field(child, "parent"), notified = vi.fn(); publicField.subscribe(notified);
  try {
    f.models.deferPublication(() => {
      first.children = []; second.children = [child]; child.parent = second;
      f.commit([{ inst: child, field: "parent" }, { inst: first, field: "children" }, { inst: second, field: "children" }]);
      expect(publicField.getState()).toBe(f.models.ref(second));
      expect(notified).not.toHaveBeenCalled();
      expect([a.getState().isSelected, b.getState().isSelected]).toEqual([false, true]);
    });
    expect(notified).toHaveBeenCalledOnce();
  } finally { f.dispose(); }
});

it("prepares renamed slot inputs before deferred public variable fields notify", () => {
  const f = fixture();
  const component = mkCodeComponent("Widget", { name: "Widget", importPath: "./Widget", props: { content: "slot" } }, {});
  const param = mkParam({ name: "content", type: typeFactory.renderable(), paramType: "slot" }); component.params.push(param);
  const tpl = mkTplComponent(component, component.variants[0]);
  f.selection.setTargets([new SlotSelection({ tpl, slotParam: param })]);
  const input = f.inputs.node(tpl, tpl.uuid);
  const publicField = f.models.field(param.variable, "name"), notified = vi.fn(); publicField.subscribe(notified);
  try {
    f.models.deferPublication(() => {
      param.variable.name = "body";
      f.commit([{ inst: param.variable, field: "name" }]);
      expect(publicField.getState()).toBe("body");
      expect(notified).not.toHaveBeenCalled();
      expect(input.getState().selectedSlotName).toBe("body");
    });
    expect(notified).toHaveBeenCalledOnce();
  } finally { f.dispose(); }
});


it("publishes the original normalized tpl ancestry after cache preparation even when auto-open is disabled", () => {
  const f = fixture();
  const child = mkTplTagX("span"), first = mkTplTagX("div", {}, [child]), second = mkTplTagX("section");
  f.selection.setDisabledAutoOpen(child.uuid); f.selection.setTpls([child]);
  const path = f.inputs.ancestryStore, initial = path.getState();
  expect(initial).toEqual([f.models.ref(child), f.models.ref(first)]);
  const phases: string[] = [];
  f.inputs.subscribeBeforePublish(() => { phases.push("cache"); return () => { phases.push("cache-notify"); }; });
  const checked = vi.fn(() => {
    phases.push("session");
    expect(path.getState()).toEqual([f.models.ref(child), f.models.ref(second)]);
  });
  f.inputs.subscribeAncestryBeforePublish(checked);
  path.subscribe(() => { phases.push("path"); });
  f.models.deferPublication(() => {
    first.children = []; second.children = [child]; child.parent = second;
    const field = f.models.field(child, "parent");
    field.subscribe(() => expect(path.getState()).toEqual([f.models.ref(child), f.models.ref(second)]));
    f.commit([{ inst: child, field: "parent" }]);
  });
  expect(checked).toHaveBeenCalledOnce();
  expect(phases).toEqual(["cache", "session", "path", "cache-notify"]);
  const stable = path.getState();
  f.selection.setDisabledAutoOpen(undefined); f.selection.setDoms([null]); f.commit();
  expect(path.getState()).toBe(stable); expect(checked).toHaveBeenCalledOnce();
  f.dispose();
  expect(path.getState()).toBe(stable);
});
