import { FormValidationRulesEditor } from "@/wab/client/components/sidebar-tabs/ComponentProps/FormValidationRulesEditor";
import { ExprCtx, codeLit, getRawCode, tryExtractString } from "@/wab/shared/core/exprs";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { getProjectFlags } from "@/wab/shared/devflags";
import { tryEvalExpr } from "@/wab/shared/eval";
import { CollectionExpr, CustomCode, Expr, FunctionExpr, MapExpr, ensureKnownCollectionExpr, ensureKnownMapExpr } from "@/wab/shared/model/classes";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { JsonObject, JsonValue } from "@/wab/shared/core/lang";

vi.mock("@/wab/client/components/sidebar-tabs/PropEditorRow", () => ({
  isPropShown: (type: any, rule: any) => !type.hidden?.(rule),
  PropEditorRow: ({ attr, expr, onChange }: any) => (
    <input aria-label={attr} value={expr ? tryExtractString(expr) ?? "" : ""} onChange={(e) => onChange(codeLit(e.target.value))} />
  ),
}));
vi.mock("@/wab/client/components/sidebar/SidebarModal", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/wab/client/components/sidebar/SidebarModal")>(),
  SidebarModal: ({ children }: any) => <div role="dialog">{children}</div>,
}));
vi.mock("@/wab/client/components/widgets/Chip", () => ({ default: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button> }));
vi.mock("@/wab/client/components/widgets/Button", () => ({ default: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button> }));

const exprCtx: ExprCtx = { component: null, inStudio: true, projectFlags: getProjectFlags(createSite()) };

function mountRules(initialValue?: JsonValue | Expr) {
  const saved = vi.fn();
  const viewCtx = { customFunctionsSchema: () => ({}), getInspectorCanvasEnvForTpl: () => ({}) } as any;
  const tpl = mkTplTagX("div");
  function Harness() {
    const [value, setValue] = React.useState(initialValue);
    return <FormValidationRulesEditor value={value} viewCtx={viewCtx} tpl={tpl} onChange={(next) => { setValue(next); saved(next); }} />;
  }
  render(<Harness />);
  return saved;
}

function evaluatedRules(expr: Expr) {
  const result = tryEvalExpr(getRawCode(expr, exprCtx), {});
  expect(result.err).toBeUndefined();
  return result.val;
}

afterEach(cleanup);

it("opens literal-array rules and edits, adds and removes without losing other fields", () => {
  const rules: JsonObject[] = [{ ruleType: "required", message: "请输入名称" }, { ruleType: "enum", options: [{ value: "one" }, { value: "two" }] }];
  const originalRules = JSON.stringify(rules);
  const saved = mountRules(rules);
  expect(screen.getByText("2 rules")).toBeTruthy();
  expect(saved).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("2 rules"));
  fireEvent.change(screen.getAllByLabelText("message")[0], { target: { value: "请输入内部名称" } });
  expect(evaluatedRules(saved.mock.lastCall![0])).toEqual([{ ...rules[0], message: "请输入内部名称" }, rules[1]]);
  expect(JSON.stringify(rules)).toBe(originalRules);

  fireEvent.click(screen.getByText("Add new rule"));
  expect(evaluatedRules(saved.mock.lastCall![0])).toEqual([{ ...rules[0], message: "请输入内部名称" }, rules[1], { ruleType: "required" }]);
  fireEvent.change(screen.getAllByLabelText("ruleType")[1], { target: { value: "remove" } });
  expect(evaluatedRules(saved.mock.lastCall![0])).toEqual([{ ...rules[0], message: "请输入内部名称" }, { ruleType: "required" }]);
});

it.each([undefined, []])("allows adding the first rule to an unset or empty prop", (initialValue) => {
  const saved = mountRules(initialValue);
  fireEvent.click(screen.getByText("0 rules"));
  expect(saved).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("Add new rule"));
  expect(evaluatedRules(saved.mock.lastCall![0])).toEqual([{ ruleType: "required" }]);
});

it("preserves structured custom validator expressions when a rule message changes", () => {
  const validator = new FunctionExpr({ argNames: ["rule", "value"], bodyExpr: new CustomCode({ code: '(value === "allowed")', fallback: undefined }) });
  const source = new CollectionExpr({ exprs: [new MapExpr({ mapExpr: { ruleType: codeLit("advanced"), custom: validator, message: codeLit("Invalid") } })] });
  const saved = mountRules(source);
  fireEvent.click(screen.getByText("1 rule"));
  fireEvent.change(screen.getByLabelText("message"), { target: { value: "Try again" } });
  const edited = ensureKnownMapExpr(ensureKnownCollectionExpr(saved.mock.lastCall![0]).exprs[0]);
  const result = tryEvalExpr(getRawCode(edited.mapExpr.custom, exprCtx), {});
  expect(result.err).toBeUndefined();
  expect(result.val({}, "allowed")).toBe(true);
  expect(result.val({}, "other")).toBe(false);
  expect(tryExtractString(ensureKnownMapExpr(source.exprs[0]).mapExpr.message)).toBe("Invalid");
});
