import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { codeLit } from "@/wab/shared/core/exprs";
import { mkParam } from "@/wab/shared/core/lang";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplComponent, mkTplTag } from "@/wab/shared/core/tpls";
import { lintChoicePropValues } from "@/wab/shared/linting/lint-choice-prop-values";
import { Arg } from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";

vi.mock("@/wab/shared/component-props", () => ({
  inferPropTypeFromParam: (
    _studio: unknown,
    _view: unknown,
    _tpl: unknown,
    param: { type: { options: unknown[] } },
  ) => ({ type: "choice", options: param.type.options }),
}));
it("reports every invalid registered property, including zero and false, with the actual value and allowed values", () => {
  const params = ["pageSize", "enabled", "mode"].map((name) =>
    mkParam({ name, type: typeFactory.choice(["valid"]), paramType: "prop" }),
  );
  const inner = mkComponent({
    name: "RegisteredTable",
    type: ComponentType.Plain,
    params,
    tplTree: () => mkTplTag("div"),
  });
  const values = [0, false, "invalid"];
  const owner = mkComponent({
    name: "Owner",
    type: ComponentType.Plain,
    tplTree: (base) => {
      const tpl = mkTplComponent(inner, base);
      tpl.vsettings[0].args.push(
        ...params.map(
          (param, i) => new Arg({ param, expr: codeLit(values[i]) }),
        ),
      );
      return tpl;
    },
  });
  const site = createSite();
  site.components.push(owner);
  const studio = {
    projectFlags: () => ({}),
    focusedViewCtx: () => ({
      getComponentEvalContext: () => ({
        componentPropValues: {},
        ccContextData: {},
      }),
    }),
  } as unknown as StudioCtx;
  const issues = lintChoicePropValues(site, studio);
  expect(
    issues.map((issue) => ({
      prop: issue.propName,
      value: issue.value,
      allowed: issue.allowedValues,
    })),
  ).toEqual(
    params.map((param, i) => ({
      prop: param.variable.name,
      value: values[i],
      allowed: ["valid"],
    })),
  );
  expect(new Set(issues.map((issue) => issue.key)).size).toBe(3);
  owner.tplTree.vsettings[0].args.forEach(
    (arg) => (arg.expr = codeLit("valid")),
  );
  expect(lintChoicePropValues(site, studio)).toEqual([]);
});
