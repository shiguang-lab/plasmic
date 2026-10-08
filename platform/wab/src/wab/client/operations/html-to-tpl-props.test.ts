import { setupComponentWithTplTree } from "@/wab/client/operations/__testonly__/utils";
import { getComponentArgFromHtmlProp } from "@/wab/client/operations/html-to-tpl";
import { asCode, tryExtractJson } from "@/wab/shared/core/exprs";
import { mkParam } from "@/wab/shared/core/lang";
import * as Tpls from "@/wab/shared/core/tpls";
import { ensureKnownCompositeExpr } from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";

function setup(name: string, value: any) {
  const { component, site } = setupComponentWithTplTree(Tpls.mkTplTagX("div", {}));
  component.params.push(mkParam({ name, type: typeFactory.any(), paramType: "prop" }));
  const result = getComponentArgFromHtmlProp(site, component, component.name, name, value);
  expect(result.isOk()).toBe(true);
  return { component, expr: result._unsafeUnwrap()[1] };
}

test("structured form props retain executable nested bindings", () => {
  const { component, expr } = setup("rules", [
    { ruleType: "required", message: "Enter a key" },
    { ruleType: "advanced", custom: "{{ (_rule,value)=>!$state.rows.some(row=>row.key===value) }}", message: "Duplicate key" },
  ]);
  const composite = ensureKnownCompositeExpr(expr);
  expect(JSON.parse(composite.hostLiteral)[0]).toEqual({ ruleType: "required", message: "Enter a key" });
  const validatorCode = asCode(composite.substitutions['[1]["custom"]'], { component, inStudio: true, projectFlags: {} }).code;
  const validator = new Function("$state", `return ${validatorCode}`)({ rows: [{ key: "existing" }] });
  expect(validator({}, "existing")).toBe(false);
  expect(validator({}, "new")).toBe(true);
  const initial = ensureKnownCompositeExpr(setup("initialValues", { name: "{{ $ctx.query?.name || 'Audience' }}", expiry: 14 }).expr);
  expect(JSON.parse(initial.hostLiteral)).toEqual({ name: null, expiry: 14 });
  expect(Object.keys(initial.substitutions)).toEqual(['["name"]']);
});

test("static structured props remain editable JSON literals", () => {
  const value = [{ ruleType: "required", message: "Enter a name" }];
  expect(tryExtractJson(setup("rules", value).expr)).toEqual(value);
});
