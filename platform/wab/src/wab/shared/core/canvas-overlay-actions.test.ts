import { actionOpensOverlay } from "@/wab/shared/core/canvas-overlay-actions";
import {
  InteractionConditionalMode,
  codeLit,
  createExprForDataPickerValue,
  customCode,
} from "@/wab/shared/core/exprs";
import {
  UpdateVariableOperations,
  mkInteraction,
} from "@/wab/shared/core/states";
import { EventHandler, ObjectPath } from "@/wab/shared/model/classes";

const open = customCode("$state.action === 'export'");
const check = (
  code: string,
  args: Record<string, unknown> = {},
  predicate = open,
) =>
  actionOpensOverlay(
    [createExprForDataPickerValue(code, null, true, Object.keys(args))],
    args,
    predicate,
  );

test("matches assigned values rather than shared state reads", () => {
  expect(check("$state.action='export'")).toBe(true);
  expect(check("$state.action='edit'")).toBe(false);
  expect(check("console.log($state.action)")).toBe(false);
  expect(check("$state.action='export'", {}, codeLit(true))).toBe(false);
});

test("binds delegated arguments and follows the selected branch", () => {
  const code =
    "if(key==='export'){$state.action='export'}else{$state.action='edit'}";
  expect(check(code, { key: "export" })).toBe(true);
  expect(check(code, { key: "edit" })).toBe(false);
  expect(check(code)).toBe(false);
  expect(
    check("const action = key; $state.action=action", { key: "export" }),
  ).toBe(true);
});

test("respects final writes, returns, and nested function declarations", () => {
  expect(check("$state.action='export';$state.action=''")).toBe(false);
  expect(check("return; $state.action='export'")).toBe(false);
  expect(check("function unused(){$state.action='export'}")).toBe(false);
  expect(
    check("if(key==='navigate')return;$state.action='export'", {
      key: "navigate",
    }),
  ).toBe(false);
});

test("supports explicit paths and boolean open flags without executing calls", () => {
  expect(
    check(
      "businessSideEffect(); $state.dialog.open=true",
      {},
      customCode("$state.dialog.open"),
    ),
  ).toBe(true);
  expect(
    check(
      "$state['dialog']['open']=false",
      {},
      customCode("!$state.dialog.open"),
    ),
  ).toBe(true);
  expect(
    check("$state.action=null", {}, customCode("$state.action === null")),
  ).toBe(true);
  expect(check("if(unknownCall()){$state.action='export'}")).toBe(false);
  expect(check("malformed {")).toBe(false);
});

test("uses structured interactions and their conditions", () => {
  const handler = new EventHandler({ interactions: [] });
  const action = mkInteraction(handler, "updateVariable", "Open", {
    variable: new ObjectPath({ path: ["$state", "action"], fallback: null }),
    value: codeLit("export"),
    operation: codeLit(UpdateVariableOperations.NewValue),
  });
  handler.interactions.push(action);
  expect(actionOpensOverlay([handler], {}, open)).toBe(true);
  action.conditionalMode = InteractionConditionalMode.Never;
  expect(actionOpensOverlay([handler], {}, open)).toBe(false);
  action.conditionalMode = InteractionConditionalMode.Expression;
  action.condExpr = customCode("key==='export'");
  expect(actionOpensOverlay([handler], { key: "export" }, open)).toBe(true);
  expect(actionOpensOverlay([handler], { key: "edit" }, open)).toBe(false);
});
