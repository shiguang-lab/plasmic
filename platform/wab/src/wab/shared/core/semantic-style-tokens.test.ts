import { mkStyleToken, mkTokenRef } from "@/wab/commons/StyleToken";
import { extractUsedTokensForComponents } from "@/wab/shared/codegen/style-tokens";
import { ensure } from "@/wab/shared/common";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { getRawCode, serCompositeExprMaybe, tryExtractJson } from "@/wab/shared/core/exprs";
import { mkParam } from "@/wab/shared/core/lang";
import { createSite } from "@/wab/shared/core/sites";
import { changeTokenUsage, extractTokenUsages } from "@/wab/shared/core/styles";
import { mkTplComponent, mkTplTagX } from "@/wab/shared/core/tpls";
import { getProjectFlags } from "@/wab/shared/devflags";
import { evalCodeWithEnv } from "@/wab/shared/eval";
import { ObjectPath, StyleTokenRef, ensureKnownObjectPath, ensureKnownTplComponent } from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";

it.each([false, true])("tracks, exports, replaces and inlines nested color tokens (fallback=%s)", (fallback) => {
  const first = mkStyleToken({ name: "First", type: "Color", value: "#112233" });
  const second = mkStyleToken({ name: "Second", type: "Color", value: "#445566" });
  const composite = serCompositeExprMaybe({
    root: { color: new StyleTokenRef({ token: first }), paddingBlock: 12 },
    body: { backgroundColor: new StyleTokenRef({ token: first }) },
  });
  const component = mkComponent({
    name: "Card", type: ComponentType.Plain, tplTree: mkTplTagX("div"),
    params: [mkParam({ name: "styles", type: typeFactory.any(), paramType: "prop" })],
  });
  const owner = mkComponent({ name: "Page", type: ComponentType.Plain,
    tplTree: (base) => mkTplComponent(component, base, {
      styles: fallback ? new ObjectPath({ path: ["$ctx", "styles"], fallback: composite }) : composite,
    }),
  });
  const site = createSite({ components: [owner, component], styleTokens: [first, second] });
  const arg = ensure(ensureKnownTplComponent(owner.tplTree).vsettings[0].args[0], "Styles argument");
  const used = () => extractUsedTokensForComponents(site, [owner], { expandMixins: true, derefTokens: false });
  expect(used()).toEqual(new Set([first]));
  const [usages, summary] = extractTokenUsages(site, first);
  expect(usages.size).toBe(1);
  expect(summary.components).toEqual([owner]);
  const runtimeValue = () => evalCodeWithEnv(getRawCode(arg.expr, { component: owner, projectFlags: getProjectFlags(site), inStudio: false }), { $ctx: null });
  expect(runtimeValue()).toEqual({ root: { color: mkTokenRef(first), paddingBlock: 12 }, body: { backgroundColor: mkTokenRef(first) } });
  for (const usage of usages) { changeTokenUsage(site, first, usage, second); }
  expect(used()).toEqual(new Set([second]));
  expect(extractTokenUsages(site, first)[0].size).toBe(0);
  expect(runtimeValue()).toEqual({ root: { color: mkTokenRef(second), paddingBlock: 12 }, body: { backgroundColor: mkTokenRef(second) } });
  for (const usage of extractTokenUsages(site, second)[0]) { changeTokenUsage(site, second, usage, "inline"); }
  expect(used().size).toBe(0);
  expect(runtimeValue()).toEqual({ root: { color: "#445566", paddingBlock: 12 }, body: { backgroundColor: "#445566" } });
  const literal = fallback ? ensure(ensureKnownObjectPath(arg.expr).fallback, "Fallback") : arg.expr;
  expect(tryExtractJson(literal)).toEqual(runtimeValue());
});
