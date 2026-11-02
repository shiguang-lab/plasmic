import { fillCodeComponentDefaultSlotContent } from "@/wab/shared/SlotUtils";
import { $$$ } from "@/wab/shared/TplQuery";
import { mkBaseVariant } from "@/wab/shared/Variants";
import { elementSchemaToTpl, extractDefaultSlotContents, mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { tryExtractJson } from "@/wab/shared/core/exprs";
import { mkParam } from "@/wab/shared/core/lang";
import { createSite } from "@/wab/shared/core/sites";
import { flattenTpls, isTplCodeComponent, mkTplComponent, trackComponentSite } from "@/wab/shared/core/tpls";
import { assert } from "@/wab/shared/common";
import { isKnownRenderExpr } from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";

function fixture(defaultValue: string | { type: "text"; value: string }) {
  const site = createSite();
  const meta = { name: "Button", importPath: "./Button", props: { children: { type: "slot" as const, defaultValue, mergeWithParent: true } } };
  const component = mkCodeComponent("Button", meta, {});
  component.params.push(mkParam({ name: "children", paramType: "slot", type: typeFactory.renderable(), mergeWithParent: true }));
  component.codeComponentMeta.defaultSlotContents = extractDefaultSlotContents(meta);
  site.components.push(component);
  trackComponentSite(component, site);
  const tpl = mkTplComponent(component, mkBaseVariant(), []);
  assert(isTplCodeComponent(tpl), "Button must be a code component");
  return { site, component, tpl };
}

it.each(["新建模板", ""])("creates a primitive default slot without text elements: %j", (text) => {
  const { component, tpl } = fixture(text);
  fillCodeComponentDefaultSlotContent(tpl, "children", tpl.vsettings[0].variants[0]);
  const expr = $$$(tpl).getSlotArg("children")?.expr;
  expect(component.params[0].type.name).toBe("renderable");
  expect(isKnownRenderExpr(expr)).toBe(false);
  expect(expr && tryExtractJson(expr)).toBe(text);
  expect(flattenTpls(tpl)).toEqual([tpl]);
  expect($$$(tpl).slot("children").children().toArray()).toEqual([]);
});

it("keeps structured slot defaults as editable elements", () => {
  const { tpl } = fixture({ type: "text", value: "Custom content" });
  fillCodeComponentDefaultSlotContent(tpl, "children", tpl.vsettings[0].variants[0]);
  const expr = $$$(tpl).getSlotArg("children")?.expr;
  expect(isKnownRenderExpr(expr)).toBe(true);
  expect(flattenTpls(tpl)).toHaveLength(2);
});

it("accepts an explicit string slot in a component schema without creating a wrapper", () => {
  const { site, component } = fixture("Button");
  const result = elementSchemaToTpl(site, undefined, { type: "component", name: "Button", props: { children: "新建模板" } }, { codeComponentsOnly: true });
  if (result.isErr()) { throw result.error; }
  expect(flattenTpls(result.value.tpl)).toHaveLength(1);
  expect(tryExtractJson($$$(result.value.tpl).getSlotArg("children")!.expr)).toBe("新建模板");
});
