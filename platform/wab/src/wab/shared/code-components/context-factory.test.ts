import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { ContextFactory } from "@/wab/shared/code-components/context-factory";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { codeLit } from "@/wab/shared/core/exprs";
import { mkParam } from "@/wab/shared/core/lang";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplComponent, mkTplComponentX, mkTplTagX } from "@/wab/shared/core/tpls";
import { ensureKnownRenderExpr, ensureKnownTplComponent, type TplComponent } from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";
import { isInstrumentedModel } from "@/wab/shared/core/model-mutations";

function provider(name: string) {
  const children = mkParam({ name: "children", type: typeFactory.renderable(), paramType: "slot" });
  const label = mkParam({ name: "label", type: typeFactory.text(), paramType: "prop" });
  const component = mkCodeComponent(name, { name, importPath: `./${name}`, props: { label: "string" } }, {});
  component.params.push(children, label);
  const tpl = mkTplComponentX({ component, baseVariant: component.variants[0], args: { label: codeLit(name) } });
  return { component, tpl, label };
}

function child(tpl: TplComponent) {
  const arg = tpl.vsettings[0].args.find((candidate) => candidate.param.variable.name === "children");
  if (!arg) { throw new Error("Expected provider children argument"); }
  return ensureKnownRenderExpr(arg.expr).tpl[0];
}

it("reuses nonobservable provider clones, reports authored argument updates and retains no-op identity", () => {
  const site = createSite(), first = provider("First"), second = provider("Second");
  const rootComponent = mkComponent({ name: "Root", type: ComponentType.Plain, tplTree: mkTplTagX("main") });
  const root = mkTplComponent(rootComponent, rootComponent.variants[0]);
  const parent = mkTplTagX("section"); root.parent = parent;
  const factory = new ContextFactory(site);
  const update = factory.wrap(root, [first.tpl, second.tpl]);
  const outer = update.root, inner = ensureKnownTplComponent(child(outer));
  expect(outer).not.toBe(first.tpl); expect(outer.uuid).toBe(first.tpl.uuid);
  expect(inner).not.toBe(second.tpl); expect(inner.uuid).toBe(second.tpl.uuid);
  expect(child(inner)).toBe(root); expect(root.parent).toBe(parent);
  expect(isInstrumentedModel(outer)).toBe(false);
  expect(isInstrumentedModel(outer.vsettings[0])).toBe(false);
  expect(outer.vsettings[0].args.every((arg) => !isInstrumentedModel(arg))).toBe(true);
  const clean = factory.wrap(root, [first.tpl, second.tpl]);
  expect(clean.root).toBe(outer); expect(clean.changes).toEqual([]);
  const original = first.tpl.vsettings[0].args[0].expr;
  first.tpl.vsettings[0].args[0].expr = codeLit("Changed");
  const changed = factory.wrap(root, [first.tpl, second.tpl]);
  const actual = outer.vsettings[0].args.find((arg) => arg.param === first.label);
  expect(changed.root).toBe(outer);
  expect(changed.changes.some((change) => change.changeNode.inst === actual && change.changeNode.field === "expr")).toBe(true);
  expect(actual?.expr).not.toBe(first.tpl.vsettings[0].args[0].expr);
  expect(first.tpl.vsettings[0].args).toHaveLength(1);
  expect(original).not.toBe(first.tpl.vsettings[0].args[0].expr);
  expect(root.parent).toBe(parent);
  factory.dispose();
});

it("updates provider order and parent links without rewriting the business root or source contexts", () => {
  const first = provider("First"), second = provider("Second"), site = createSite();
  const component = mkComponent({ name: "Root", type: ComponentType.Plain, tplTree: mkTplTagX("main") });
  const root = mkTplComponent(component, component.variants[0]);
  const initialParent = root.parent, factory = new ContextFactory(site);
  const a = factory.wrap(root, [first.tpl, second.tpl]).root;
  const b = ensureKnownTplComponent(child(a));
  const reordered = factory.wrap(root, [second.tpl, first.tpl]);
  expect(reordered.root).toBe(b); expect(child(b)).toBe(a); expect(child(a)).toBe(root);
  expect(b.parent).toBeNull(); expect(a.parent).toBe(b);
  expect(root.parent).toBe(initialParent);
  expect(first.tpl.parent).toBeNull(); expect(second.tpl.parent).toBeNull();
  expect(first.tpl.vsettings[0].args).toHaveLength(1); expect(second.tpl.vsettings[0].args).toHaveLength(1);
  expect(factory.wrap(root, []).root).toBe(root);
  factory.dispose();
  expect(() => factory.wrap(root, [first.tpl])).toThrow("disposed context factory");
});
