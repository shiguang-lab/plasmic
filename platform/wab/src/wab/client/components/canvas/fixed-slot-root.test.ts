import { isFixedRootSlot, isFixedSlotRoot } from "@/wab/client/components/canvas/fixed-slot-root";
import { ViewOps } from "@/wab/client/components/canvas/view-ops";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { _testOnlyUtils } from "@/wab/client/components/sidebar-tabs/OutlineCtx";
import { CodeComponentsRegistry, elementSchemaToTpl, mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { RSH } from "@/wab/shared/RuleSetHelpers";
import { validateStylesForTpl } from "@/wab/shared/core/style-props-tpl";
import { mkBaseVariant } from "@/wab/shared/Variants";
import { mkParam } from "@/wab/shared/core/lang";
import { createSite } from "@/wab/shared/core/sites";
import { SlotSelection } from "@/wab/shared/core/slots";
import { mkTplComponent, mkTplTagX } from "@/wab/shared/core/tpls";
import { ValTextTag } from "@/wab/shared/core/val-nodes";
import { Arg, RenderExpr } from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";
import { mock } from "vitest-mock-extended";

function fixture() {
  const site = createSite();
  const component = mkCodeComponent("Shell", { name: "Shell", importPath: "./Shell", props: {} }, {});
  const param = mkParam({ name: "brand", paramType: "slot", type: typeFactory.renderable() });
  component.params.push(param);
  const owner = mkTplComponent(component, mkBaseVariant(), []);
  const brand = elementSchemaToTpl(site, undefined, { type: "text", tag: "span", elementName: "Brand", value: "客服中心", styles: { width: "100%", height: "100%" } }, { codeComponentsOnly: true })._unsafeUnwrap().tpl;
  const arg = new Arg({ param, expr: new RenderExpr({ tpl: [brand] }) });
  owner.vsettings[0].args.push(arg); brand.parent = owner;
  const slot = new SlotSelection({ tpl: owner, slotParam: param });
  const view = mock<ViewCtx>();
  const meta = { props: { brand: { type: "slot", fixedRoot: true } } } as any;
  view.getCodeComponentMeta.mockReturnValue(meta);
  view.focusedTpl.mockReturnValue(brand);
  view.focusedTplsOrSlotSelections.mockReturnValue([brand]);
  view.effectiveCurrentVariantSetting.mockReturnValue({ args: [arg] } as any);
  view.componentStackFrames.mockReturnValue([]);
  Reflect.set(view, "studioCtx", { getCodeComponentMeta: () => meta });
  return { brand, owner, slot, view, meta };
}

it("keeps one real named span in the slot and makes the slot transparent in Layers", () => {
  const { brand, owner, slot, view } = fixture();
  expect(brand).toMatchObject({ tag: "span", name: "Brand" });
  expect(isFixedRootSlot(view, slot)).toBe(true);
  expect(isFixedSlotRoot(view, brand)).toBe(true);
  const child = mkTplTagX("span"); child.parent = brand;
  expect(isFixedSlotRoot(view, child)).toBe(false);
  expect(_testOnlyUtils.getTreeNodeChildren(view, owner, 0, owner).children).toEqual([brand]);
});

it("blocks deletion, movement and resizing while leaving the actual text node selected", async () => {
  const { brand, slot, view } = fixture();
  const value = new ValTextTag({ tpl: brand } as any);
  view.focusedSelectable.mockReturnValue(value);
  const ops = new ViewOps({ viewCtx: view });
  await ops.tryDelete({ tpl: brand });
  await ops.tryDelete({ tpl: slot });
  ops.nudgePosition("right");
  ops.nudgeSize("width", true);
  ops.autoSizeFocused();
  ops.setStackLayout(brand, "flex-row");
  ops.convertToLink(brand);
  ops.ungroup(brand);
  await ops.wrapInContainer("flex-row", brand);
  await ops.wrapInComponent(brand);
  await ops.extractComponent(brand);
  expect(view.change).not.toHaveBeenCalled();
  expect(view.focusedSelectable()).toBe(value);
  expect(brand.parent).toBe(slot.getTpl());
});

it("focuses the fixed span directly without promoting selection to the owning component", () => {
  const { brand, view } = fixture();
  const value = new ValTextTag({ tpl: brand } as any);
  const ops = new ViewOps({ viewCtx: view });
  const bestFocusTarget = vi.fn(() => ({ focusTarget: value }));
  vi.spyOn(ops as any, "focusHeuristics").mockReturnValue({ bestFocusTarget });
  const result = Reflect.get(ops, "resolveFocusTarget").call(ops, value, { exact: false });
  expect(result.focusTarget).toBe(value);
  expect(bestFocusTarget).toHaveBeenCalledWith(value, expect.objectContaining({ exact: true }));
});

it("locks every style for a registered fixed span while ordinary spans keep their style properties", () => {
  const { brand, owner, meta } = fixture();
  const registry = mock<CodeComponentsRegistry>();
  registry.getRegisteredCodeComponentsMap.mockReturnValue(new Map([[owner.component.name, { meta }]]) as any);
  const styles = { width: "300px", height: "64px", color: "red", fontSize: "40px" };
  expect(validateStylesForTpl(styles, brand, RSH(brand.vsettings[0].rs, brand), registry)).toEqual({ valid: {}, invalid: styles });
  const ordinarySpan = mkTplTagX("span");
  expect(validateStylesForTpl(styles, ordinarySpan, RSH(brand.vsettings[0].rs, ordinarySpan), registry)).toEqual({ valid: styles, invalid: {} });
});
