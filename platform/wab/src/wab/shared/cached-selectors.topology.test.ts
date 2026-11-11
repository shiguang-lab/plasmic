import { collectAffectedComponents, flattenComponent } from "@/wab/shared/cached-selectors";
import { ensureVariantSetting, mkBaseVariant } from "@/wab/shared/Variants";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { mkParam } from "@/wab/shared/core/lang";
import { mkSlot, mkTplComponent, mkTplTagX } from "@/wab/shared/core/tpls";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { ensureKnownRenderExpr, ensureKnownSlotParam } from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";

it("retains topology across labels/styles and updates children, slots, roots and rollback synchronously", () => {
  const base = mkBaseVariant();
  const child = mkTplTagX("span", { baseVariant: base });
  const root = mkTplTagX("div", { baseVariant: base }, [child]);
  ensureVariantSetting(root, [base]);
  const owner = mkComponent({ name: "Owner", type: ComponentType.Plain, variants: [base], tplTree: root });
  const other = mkComponent({ name: "Other", type: ComponentType.Plain, tplTree: mkTplTagX("div") });
  const site = createSite(); site.components.push(owner, other);
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  try {
    const initial = flattenComponent(owner);
    recorder.withRecording(() => { other.name = "Unrelated rename"; root.vsettings[0].rs.values.color = "red"; child.name = "Label"; });
    expect(flattenComponent(owner)).toBe(initial);
    const param = ensureKnownSlotParam(mkParam({ name: "children", paramType: "slot", type: typeFactory.renderable() }));
    const fallback = mkTplTagX("span", { baseVariant: base });
    const slot = mkSlot(param, [fallback]); slot.parent = root;
    recorder.withRecording(() => { owner.params.push(param); root.children.push(slot); });
    expect(flattenComponent(owner)).toEqual([root, child, slot, fallback]);
    expect(() => recorder.withRecording(() => {
      slot.defaultContents.splice(0, 1);
      expect(flattenComponent(owner)).toEqual([root, child, slot]);
      throw new Error("rollback");
    })).toThrow("rollback");
    expect(flattenComponent(owner)).toEqual([root, child, slot, fallback]);
    const replacement = mkTplTagX("div", { baseVariant: base });
    recorder.withRecording(() => { owner.params = []; owner.tplTree = replacement; expect(flattenComponent(owner)).toEqual([replacement]); });
  } finally { recorder.dispose(); }
});

it("computes complete referencer closures across cycles and acyclic branches", () => {
  const site = createSite();
  const [a, b, before, after, next, leaf, self] = [
    "A", "B", "Before", "After", "Next", "Leaf", "Self",
  ].map((name) =>
    mkComponent({ name, type: ComponentType.Plain, tplTree: mkTplTagX("div") }),
  );
  a.tplTree = mkTplTagX("div", {}, [
    mkTplComponent(b, a.variants[0]),
    mkTplComponent(before, a.variants[0]),
  ]);
  b.tplTree = mkTplComponent(a, b.variants[0]);
  after.tplTree = mkTplComponent(a, after.variants[0]);
  next.tplTree = mkTplComponent(after, next.variants[0]);
  leaf.tplTree = mkTplComponent(next, leaf.variants[0]);
  self.tplTree = mkTplComponent(self, self.variants[0]);
  site.components.push(a, b, before, after, next, leaf, self);

  expect(collectAffectedComponents(site, [a])).toEqual(new Set([a, b, after, next, leaf]));
  expect(collectAffectedComponents(site, [before, self])).toEqual(
    new Set([before, self, a, b, after, next, leaf]),
  );
  expect(collectAffectedComponents(site, [after])).toEqual(new Set([after, next, leaf]));
  expect(collectAffectedComponents(site, [leaf])).toEqual(new Set([leaf]));
});

it("invalidates component slot topology when arguments or registered slot types change", () => {
  const base = mkBaseVariant();
  const code = mkCodeComponent("Wrapper", { name: "Wrapper", importPath: "test", props: {} }, {});
  const param = mkParam({ name: "children", paramType: "slot", type: typeFactory.renderable() });
  code.params.push(param);
  const child = mkTplTagX("span", { baseVariant: base });
  const tpl = mkTplComponent(code, base, {}, [child]);
  const root = mkTplTagX("div", { baseVariant: base }, [tpl]);
  const owner = mkComponent({ name: "Owner", type: ComponentType.Plain, variants: [base], tplTree: root });
  const site = createSite(); site.components.push(owner, code);
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  try {
    expect(flattenComponent(owner)).toEqual([root, tpl, child]);
    const slot = ensureKnownRenderExpr(tpl.vsettings[0].args[0].expr);
    recorder.withRecording(() => { slot.tpl.splice(0, 1); expect(flattenComponent(owner)).toEqual([root, tpl]); });
    recorder.withRecording(() => { slot.tpl.push(child); });
    expect(flattenComponent(owner)).toEqual([root, tpl, child]);
    const prop = mkParam({ name: "children", paramType: "prop", type: typeFactory.text() });
    recorder.withRecording(() => {
      code.params = [prop]; tpl.vsettings[0].args[0].param = prop;
      expect(flattenComponent(owner)).toEqual([root, tpl]);
    });
    recorder.withRecording(() => { code.params = [param]; tpl.vsettings[0].args[0].param = param; });
    expect(flattenComponent(owner)).toEqual([root, tpl, child]);
  } finally { recorder.dispose(); }
});
