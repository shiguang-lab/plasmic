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
import { runInNewContext } from "node:vm";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { instUtil } from "@/wab/shared/model/InstUtil";

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

it("owns structured default schemas from a separate development Host window before observing the model", () => {
  const external = runInNewContext('({type:"text",tag:"span",elementName:"Brand",value:"客服中心",styles:{width:"100%",height:"100%"}})');
  expect(external.constructor).not.toBe(Object);
  const { site, component } = fixture("Old brand");
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  try {
    const defaults = extractDefaultSlotContents({ name: "Button", importPath: "./Button", props: { children: { type: "slot", defaultValue: external } } });
    expect(defaults.children).toEqual(external);
    expect(defaults.children).not.toBe(external);
    expect(defaults.children.constructor).toBe(Object);
    expect((defaults.children as { styles: object }).styles.constructor).toBe(Object);
    expect(() => recorder.withRecording(() => { component.codeComponentMeta.defaultSlotContents = defaults; })).not.toThrow();
  } finally { recorder.dispose(); }
});

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
