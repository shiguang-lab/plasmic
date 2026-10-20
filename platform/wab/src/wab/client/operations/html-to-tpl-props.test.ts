import {
  setupComponentWithInstance,
  setupComponentWithTplTree,
} from "@/wab/client/operations/__testonly__/utils";
import { getComponentArgFromHtmlProp } from "@/wab/client/operations/html-to-tpl";
import { isRecoverableWIError } from "@/wab/client/web-importer/errors";
import { ensure } from "@/wab/shared/common";
import { asCode, tryExtractJson } from "@/wab/shared/core/exprs";
import { mkParam } from "@/wab/shared/core/lang";
import * as Tpls from "@/wab/shared/core/tpls";
import { getProjectFlags } from "@/wab/shared/devflags";
import { ensureKnownCompositeExpr } from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";

test("only invalid optional literal props can be safely discarded", () => {
  const { site, button } = setupComponentWithInstance();
  button.params.push(
    mkParam({
      name: "requiredLabel",
      paramType: "prop",
      type: typeFactory.text(),
      required: true,
    }),
    mkParam({ name: "onSave", paramType: "prop", type: typeFactory.func() }),
    mkParam({ name: "href", paramType: "prop", type: typeFactory.href() }),
  );
  for (const [name, value, recoverable] of [
    ["unknown", 42, true],
    ["disabled", "yes", true],
    ["tone", "invalid", true],
    ["requiredLabel", 42, false],
    ["onSave", "ignored", false],
    ["href", 42, false],
    ["children", "content", false],
  ] as const) {
    const result = getComponentArgFromHtmlProp(
      site,
      button,
      button.name,
      name,
      value,
    );
    const error = ensure(
      result.isErr() ? result.error : undefined,
      "Expected a rejected prop",
    );
    expect(isRecoverableWIError(error), name).toBe(recoverable);
  }
});

function setup(name: string, value: any) {
  const { component, site } = setupComponentWithTplTree(
    Tpls.mkTplTagX("div", {}),
  );
  component.params.push(
    mkParam({ name, type: typeFactory.any(), paramType: "prop" }),
  );
  const result = getComponentArgFromHtmlProp(
    site,
    component,
    component.name,
    name,
    value,
  );
  expect(result.isOk()).toBe(true);
  return { component, site, expr: result._unsafeUnwrap()[1] };
}

test("structured form props retain executable nested bindings", () => {
  const { component, site, expr } = setup("rules", [
    { ruleType: "required", message: "Enter a key" },
    {
      ruleType: "advanced",
      custom: "{{ (_rule,value)=>!$state.rows.some(row=>row.key===value) }}",
      message: "Duplicate key",
    },
  ]);
  const composite = ensureKnownCompositeExpr(expr);
  expect(JSON.parse(composite.hostLiteral)[0]).toEqual({
    ruleType: "required",
    message: "Enter a key",
  });
  const validatorCode = asCode(composite.substitutions['[1]["custom"]'], {
    component,
    inStudio: true,
    projectFlags: getProjectFlags(site),
  }).code;
  const validator = new Function("$state", `return ${validatorCode}`)({
    rows: [{ key: "existing" }],
  });
  expect(validator({}, "existing")).toBe(false);
  expect(validator({}, "new")).toBe(true);
  const initial = ensureKnownCompositeExpr(
    setup("initialValues", {
      name: "{{ $ctx.query?.name || 'Audience' }}",
      expiry: 14,
    }).expr,
  );
  expect(JSON.parse(initial.hostLiteral)).toEqual({ name: null, expiry: 14 });
  expect(Object.keys(initial.substitutions)).toEqual(['["name"]']);
});

test("static structured props remain editable JSON literals", () => {
  const value = [{ ruleType: "required", message: "Enter a name" }];
  expect(tryExtractJson(setup("rules", value).expr)).toEqual(value);
});

test("query result envelopes retain nested data bindings", () => {
  const { button, site, page } = setupComponentWithInstance();
  const result = getComponentArgFromHtmlProp(site, button, button.name, "query", {
    data: "{{ $state.rows }}",
    schema: { id: "audiences", fields: [] },
  });
  expect(result.isOk()).toBe(true);
  const expr = ensureKnownCompositeExpr(result._unsafeUnwrap()[1]);
  expect(JSON.parse(expr.hostLiteral)).toEqual({ data: null, schema: { id: "audiences", fields: [] } });
  const rows = [{ id: "one", count: 0 }];
  const code = asCode(expr.substitutions['["data"]'], {
    component: page,
    inStudio: true,
    projectFlags: getProjectFlags(site),
  }).code;
  expect(new Function("$state", `return ${code}`)({ rows })).toEqual(rows);
});
