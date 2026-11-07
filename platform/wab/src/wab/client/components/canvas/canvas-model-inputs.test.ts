import { CanvasModelInputs } from "@/wab/client/components/canvas/canvas-model-inputs";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { mkParam } from "@/wab/shared/core/lang";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplComponentX, mkTplTagX } from "@/wab/shared/core/tpls";
import { CustomCode, ObjInst } from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";

function fixture() {
  const snapshots = new ModelSnapshots();
  const inputs = new CanvasModelInputs(snapshots);
  const publish = (inst: ObjInst, field: string) => {
    snapshots.sync([
      { type: "update", oldValue: undefined, newValue: Reflect.get(inst, field), changeNode: { inst, field } },
    ]);
    inputs.flush();
  };
  return { snapshots, inputs, publish };
}

it("prepares canvas capsules before deferred model field notifications", () => {
  const { inputs, snapshots } = fixture();
  try {
    const node = mkTplTagX("div");
    const input = inputs.node(node);
    const before = input.getState();
    const order: string[] = [];
    input.subscribe(() => order.push("canvas"));
    const fieldChanged = vi.fn(() => {
      expect(input.getState()).not.toBe(before);
      order.push("field");
    });
    snapshots.field(node, "tag").subscribe(fieldChanged);
    snapshots.deferPublication(() => {
      node.tag = "section";
      snapshots.sync([{ type: "update", oldValue: "div", newValue: "section", changeNode: { inst: node, field: "tag" } }]);
      inputs.prepareCommit();
      expect(input.getState()).not.toBe(before);
      expect(fieldChanged).not.toHaveBeenCalled();
      inputs.publishCommit();
    });
    expect(order).toEqual(["canvas", "field"]);
  } finally {
    inputs.dispose();
    snapshots.dispose();
  }
});

it("publishes declared fields without observable models and keeps unrelated nodes stable", () => {
  const { inputs, publish, snapshots } = fixture();
  const first = mkTplTagX("div"), second = mkTplTagX("span");
  const a = inputs.node(first), b = inputs.node(second);
  const before = a.getState(), other = b.getState();
  const changed = vi.fn(), untouched = vi.fn();
  a.subscribe(changed); b.subscribe(untouched);
  first.tag = "section";
  publish(first, "tag");
  expect(a.getState()).not.toBe(before);
  expect(b.getState()).toBe(other);
  expect(changed).toHaveBeenCalledTimes(1);
  expect(untouched).not.toHaveBeenCalled();
  const committed = a.getState();
  publish(first, "tag");
  expect(a.getState()).toBe(committed);
  expect(changed).toHaveBeenCalledTimes(1);
  inputs.dispose(); snapshots.dispose();
});

it("rebinds replaced expressions and shares component contracts between instances", () => {
  const { inputs, publish, snapshots } = fixture();
  const param = mkParam({ name: "label", type: typeFactory.text(), paramType: "prop" });
  const oldExpr = new CustomCode({ code: '"before"', fallback: null });
  param.defaultExpr = oldExpr;
  const component = mkComponent({ name: "Label", params: [param], type: ComponentType.Plain, tplTree: mkTplTagX("div") });
  const first = mkTplComponentX({ component, baseVariant: component.variants[0] }), second = mkTplComponentX({ component, baseVariant: component.variants[0] });
  const a = inputs.node(first), b = inputs.node(second);
  expect(inputs.component(component)).toBe(inputs.component(component));
  const aChanged = vi.fn(), bChanged = vi.fn();
  a.subscribe(aChanged); b.subscribe(bChanged);
  oldExpr.code = '"after"'; publish(oldExpr, "code");
  expect(aChanged).toHaveBeenCalledTimes(1);
  expect(bChanged).toHaveBeenCalledTimes(1);
  param.defaultExpr = new CustomCode({ code: '"replacement"', fallback: null });
  publish(param, "defaultExpr");
  expect(aChanged).toHaveBeenCalledTimes(2);
  oldExpr.code = '"obsolete"'; publish(oldExpr, "code");
  expect(aChanged).toHaveBeenCalledTimes(2);
  inputs.dispose(); snapshots.dispose();
});

it("keeps tree children in their own capsules and disposes field subscriptions", () => {
  const { inputs, publish, snapshots } = fixture();
  const child = mkTplTagX("span"), parent = mkTplTagX("div", {}, [child]);
  expect(parent.children).toEqual([child]);
  const a = inputs.node(parent), b = inputs.node(child);
  const parentBefore = a.getState(), changed = vi.fn();
  b.subscribe(changed);
  child.tag = "label"; publish(child, "tag");
  expect(a.getState()).toBe(parentBefore);
  expect(changed).toHaveBeenCalledTimes(1);
  inputs.dispose();
  child.tag = "strong"; publish(child, "tag");
  expect(changed).toHaveBeenCalledTimes(1);
  snapshots.dispose();
});

it("declares linked variant state and parameter fields without walking component trees", () => {
  const { inputs, snapshots } = fixture();
  const site = createSite(), manager = new TplMgr({ site });
  const component = manager.addComponent();
  const group = manager.createVariantGroup({ component, name: "Choice" });
  manager.createVariant(component, group, "One");
  expect(() => inputs.component(component)).not.toThrow();
  inputs.dispose(); snapshots.dispose();
});

it("installs parent and shared component changes atomically before notifying any subscriber", () => {
  const { inputs, snapshots } = fixture();
  const component = mkComponent({ name: "Before", type: ComponentType.Plain, tplTree: mkTplTagX("div") });
  const node = mkTplComponentX({ component, baseVariant: component.variants[0] });
  const a = inputs.node(node), contract = inputs.component(component);
  const before = a.getState(), componentBefore = contract.getState();
  const observed: [readonly unknown[], readonly unknown[]][] = [];
  a.subscribe(() => observed.push([a.getState(), contract.getState()]));
  contract.subscribe(() => observed.push([a.getState(), contract.getState()]));
  node.name = "After";
  component.name = "After";
  snapshots.sync([
    { type: "update", oldValue: undefined, newValue: node.name, changeNode: { inst: node, field: "name" } },
    { type: "update", oldValue: "Before", newValue: component.name, changeNode: { inst: component, field: "name" } },
  ]);
  expect(a.getState()).toBe(before);
  expect(contract.getState()).toBe(componentBefore);
  inputs.flush();
  expect(observed).toHaveLength(2);
  for (const [nodeSnapshot, componentSnapshot] of observed) {
    expect(nodeSnapshot).toBe(a.getState());
    expect(componentSnapshot).toBe(contract.getState());
    expect(nodeSnapshot).not.toBe(before);
    expect(componentSnapshot).not.toBe(componentBefore);
  }
  inputs.dispose(); snapshots.dispose();
});
